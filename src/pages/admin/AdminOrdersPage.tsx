import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, Truck, Check, X, Package, Search, Archive } from 'lucide-react';
import { toast } from 'sonner';
import type { TranslationKey } from '@/i18n/translations';

interface Order {
  id: string;
  status: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  total: number;
  created_at: string;
  delivered_at: string | null;
  delivery_status: string;
  assigned_driver_id: string | null;
}

interface DriverOption {
  user_id: string;
  label: string;
}

const statuses = ['all', 'received', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled'];

const AdminOrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [archiveDatePreset, setArchiveDatePreset] = useState('today');
  const [archiveDateFrom, setArchiveDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [archiveDateTo, setArchiveDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const { t, formatCurrency } = useI18n();
  const { hasRole } = useAuth();
  const canManage = hasRole('admin') || hasRole('staff');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build driver label map for search
  const driverMap = useMemo(() => {
    const m = new Map<string, string>();
    drivers.forEach(d => m.set(d.user_id, d.label));
    return m;
  }, [drivers]);

  const filterBySearch = useCallback((list: Order[]) => {
    if (!debouncedSearch.trim()) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter(o => {
      const driverName = o.assigned_driver_id ? (driverMap.get(o.assigned_driver_id) || '') : '';
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        (o.delivery_address || '').toLowerCase().includes(q) ||
        driverName.toLowerCase().includes(q)
      );
    });
  }, [debouncedSearch, driverMap]);

  const fetchOrders = async () => {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter as any);
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    query = query.gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
    const { data } = await query;
    if (data) setOrders(data as any);
  };

  const fetchDeliveredOrders = async () => {
    let fromDate: string, toDate: string;
    const now = new Date();
    if (archiveDatePreset === 'today') {
      fromDate = now.toISOString().slice(0, 10);
      toDate = fromDate;
    } else if (archiveDatePreset === '7days') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      fromDate = d.toISOString().slice(0, 10);
      toDate = now.toISOString().slice(0, 10);
    } else if (archiveDatePreset === 'month') {
      fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      toDate = now.toISOString().slice(0, 10);
    } else {
      fromDate = archiveDateFrom;
      toDate = archiveDateTo;
    }
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_status', 'delivered')
      .gte('delivered_at', from.toISOString())
      .lte('delivered_at', to.toISOString())
      .order('delivered_at', { ascending: false });
    if (data) setDeliveredOrders(data as any);
  };

  const fetchDrivers = async () => {
    const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'driver');
    if (!roleData?.length) return;
    const ids = roleData.map(d => d.user_id);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
    const map = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    setDrivers(ids.map(uid => ({ user_id: uid, label: map.get(uid) || uid.slice(0, 8) })));
  };

  useEffect(() => { fetchOrders(); }, [filter, dateFrom, dateTo]);
  useEffect(() => { if (activeTab === 'delivered') fetchDeliveredOrders(); }, [activeTab, archiveDatePreset, archiveDateFrom, archiveDateTo]);
  useEffect(() => { if (canManage) fetchDrivers(); }, [canManage]);

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => [payload.new as any, ...prev]);
        setNewOrderAlert(true);
        setTimeout(() => setNewOrderAlert(false), 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } as any : o));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateOrder = async (orderId: string, updates: Record<string, any>) => {
    // If marking delivered, set delivered_at
    if (updates.delivery_status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }
    const { error } = await supabase.from('orders').update(updates as any).eq('id', orderId);
    if (error) { toast.error(error.message); return; }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
    toast.success(t('admin.statusUpdated'));
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    await updateOrder(orderId, { assigned_driver_id: driverId, delivery_status: 'assigned' });
  };

  const getStatusLabel = (s: string) => {
    if (s === 'all') return t('admin.allOrders');
    const key = `status.${s}` as TranslationKey;
    const val = t(key);
    return val !== key ? val : s.replace('_', ' ');
  };

  const getDeliveryStatusLabel = (s: string) => s.replace(/_/g, ' ');

  const counts: Record<string, number> = {};
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  const filteredOrders = filterBySearch(orders);
  const filteredDelivered = filterBySearch(deliveredOrders);

  const renderOrderCard = (order: Order) => (
    <div
      key={order.id}
      className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-4">
        <Link to={`/admin/orders/${order.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold">{order.customer_name}</span>
            <StatusBadge status={order.status} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              order.order_type === 'delivery'
                ? 'bg-status-delivery/15 text-status-delivery'
                : 'bg-status-ready/15 text-status-ready'
            }`}>
              {order.order_type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{order.customer_phone}</span>
            <span>{new Date(order.created_at).toLocaleTimeString()}</span>
            <span className="font-display font-bold text-primary">{formatCurrency(order.total)}</span>
          </div>
        </Link>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {order.order_type === 'delivery' && (
              <>
                <Select
                  value={order.assigned_driver_id || ''}
                  onValueChange={(val) => assignDriver(order.id, val)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Assign driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.user_id} value={d.user_id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  order.delivery_status === 'out_for_delivery' ? 'bg-amber-100 text-amber-800' :
                  order.delivery_status === 'delivered' ? 'bg-green-100 text-green-800' :
                  order.delivery_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {getDeliveryStatusLabel(order.delivery_status)}
                </span>
                {order.assigned_driver_id && order.delivery_status !== 'out_for_delivery' && order.delivery_status !== 'delivered' && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                    onClick={() => updateOrder(order.id, { delivery_status: 'out_for_delivery' })}>
                    <Truck className="h-3 w-3" /> Out
                  </Button>
                )}
                {order.delivery_status === 'out_for_delivery' && (
                  <Button size="sm" className="h-8 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => updateOrder(order.id, { delivery_status: 'delivered', status: 'completed' })}>
                    <Package className="h-3 w-3" /> Delivered
                  </Button>
                )}
              </>
            )}
            {order.status !== 'completed' && order.status !== 'canceled' && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                  onClick={() => updateOrder(order.id, { status: 'completed' })}>
                  <Check className="h-3 w-3" /> Complete
                </Button>
                <Button size="sm" variant="destructive" className="h-8 text-xs gap-1"
                  onClick={() => updateOrder(order.id, { status: 'canceled' })}>
                  <X className="h-3 w-3" /> Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold">{t('admin.orders')}</h1>
          {newOrderAlert && (
            <span className="flex items-center gap-1 animate-pulse rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              <Bell className="h-3 w-3" /> {t('admin.newOrder')}
            </span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search orders..."
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Orders</TabsTrigger>
          <TabsTrigger value="delivered" className="gap-1">
            <Archive className="h-3.5 w-3.5" /> Delivered
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {/* Date range */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 text-xs" />
            <span className="text-muted-foreground text-xs">→</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 text-xs" />
          </div>

          {/* Status tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {getStatusLabel(s)}
                {s !== 'all' && counts[s] ? (
                  <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-[10px] font-bold">
                    {counts[s]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredOrders.map(renderOrderCard)}
            {filteredOrders.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">{t('admin.noOrders')}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="delivered">
          {/* Archive date presets */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {[
              { value: 'today', label: 'Today' },
              { value: '7days', label: 'Last 7 days' },
              { value: 'month', label: 'This month' },
              { value: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setArchiveDatePreset(p.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  archiveDatePreset === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
            {archiveDatePreset === 'custom' && (
              <>
                <Input type="date" value={archiveDateFrom} onChange={e => setArchiveDateFrom(e.target.value)} className="w-36 text-xs" />
                <span className="text-muted-foreground text-xs">→</span>
                <Input type="date" value={archiveDateTo} onChange={e => setArchiveDateTo(e.target.value)} className="w-36 text-xs" />
              </>
            )}
          </div>

          <div className="space-y-3">
            {filteredDelivered.map(order => (
              <div key={order.id} className="rounded-xl border border-border bg-card p-4">
                <Link to={`/admin/orders/${order.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold">{order.customer_name}</span>
                        <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[10px] font-medium">delivered</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          order.order_type === 'delivery'
                            ? 'bg-status-delivery/15 text-status-delivery'
                            : 'bg-status-ready/15 text-status-ready'
                        }`}>
                          {order.order_type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{order.customer_phone}</span>
                        <span>{order.delivered_at ? new Date(order.delivered_at).toLocaleString() : new Date(order.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="font-display font-bold text-primary">{formatCurrency(order.total)}</span>
                  </div>
                </Link>
              </div>
            ))}
            {filteredDelivered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No delivered orders in this period.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrdersPage;
