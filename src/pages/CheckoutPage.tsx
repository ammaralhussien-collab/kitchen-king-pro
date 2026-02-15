import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Truck, Store, Banknote, CreditCard, LogIn } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { t, formatCurrency } = useI18n();
  const [restaurantId, setRestaurantId] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    orderType: 'pickup' as 'delivery' | 'pickup',
    address: '',
    paymentMethod: 'cash_on_delivery' as string,
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

  if (items.length === 0 && !authLoading) {
    navigate('/cart');
    return null;
  }

  const total = subtotal + (form.orderType === 'delivery' ? deliveryFee : 0);

  // Auth guard
  if (!authLoading && !user) {
    return (
      <div className="container max-w-md py-16 text-center">
        <LogIn className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">{t('checkout.loginRequired')}</h2>
        <p className="mt-2 text-muted-foreground">{t('checkout.loginHint')}</p>
        <Link to="/auth">
          <Button className="mt-6">{t('checkout.loginButton')}</Button>
        </Link>
      </div>
    );
  }

  const validatePhone = (phone: string) => /^\+?[\d\s\-()]{7,}$/.test(phone.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error(t('checkout.fillRequired'));
      return;
    }
    if (!validatePhone(form.phone)) {
      toast.error(t('checkout.invalidPhone'));
      return;
    }
    if (form.orderType === 'delivery' && !form.address.trim()) {
      toast.error(t('checkout.enterAddress'));
      return;
    }
    if (total <= 0) {
      toast.error(t('checkout.zeroTotal'));
      return;
    }
    if (items.length > 30) {
      toast.error('Maximum 30 items per order.');
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const idempotencyKey = `${user!.id}-${Date.now()}-${crypto.randomUUID()}`;
      const payload = {
        order_type: form.orderType,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        delivery_address: form.orderType === 'delivery' ? form.address.trim() : undefined,
        notes: form.notes || undefined,
        idempotency_key: idempotencyKey,
        items: items.map(ci => ({
          item_id: ci.itemId,
          quantity: ci.quantity,
          addon_ids: ci.addons.map(a => a.id),
          notes: ci.notes || '',
        })),
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');

      clearCart();
      toast.success(t('checkout.codSuccess'));
      navigate(`/order/${data.order_id}`);
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
          <Input placeholder={t('checkout.phone')} type="tel" value={form.phone} onChange={e => update('phone', e.target.value.replace(/[^0-9]/g, ''))} pattern="[0-9]*" inputMode="numeric" required />
        </div>

        {/* Delivery address */}
        {form.orderType === 'delivery' && (
          <div className="space-y-3">
            <Label className="font-display text-lg font-semibold">{t('checkout.deliveryAddress')}</Label>
            <Textarea placeholder={t('checkout.addressPlaceholder')} value={form.address} onChange={e => update('address', e.target.value)} required />
          </div>
        )}

        {/* Payment Method */}
        <div className="space-y-3">
          <Label className="font-display text-lg font-semibold">{t('checkout.paymentMethod')}</Label>
          <div className="grid grid-cols-2 gap-3">
            {/* COD - active */}
            <button
              type="button"
              onClick={() => update('paymentMethod', 'cash_on_delivery')}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 font-medium transition-colors ${
                form.paymentMethod === 'cash_on_delivery' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <Banknote className="h-5 w-5" />
              {t('checkout.payOnDelivery')}
            </button>
            {/* Online - disabled */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-border p-4 font-medium text-muted-foreground/50 cursor-not-allowed"
                >
                  <CreditCard className="h-5 w-5" />
                  {t('checkout.payOnlineComingSoon')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('checkout.onlinePaymentSoon')}</TooltipContent>
            </Tooltip>
          </div>
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
