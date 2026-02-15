import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

interface OrderItemInput {
  item_id: string
  quantity: number
  addon_ids: string[]
  notes: string
}

interface CreateOrderInput {
  order_type: 'delivery' | 'pickup'
  customer_name: string
  customer_phone: string
  delivery_address?: string
  notes?: string
  items: OrderItemInput[]
  idempotency_key?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const userId = user.id

    // Rate limit
    await supabase.from('order_rate_limits').insert({ user_id: userId })
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentCount } = await supabase
      .from('order_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo)
    if ((recentCount ?? 0) > 5) return json({ error: 'Too many requests' }, 429)

    const body: CreateOrderInput = await req.json()

    // Idempotency check
    if (body.idempotency_key?.trim()) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, subtotal, delivery_fee, total')
        .eq('idempotency_key', body.idempotency_key.trim())
        .eq('user_id', userId)
        .maybeSingle()
      if (existing) return json({ order_id: existing.id, subtotal: existing.subtotal, delivery_fee: existing.delivery_fee, total: existing.total, deduplicated: true })
    }

    // Validate fields
    if (!body.customer_name?.trim() || !body.customer_phone?.trim())
      return json({ error: 'Name and phone are required' }, 400)
    if (!/^\+?[\d\s\-()]{7,}$/.test(body.customer_phone.trim()))
      return json({ error: 'Invalid phone number' }, 400)
    if (!Array.isArray(body.items) || body.items.length === 0)
      return json({ error: 'At least one item is required' }, 400)
    if (body.items.length > 30)
      return json({ error: 'Maximum 30 items per order' }, 400)
    if (body.order_type === 'delivery' && !body.delivery_address?.trim())
      return json({ error: 'Delivery address is required' }, 400)
    if (!['delivery', 'pickup'].includes(body.order_type))
      return json({ error: 'Invalid order type' }, 400)

    // Fetch item prices from DB (ignore client prices)
    const itemIds = body.items.map(i => i.item_id)
    const { data: dbItems, error: itemsErr } = await supabase
      .from('items')
      .select('id, name, price, is_offer, offer_price, is_available')
      .in('id', itemIds)
    if (itemsErr || !dbItems) return json({ error: 'Failed to fetch items' }, 500)

    const itemMap = new Map(dbItems.map(i => [i.id, i]))
    for (const oi of body.items) {
      const dbItem = itemMap.get(oi.item_id)
      if (!dbItem) return json({ error: `Item not found: ${oi.item_id}` }, 400)
      if (!dbItem.is_available) return json({ error: `Item not available: ${dbItem.name}` }, 400)
    }

    // Fetch addons from DB
    const allAddonIds = body.items.flatMap(i => i.addon_ids || [])
    let addonMap = new Map<string, { id: string; name: string; price: number }>()
    if (allAddonIds.length > 0) {
      const { data: dbAddons } = await supabase
        .from('item_addons')
        .select('id, name, price')
        .in('id', allAddonIds)
        .eq('is_available', true)
      if (dbAddons) addonMap = new Map(dbAddons.map(a => [a.id, a]))
    }

    // Fetch restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, delivery_fee')
      .limit(1)
      .single()
    if (!restaurant) return json({ error: 'Restaurant not found' }, 500)

    // Compute totals server-side
    let subtotal = 0
    const orderItemsData = body.items.map(oi => {
      const dbItem = itemMap.get(oi.item_id)!
      const effectivePrice = (dbItem.is_offer && dbItem.offer_price) ? dbItem.offer_price : dbItem.price
      const addons = (oi.addon_ids || [])
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
    if (total <= 0) return json({ error: 'Order total must be greater than zero' }, 400)

    const itemsSnapshot = orderItemsData.map(oi => ({
      itemId: oi.item_id, name: oi.item_name, price: oi.unit_price,
      quantity: oi.quantity, addons: oi.addons, notes: oi.notes, total: oi.total,
    }))

    // Insert order
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
        subtotal, delivery_fee: deliveryFee, total,
        notes: body.notes || null,
        status: 'received',
        source: 'web',
        payment_status: 'unpaid',
        currency: 'EUR',
        items_snapshot: itemsSnapshot,
        idempotency_key: body.idempotency_key?.trim() || null,
      })
      .select('id')
      .single()
    if (orderErr || !order) {
      console.error('Order insert error:', orderErr)
      return json({ error: 'Failed to create order' }, 500)
    }

    // Insert order items
    const { error: oiErr } = await supabase
      .from('order_items')
      .insert(orderItemsData.map(oi => ({ ...oi, order_id: order.id })))
    if (oiErr) {
      console.error('Order items insert error:', oiErr)
      return json({ error: 'Failed to create order items' }, 500)
    }

    // Payment record
    await supabase.from('payments').insert({
      order_id: order.id, method: 'cash', amount: total, status: 'pending',
    })

    return json({ order_id: order.id, subtotal, delivery_fee: deliveryFee, total, items: orderItemsData })
  } catch (err) {
    console.error('create-order error:', err)
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
