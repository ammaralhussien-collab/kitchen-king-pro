import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Printer } from 'lucide-react';
import type { TranslationKey } from '@/i18n/translations';

const allStatuses = ['received', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled'];

interface Order {
  id: string;
  status: string;
  order_type: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  addons: any;
  notes: string | null;
}

const AdminOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ]).then(([orderRes, itemsRes]) => {
      if (orderRes.data) setOrder(orderRes.data as any);
      if (itemsRes.data) setItems(itemsRes.data as any);
    });
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setOrder(prev => prev ? { ...prev, status } : null);
    const statusKey = `status.${status}` as TranslationKey;
    toast.success(`${t('admin.statusUpdated')} ${t(statusKey)}`);
  };

  if (!order) return <div className="flex h-96 items-center justify-center text-muted-foreground">{t('app.loading')}</div>;

  const getStatusLabel = (s: string) => {
    const key = `status.${s}` as TranslationKey;
    const val = t(key);
    return val !== key ? val : s.replace('_', ' ');
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('app.backToOrders')}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{order.customer_name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-sm text-muted-foreground">{order.order_type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="me-1 h-4 w-4" /> {t('app.print')}
          </Button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        {order.status === 'received' && (
          <>
            <Button onClick={() => updateStatus('accepted')} className="bg-accent text-accent-foreground hover:bg-accent/90">{t('admin.acceptOrder')}</Button>
            <Button variant="destructive" onClick={() => updateStatus('canceled')}>{t('admin.reject')}</Button>
          </>
        )}
        {order.status !== 'received' && order.status !== 'completed' && order.status !== 'canceled' && (
          <Select value={order.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map(s => (
                <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Contact */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.phone')}</span><span>{order.customer_phone}</span></div>
        {order.delivery_address && <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.address')}</span><span>{order.delivery_address}</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.payment')}</span><span>{order.payment_method === 'cash' ? t('checkout.cash') : t('checkout.payOnline')}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.ordered')}</span><span>{new Date(order.created_at).toLocaleString()}</span></div>
        {order.notes && <div><span className="text-muted-foreground">{t('admin.notes')}: </span><span className="italic">{order.notes}</span></div>}
      </div>

      {/* Items */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display font-semibold mb-3">{t('admin.items')}</h3>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <div>
                <span className="font-medium">{item.quantity}x {item.item_name}</span>
                {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">+ {item.addons.map((a: any) => a.name).join(', ')}</p>
                )}
                {item.notes && <p className="text-xs italic text-muted-foreground">"{item.notes}"</p>}
              </div>
              <span>{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.subtotal')}</span><span>{formatCurrency(order.subtotal)}</span></div>
          {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('checkout.deliveryFee')}</span><span>{formatCurrency(order.delivery_fee)}</span></div>}
          <div className="flex justify-between font-display font-bold text-lg"><span>{t('cart.total')}</span><span className="text-primary">{formatCurrency(order.total)}</span></div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
