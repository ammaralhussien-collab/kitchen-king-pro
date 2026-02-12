import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Truck, Store } from 'lucide-react';
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidE164, type WhatsAppOrderData } from '@/lib/whatsapp';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { t, formatCurrency } = useI18n();
  const [restaurantId, setRestaurantId] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    orderType: 'pickup' as 'delivery' | 'pickup',
    address: '',
    paymentMethod: 'cash' as 'cash' | 'online',
    scheduledTime: '',
    notes: '',
  });

  useEffect(() => {
    supabase.from('restaurants').select('id, name, phone, delivery_fee').limit(1).single().then(({ data }) => {
      if (data) {
        setRestaurantId(data.id);
        setRestaurantName(data.name);
        setRestaurantPhone(data.phone || '');
        setDeliveryFee(Number(data.delivery_fee) || 0);
      }
    });
  }, []);

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const total = subtotal + (form.orderType === 'delivery' ? deliveryFee : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error(t('checkout.fillRequired'));
      return;
    }
    if (form.orderType === 'delivery' && !form.address.trim()) {
      toast.error(t('checkout.enterAddress'));
      return;
    }

    setLoading(true);
    try {
       const { data: { session } } = await supabase.auth.getSession();
       const userId = session?.user?.id || '00000000-0000-0000-0000-000000000000';
       
       const { data: order, error: orderErr } = await supabase
         .from('orders')
         .insert({
           restaurant_id: restaurantId,
           user_id: userId,
           order_type: form.orderType,
           payment_method: form.paymentMethod,
           customer_name: form.name.trim(),
           customer_phone: form.phone.trim(),
           delivery_address: form.orderType === 'delivery' ? form.address.trim() : null,
           scheduled_time: form.scheduledTime || null,
           subtotal,
           delivery_fee: form.orderType === 'delivery' ? deliveryFee : 0,
           total,
           notes: form.notes || null,
         })
         .select('id')
         .single();

       if (orderErr) throw orderErr;

      const orderItems = items.map(cartItem => ({
        order_id: order.id,
        item_id: cartItem.itemId,
        item_name: cartItem.name,
        quantity: cartItem.quantity,
        unit_price: cartItem.price,
        addons: cartItem.addons as unknown as any,
        notes: cartItem.notes || null,
        total: (cartItem.price + cartItem.addons.reduce((s, a) => s + a.price, 0)) * cartItem.quantity,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      await supabase.from('payments').insert({
        order_id: order.id,
        method: form.paymentMethod,
        amount: total,
        status: form.paymentMethod === 'cash' ? 'pending' : 'pending',
      });

      // Build and open WhatsApp message
      if (restaurantPhone && isValidE164(restaurantPhone)) {
        const waData: WhatsAppOrderData = {
          orderId: order.id,
          restaurantName,
          orderType: form.orderType,
          scheduledTime: form.scheduledTime || null,
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          deliveryAddress: form.orderType === 'delivery' ? form.address.trim() : null,
          items: orderItems.map((oi, idx) => ({
            name: oi.item_name,
            quantity: oi.quantity,
            unitPrice: oi.unit_price,
            addons: (items[idx]?.addons || []).map(a => ({ name: a.name, price: a.price })),
            notes: oi.notes,
            total: oi.total,
          })),
          subtotal,
          deliveryFee: form.orderType === 'delivery' ? deliveryFee : 0,
          total,
          paymentMethod: form.paymentMethod,
        };
        const waUrl = buildWhatsAppUrl(restaurantPhone, buildWhatsAppMessage(waData));
        window.open(waUrl, '_blank');
      } else if (restaurantPhone && !isValidE164(restaurantPhone)) {
        toast.error(t('error.phoneNotE164'));
      }

      clearCart();
      toast.success(t('checkout.orderSuccess'));
      navigate(`/order/${order.id}`);
    } catch (err: any) {
      toast.error(err.message || t('error.orderFailed'));
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="font-display text-2xl font-bold">{t('checkout.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Order Type */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.orderType')}</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'pickup', label: t('checkout.pickup'), icon: Store },
              { value: 'delivery', label: t('checkout.delivery'), icon: Truck },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => update('orderType', value)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 font-medium transition-colors ${
                  form.orderType === value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.contactInfo')}</Label>
          <Input placeholder={t('checkout.name')} value={form.name} onChange={e => update('name', e.target.value)} required />
          <Input placeholder={t('checkout.phone')} type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} required />
        </div>

        {/* Delivery address */}
        {form.orderType === 'delivery' && (
          <div className="space-y-3">
            <Label className="font-display text-lg font-semibold">{t('checkout.deliveryAddress')}</Label>
            <Textarea placeholder={t('checkout.addressPlaceholder')} value={form.address} onChange={e => update('address', e.target.value)} required />
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.when')}</Label>
          <RadioGroup value={form.scheduledTime ? 'scheduled' : 'asap'} onValueChange={v => v === 'asap' && update('scheduledTime', '')}>
            <div className="flex items-center gap-2"><RadioGroupItem value="asap" id="asap" /><Label htmlFor="asap">{t('checkout.asap')}</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="scheduled" id="scheduled" /><Label htmlFor="scheduled">{t('checkout.schedule')}</Label></div>
          </RadioGroup>
          {form.scheduledTime !== '' && form.scheduledTime !== undefined && (
            <Input type="datetime-local" value={form.scheduledTime} onChange={e => update('scheduledTime', e.target.value)} />
          )}
        </div>

        {/* Payment */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.paymentMethod')}</Label>
          <RadioGroup value={form.paymentMethod} onValueChange={v => update('paymentMethod', v)}>
            <div className="flex items-center gap-2"><RadioGroupItem value="cash" id="cash" /><Label htmlFor="cash">{t('checkout.cash')} {t('checkout.cashOn')} {form.orderType === 'delivery' ? t('checkout.delivery').toLowerCase() : t('checkout.pickup').toLowerCase()}</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="online" id="online" /><Label htmlFor="online">{t('checkout.payOnline')}</Label></div>
          </RadioGroup>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.orderNotes')}</Label>
          <Textarea placeholder={t('checkout.notesPlaceholder')} value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('cart.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
          {form.orderType === 'delivery' && (
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('checkout.deliveryFee')}</span><span>{formatCurrency(deliveryFee)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
            <span>{t('cart.total')}</span><span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        <Button type="submit" className="w-full text-base font-semibold" size="lg" disabled={loading}>
          {loading ? t('checkout.placingOrder') : `${t('checkout.placeOrder')} — ${formatCurrency(total)}`}
        </Button>
      </form>
    </div>
  );
};

export default CheckoutPage;
