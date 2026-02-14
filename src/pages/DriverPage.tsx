import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Phone, Truck, CheckCircle2, Navigation } from 'lucide-react';

interface DriverOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  notes: string | null;
  total: number;
  payment_method: string;
  delivery_status: string;
  payment_status: string;
}

const paymentLabels: Record<string, string> = {
  cash: 'نقداً',
  cash_on_delivery: 'الدفع عند التسليم',
  online: 'أونلاين',
};

const DriverPage = () => {
  const { user, loading, hasRole } = useAuth();
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const isDriver = hasRole('driver');

  useEffect(() => {
    if (!user || !isDriver) return;
    fetchOrders();

    const channel = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `assigned_driver_id=eq.${user.id}` }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isDriver]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, delivery_address, notes, total, payment_method, delivery_status, payment_status')
      .eq('assigned_driver_id', user!.id)
      .in('delivery_status', ['assigned', 'out_for_delivery'])
      .order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  const updateStatus = async (orderId: string, newStatus: string, extras?: Record<string, any>) => {
    setUpdating(orderId);
    const updateData: any = { delivery_status: newStatus, ...extras };
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) {
      toast.error('صار في مشكلة… جرّب مرة تانية');
    } else {
      toast.success('تم تحديث الحالة ✅');
      fetchOrders();
    }
    setUpdating(null);
  };

  const startDelivery = (id: string) => updateStatus(id, 'out_for_delivery');

  const markDelivered = (order: DriverOrder) => {
    const extras: Record<string, any> = { delivered_at: new Date().toISOString() };
    if (order.payment_method === 'cash_on_delivery' || order.payment_method === 'cash') {
      extras.payment_status = 'paid';
    }
    updateStatus(order.id, 'delivered', extras);
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`);
  };

  if (loading) {
    return (
      <div dir="rtl" lang="ar" className="flex h-screen items-center justify-center bg-background">
        <span className="animate-pulse text-muted-foreground">جاري التحميل...</span>
      </div>
    );
  }

  if (!user || !isDriver) {
    return (
      <div dir="rtl" lang="ar" className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Truck className="mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold text-foreground">ما عندك صلاحية تدخل لهون</h1>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-bold">طلبات التوصيل</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-lg py-4 space-y-4">
        {orders.length === 0 && (
          <div className="py-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">ما في طلبات مكلّف فيها هلّق</p>
          </div>
        )}

        {orders.map(order => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            {/* Order info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-foreground">{order.customer_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  order.delivery_status === 'assigned' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.delivery_status === 'assigned' ? 'بالانتظار' : 'جاري التوصيل'}
                </span>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  <span>رقم الموبايل: <span dir="ltr" className="inline-block">{order.customer_phone}</span></span>
                </div>
                {order.delivery_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>العنوان: {order.delivery_address}</span>
                  </div>
                )}
                {order.notes && (
                  <div className="flex items-start gap-2">
                    <span className="shrink-0">📝</span>
                    <span>ملاحظات: {order.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">طريقة الدفع: {paymentLabels[order.payment_method] || order.payment_method}</span>
                <span className="font-display font-bold text-primary" dir="ltr">الإجمالي: €{Number(order.total).toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              {order.delivery_address && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openMaps(order.delivery_address!)}
                >
                  <Navigation className="h-4 w-4" />
                  افتح بالخريطة
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => callCustomer(order.customer_phone)}
              >
                <Phone className="h-4 w-4" />
                اتصل بالزبون
              </Button>

              {order.delivery_status === 'assigned' && (
                <Button
                  size="sm"
                  className="col-span-2 gap-1.5"
                  disabled={updating === order.id}
                  onClick={() => startDelivery(order.id)}
                >
                  <Truck className="h-4 w-4" />
                  بلّشت التوصيل
                </Button>
              )}

              {order.delivery_status === 'out_for_delivery' && (
                <Button
                  size="sm"
                  className="col-span-2 gap-1.5 bg-green-600 hover:bg-green-700"
                  disabled={updating === order.id}
                  onClick={() => markDelivered(order)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تم التسليم
                </Button>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default DriverPage;
