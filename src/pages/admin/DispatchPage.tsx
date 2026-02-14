import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Truck, User } from 'lucide-react';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  total: number;
  status: string;
  delivery_status: string;
  assigned_driver_id: string | null;
  created_at: string;
  order_type: string;
}

interface Driver {
  user_id: string;
  email: string;
}

const DispatchPage = () => {
  const { user, loading, hasRole } = useAuth();
  const { t, formatCurrency } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const canAccess = hasRole('admin') || hasRole('staff');

  useEffect(() => {
    if (!canAccess) return;
    fetchOrders();
    fetchDrivers();
  }, [canAccess]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('order_type', 'delivery')
      .order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver');
    if (data) {
      // We only have user_id from user_roles; display shortened ID as label
      setDrivers(data.map(d => ({ user_id: d.user_id, email: d.user_id.slice(0, 8) })));
    }
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    setAssigning(orderId);
    const { error } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: driverId,
        delivery_status: 'assigned',
      } as any)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to assign driver');
    } else {
      toast.success('Driver assigned ✅');
      fetchOrders();
    }
    setAssigning(null);
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user || !canAccess) return <Navigate to="/auth" replace />;

  const getDeliveryBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      assigned: 'bg-blue-100 text-blue-800',
      out_for_delivery: 'bg-amber-100 text-amber-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Dispatch</h1>
      </div>

      <div className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{order.customer_name}</span>
                  <StatusBadge status={order.status} />
                  {getDeliveryBadge(order.delivery_status)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground space-x-3">
                  <span>{order.customer_phone}</span>
                  <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                {order.delivery_address && (
                  <p className="mt-1 text-sm text-muted-foreground">{order.delivery_address}</p>
                )}
              </div>
              <span className="font-display font-bold text-primary">{formatCurrency(order.total)}</span>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select
                value={order.assigned_driver_id || ''}
                onValueChange={(val) => assignDriver(order.id, val)}
                disabled={assigning === order.id}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assign driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      Driver {d.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No delivery orders yet.</p>
        )}
      </div>
    </div>
  );
};

export default DispatchPage;
