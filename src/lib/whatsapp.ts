export interface WhatsAppOrderData {
  orderId: string;
  restaurantName: string;
  orderType: 'delivery' | 'pickup';
  scheduledTime: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    addons: { name: string; price: number }[];
    notes: string | null;
    total: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
}

export function buildWhatsAppMessage(data: WhatsAppOrderData): string {
  const lines: string[] = [
    `🔔 *طلب جديد #${data.orderId.slice(0, 8)}*`,
    `🏪 ${data.restaurantName}`,
    '',
    `📦 *نوع الطلب:* ${data.orderType === 'delivery' ? 'توصيل' : 'استلام'}`,
    data.scheduledTime
      ? `⏰ *الموعد:* ${new Date(data.scheduledTime).toLocaleString('ar')}`
      : `⏰ *الموعد:* في أقرب وقت`,
    '',
    `👤 *الاسم:* ${data.customerName}`,
    `📞 *الهاتف:* ${data.customerPhone}`,
  ];

  if (data.orderType === 'delivery' && data.deliveryAddress) {
    lines.push(`📍 *العنوان:* ${data.deliveryAddress}`);
  }

  lines.push('', '🍽️ *الأصناف:*');
  for (const item of data.items) {
    let line = `• ${item.quantity}x ${item.name} — $${item.total.toFixed(2)}`;
    if (item.addons.length > 0) {
      line += ` (${item.addons.map(a => a.name).join(', ')})`;
    }
    if (item.notes) {
      line += ` [${item.notes}]`;
    }
    lines.push(line);
  }

  lines.push('');
  lines.push(`💰 *المجموع الفرعي:* $${data.subtotal.toFixed(2)}`);
  if (data.orderType === 'delivery' && data.deliveryFee > 0) {
    lines.push(`🚚 *رسوم التوصيل:* $${data.deliveryFee.toFixed(2)}`);
  }
  lines.push(`💵 *الإجمالي:* $${data.total.toFixed(2)}`);
  lines.push(`💳 *الدفع:* ${data.paymentMethod === 'cash' ? 'كاش' : 'أونلاين'}`);

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
