import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChefHat, Clock, Phone, MapPin, UtensilsCrossed, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranslationKey } from '@/i18n/translations';

interface KitchenOrder {
  id: string;
  status: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  items_snapshot: any;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  addons: any;
  notes: string | null;
}

const KitchenDisplayPage = () => {
  const { user, loading, hasRole } = useAuth();
  const { t, formatCurrency } = useI18n();
  const canAccess = hasRole('admin') || hasRole('staff');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItemRow[]>>({});
  const prevOrderIds = useRef<Set<string>>(new Set());

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['received', 'preparing', 'ready'])
      .order('created_at', { ascending: true });
    if (data) {
      setOrders(data as any);
      // Fetch items for all orders
      const ids = (data as any[]).map((o: any) => o.id);
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', ids);
        if (items) {
          const grouped: Record<string, OrderItemRow[]> = {};
          (items as any[]).forEach((item: any) => {
            if (!grouped[item.order_id]) grouped[item.order_id] = [];
            grouped[item.order_id].push(item);
          });
          setOrderItems(grouped);
        }
      }
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchOrders();
  }, [canAccess]);

  // Real-time subscription
  useEffect(() => {
    if (!canAccess) return;
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as any;
        if (['received', 'preparing', 'ready'].includes(newOrder.status)) {
          setOrders(prev => [...prev, newOrder]);
          // Play notification sound for new orders
          if (newOrder.status === 'received') {
            playNotificationSound();
            toast.success(t('admin.newOrder'), { duration: 5000 });
          }
          // Fetch items for this new order
          supabase.from('order_items').select('*').eq('order_id', newOrder.id).then(({ data }) => {
            if (data) {
              setOrderItems(prev => ({ ...prev, [newOrder.id]: data as any }));
            }
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as any;
        if (['received', 'preparing', 'ready'].includes(updated.status)) {
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) return prev.map(o => o.id === updated.id ? { ...o, ...updated } : o);
            return [...prev, updated];
          });
        } else {
          // Remove from kitchen view if status changed to completed/canceled etc
          setOrders(prev => prev.filter(o => o.id !== updated.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [canAccess]);

  const playNotificationSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as any })
      .eq('id', orderId);
    if (error) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">{t('app.loading')}</div>;
  if (!user || !canAccess) return <Navigate to="/auth" replace />;

  const received = orders.filter(o => o.status === 'received');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready = orders.filter(o => o.status === 'ready');

  const getStatusLabel = (s: string) => {
    const key = `status.${s}` as TranslationKey;
    const val = t(key);
    return val !== key ? val : s.replace('_', ' ');
  };

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return '<1m';
    return `${diff}m`;
  };

  const OrderCard = ({ order, actions }: { order: KitchenOrder; actions: React.ReactNode }) => {
    const items = orderItems[order.id] || [];
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="rounded-xl border border-border bg-card p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-sm">#{order.id.slice(0, 6).toUpperCase()}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {timeSince(order.created_at)}
          </span>
        </div>

        {/* Customer */}
        <div className="space-y-1">
          <div className="font-medium text-sm">{order.customer_name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" /> {order.customer_phone}
          </div>
          <div className="flex items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              order.order_type === 'delivery' 
                ? 'bg-status-delivery/15 text-status-delivery' 
                : 'bg-status-ready/15 text-status-ready'
            }`}>
              {order.order_type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1 border-t border-border pt-2">
          {items.map(item => (
            <div key={item.id} className="text-sm">
              <span className="font-semibold">{item.quantity}×</span> {item.item_name}
              {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                <span className="text-xs text-muted-foreground"> + {item.addons.map((a: any) => a.name).join(', ')}</span>
              )}
              {item.notes && <p className="text-xs italic text-muted-foreground">"{item.notes}"</p>}
            </div>
          ))}
          {items.length === 0 && order.items_snapshot && (
            <p className="text-xs text-muted-foreground">Snapshot available</p>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="rounded-lg bg-muted p-2 text-xs italic text-muted-foreground">
            📝 {order.notes}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">{t('cart.total')}</span>
          <span className="font-display font-bold text-primary">{formatCurrency(order.total)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {actions}
        </div>
      </motion.div>
    );
  };

  const Column = ({ title, icon, orders: columnOrders, color, children }: {
    title: string;
    icon: React.ReactNode;
    orders: KitchenOrder[];
    color: string;
    children: (order: KitchenOrder) => React.ReactNode;
  }) => (
    <div className="flex-1 min-w-[300px]">
      <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 ${color}`}>
        {icon}
        <span className="font-display font-bold">{title}</span>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-bold">{columnOrders.length}</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence>
          {columnOrders.map(order => (
            <div key={order.id}>{children(order)}</div>
          ))}
        </AnimatePresence>
        {columnOrders.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <ChefHat className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl font-bold">Kitchen Display</h1>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        <Column
          title={`New (${getStatusLabel('received')})`}
          icon={<UtensilsCrossed className="h-5 w-5" />}
          orders={received}
          color="bg-status-received/15 text-status-received"
        >
          {(order) => (
            <OrderCard
              order={order}
              actions={
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => updateStatus(order.id, 'preparing')}
                >
                  ▶ Start
                </Button>
              }
            />
          )}
        </Column>

        <Column
          title={`Preparing (${getStatusLabel('preparing')})`}
          icon={<ChefHat className="h-5 w-5" />}
          orders={preparing}
          color="bg-status-preparing/15 text-status-preparing"
        >
          {(order) => (
            <OrderCard
              order={order}
              actions={
                <Button
                  size="sm"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => updateStatus(order.id, 'ready')}
                >
                  ✅ Ready
                </Button>
              }
            />
          )}
        </Column>

        <Column
          title={`Ready (${getStatusLabel('ready')})`}
          icon={<Clock className="h-5 w-5" />}
          orders={ready}
          color="bg-status-ready/15 text-status-ready"
        >
          {(order) => (
            <OrderCard
              order={order}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(order.id, 'preparing')}
                >
                  <ArrowLeft className="h-3 w-3 me-1" /> Back
                </Button>
              }
            />
          )}
        </Column>
      </div>
    </div>
  );
};

export default KitchenDisplayPage;
