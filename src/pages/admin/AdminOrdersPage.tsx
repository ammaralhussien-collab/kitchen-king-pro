import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  created_at: string;
}

const statuses = ['all', 'received', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled'];

const AdminOrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const fetchOrders = async () => {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter as any);
    const { data } = await query;
    if (data) setOrders(data as any);
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => [payload.new as any, ...prev]);
        setNewOrderAlert(true);
        // Play sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRl9vT19teleGFyaXhfZ2VuZXJhdGVk');
          audio.play().catch(() => {});
        } catch {}
        setTimeout(() => setNewOrderAlert(false), 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } as any : o));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold">Orders</h1>
          {newOrderAlert && (
            <span className="flex items-center gap-1 animate-pulse-soft rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              <Bell className="h-3 w-3" /> New Order!
            </span>
          )}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'All Orders' : s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {orders.map(order => (
          <Link
            key={order.id}
            to={`/admin/orders/${order.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold">{order.customer_name}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>{order.order_type}</span>
                <span>{order.customer_phone}</span>
                <span>{new Date(order.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
            <span className="font-display font-bold text-primary">${order.total.toFixed(2)}</span>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No orders found</p>
        )}
      </div>
    </div>
  );
};

export default AdminOrdersPage;
