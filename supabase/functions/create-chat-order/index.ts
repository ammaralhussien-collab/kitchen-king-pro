import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface OrderItemInput {
  item_id: string
  quantity: number
  addon_ids: string[]
  notes: string
}

interface ChatOrderInput {
  order_type: 'delivery' | 'pickup'
  customer_name: string
  customer_phone: string
  delivery_address?: string
  notes?: string
  items: OrderItemInput[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id
    const body: ChatOrderInput = await req.json()

    // Validate required fields
    if (!body.customer_name?.trim() || !body.customer_phone?.trim()) {
      return new Response(JSON.stringify({ error: 'Name and phone are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^\+?[\d\s\-()]{7,}$/.test(body.customer_phone.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!body.items || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one item is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.order_type === 'delivery' && !body.delivery_address?.trim()) {
      return new Response(JSON.stringify({ error: 'Delivery address is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch item prices
    const itemIds = body.items.map(i => i.item_id)
    const { data: dbItems, error: itemsErr } = await supabase
      .from('items')
      .select('id, name, price, is_offer, offer_price, is_available')
      .in('id', itemIds)

    if (itemsErr || !dbItems) {
      return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const itemMap = new Map(dbItems.map(i => [i.id, i]))

    for (const orderItem of body.items) {
      const dbItem = itemMap.get(orderItem.item_id)
      if (!dbItem) {
        return new Response(JSON.stringify({ error: `Item not found: ${orderItem.item_id}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!dbItem.is_available) {
        return new Response(JSON.stringify({ error: `Item not available: ${dbItem.name}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Fetch addons
    const allAddonIds = body.items.flatMap(i => i.addon_ids)
    let addonMap = new Map<string, { id: string; name: string; price: number }>()
    if (allAddonIds.length > 0) {
      const { data: dbAddons } = await supabase
        .from('item_addons')
        .select('id, name, price')
        .in('id', allAddonIds)
        .eq('is_available', true)
      if (dbAddons) {
        addonMap = new Map(dbAddons.map(a => [a.id, a]))
      }
    }

    // Fetch restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, delivery_fee')
      .limit(1)
      .single()

    if (!restaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Compute prices server-side
    let subtotal = 0
    const orderItemsData = body.items.map(oi => {
      const dbItem = itemMap.get(oi.item_id)!
      const effectivePrice = (dbItem.is_offer && dbItem.offer_price) ? dbItem.offer_price : dbItem.price
      const addons = oi.addon_ids
        .map(aid => addonMap.get(aid))
        .filter(Boolean) as { id: string; name: string; price: number }[]
      const addonsTotal = addons.reduce((s, a) => s + a.price, 0)
      const lineTotal = (effectivePrice + addonsTotal) * oi.quantity
      subtotal += lineTotal

      return {
        item_id: oi.item_id,
        item_name: dbItem.name,
        quantity: oi.quantity,
        unit_price: effectivePrice,
        addons: addons.map(a => ({ id: a.id, name: a.name, price: a.price })),
        notes: oi.notes || null,
        total: lineTotal,
      }
    })

    const deliveryFee = body.order_type === 'delivery' ? (Number(restaurant.delivery_fee) || 0) : 0
    const total = subtotal + deliveryFee

    // Prevent zero-total orders
    if (total <= 0) {
      return new Response(JSON.stringify({ error: 'Order total must be greater than zero' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build items snapshot
    const itemsSnapshot = orderItemsData.map(oi => ({
      itemId: oi.item_id,
      name: oi.item_name,
      price: oi.unit_price,
      quantity: oi.quantity,
      addons: oi.addons,
      notes: oi.notes,
      total: oi.total,
    }))

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        user_id: userId,
        order_type: body.order_type,
        payment_method: 'cash',
        customer_name: body.customer_name.trim(),
        customer_phone: body.customer_phone.trim(),
        delivery_address: body.order_type === 'delivery' ? body.delivery_address?.trim() : null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        notes: body.notes || null,
        status: 'received',
        source: 'chat',
        payment_status: 'unpaid',
        currency: 'EUR',
        items_snapshot: itemsSnapshot,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr)
      return new Response(JSON.stringify({ error: 'Failed to create order' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert order items
    const { error: oiErr } = await supabase
      .from('order_items')
      .insert(orderItemsData.map(oi => ({ ...oi, order_id: order.id })))

    if (oiErr) {
      console.error('Order items insert error:', oiErr)
      return new Response(JSON.stringify({ error: 'Failed to create order items' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create payment record
    await supabase.from('payments').insert({
      order_id: order.id,
      method: 'cash',
      amount: total,
      status: 'pending',
    })

    return new Response(JSON.stringify({
      order_id: order.id,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      items: orderItemsData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Internal error'
    console.error('create-chat-order error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
