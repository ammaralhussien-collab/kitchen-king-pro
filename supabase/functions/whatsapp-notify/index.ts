import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    const orderId = record?.id

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'No order id provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch restaurant phone
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('phone, name')
      .eq('id', order.restaurant_id)
      .single()

    const restaurantPhone = restaurant?.phone
    if (!restaurantPhone) {
      console.warn('No restaurant phone configured for restaurant:', order.restaurant_id)
    }

    // Format the items list
    const itemsList = (order.order_items || [])
      .map((item: any) => `• ${item.quantity}x ${item.item_name} — $${Number(item.total).toFixed(2)}`)
      .join('\n')

    // Build WhatsApp message
    const message = [
      `🔔 *New Order #${orderId.slice(0, 8)}*`,
      ``,
      `👤 *Customer:* ${order.customer_name}`,
      `📞 *Phone:* ${order.customer_phone}`,
      `📦 *Type:* ${order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}`,
      order.order_type === 'delivery' && order.delivery_address
        ? `📍 *Address:* ${order.delivery_address}`
        : null,
      order.scheduled_time
        ? `⏰ *Scheduled:* ${new Date(order.scheduled_time).toLocaleString()}`
        : null,
      ``,
      `🍽️ *Items:*`,
      itemsList,
      ``,
      `💰 *Total:* $${Number(order.total).toFixed(2)}`,
      `💳 *Payment:* ${order.payment_method}`,
      order.notes ? `📝 *Notes:* ${order.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    console.log('WhatsApp message prepared:', message)
    console.log('Target phone:', restaurantPhone)

    // ─── Twilio WhatsApp Integration ───
    // To enable, add these secrets:
    //   TWILIO_ACCOUNT_SID
    //   TWILIO_AUTH_TOKEN
    //   TWILIO_WHATSAPP_FROM  (e.g. "whatsapp:+14155238886")
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')

    let sent = false

    if (twilioSid && twilioToken && twilioFrom && restaurantPhone) {
      const toNumber = `whatsapp:${restaurantPhone.startsWith('+') ? restaurantPhone : '+' + restaurantPhone}`
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`

      const body = new URLSearchParams({
        From: twilioFrom,
        To: toNumber,
        Body: message,
      })

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })

      const result = await resp.json()
      if (!resp.ok) {
        console.error('Twilio error:', result)
      } else {
        console.log('WhatsApp sent via Twilio, SID:', result.sid)
        sent = true
      }
    } else {
      console.log('Twilio not configured — message logged only. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM secrets to enable.')
    }

    return new Response(
      JSON.stringify({ success: true, sent, message_preview: message.slice(0, 200) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('WhatsApp notify error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
