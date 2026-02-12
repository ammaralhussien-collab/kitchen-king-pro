import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Truck, Store } from 'lucide-react';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const [restaurantId, setRestaurantId] = useState('');
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
    supabase.from('restaurants').select('id, delivery_fee').limit(1).single().then(({ data }) => {
      if (data) {
        setRestaurantId(data.id);
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
      toast.error('Please fill in your name and phone number');
      return;
    }
    if (form.orderType === 'delivery' && !form.address.trim()) {
      toast.error('Please enter your delivery address');
      return;
    }

    setLoading(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
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

      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/order/${order.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="font-display text-2xl font-bold">Checkout</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Order Type */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">Order Type</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'pickup', label: 'Pickup', icon: Store },
              { value: 'delivery', label: 'Delivery', icon: Truck },
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
          <Label className="font-display text-lg font-semibold">Contact Info</Label>
          <Input placeholder="Your name" value={form.name} onChange={e => update('name', e.target.value)} required />
          <Input placeholder="Phone number" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} required />
        </div>

        {/* Delivery address */}
        {form.orderType === 'delivery' && (
          <div className="space-y-3">
            <Label className="font-display text-lg font-semibold">Delivery Address</Label>
            <Textarea placeholder="Enter your full address" value={form.address} onChange={e => update('address', e.target.value)} required />
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">When</Label>
          <RadioGroup value={form.scheduledTime ? 'scheduled' : 'asap'} onValueChange={v => v === 'asap' && update('scheduledTime', '')}>
            <div className="flex items-center gap-2"><RadioGroupItem value="asap" id="asap" /><Label htmlFor="asap">ASAP</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="scheduled" id="scheduled" /><Label htmlFor="scheduled">Schedule for later</Label></div>
          </RadioGroup>
          {form.scheduledTime !== '' && form.scheduledTime !== undefined && (
            <Input type="datetime-local" value={form.scheduledTime} onChange={e => update('scheduledTime', e.target.value)} />
          )}
        </div>

        {/* Payment */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">Payment Method</Label>
          <RadioGroup value={form.paymentMethod} onValueChange={v => update('paymentMethod', v)}>
            <div className="flex items-center gap-2"><RadioGroupItem value="cash" id="cash" /><Label htmlFor="cash">Cash on {form.orderType === 'delivery' ? 'delivery' : 'pickup'}</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="online" id="online" /><Label htmlFor="online">Pay online</Label></div>
          </RadioGroup>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">Order Notes</Label>
          <Textarea placeholder="Any special instructions..." value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {form.orderType === 'delivery' && (
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery fee</span><span>${deliveryFee.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
            <span>Total</span><span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        <Button type="submit" className="w-full text-base font-semibold" size="lg" disabled={loading}>
          {loading ? 'Placing Order...' : `Place Order — $${total.toFixed(2)}`}
        </Button>
      </form>
    </div>
  );
};

export default CheckoutPage;
