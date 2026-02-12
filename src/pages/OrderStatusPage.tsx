import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Check, Clock, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidE164, type WhatsAppOrderData } from '@/lib/whatsapp';

const statusSteps = ['received', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'];
const pickupSteps = ['received', 'accepted', 'preparing', 'ready', 'completed'];

interface Order {
  id: string;
  status: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  delivery_address: string | null;
  created_at: string;
  scheduled_time: string | null;
  payment_method: string;
  notes: string | null;
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

interface RestaurantInfo {
  name: string;
  phone: string | null;
}

const OrderStatusPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, formatCurrency } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id),
      ]);
      if (orderRes.data) {
        setOrder(orderRes.data as any);
        const { data: rest } = await supabase.from('restaurants').select('name, phone').eq('id', (orderRes.data as any).restaurant_id).single();
        if (rest) setRestaurant(rest);
      }
      if (itemsRes.data) setOrderItems(itemsRes.data as any);
    };
    fetchOrder();

    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...payload.new } as any : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (!order) return <div className="flex h-96 items-center justify-center text-muted-foreground">{t('app.loading')}</div>;

  const steps = order.order_type === 'delivery' ? statusSteps : pickupSteps;
  const currentIdx = steps.indexOf(order.status);
  const isCanceled = order.status === 'canceled';

  return (
    <div className="container max-w-2xl py-8">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">{t('order.placed')}</h1>
        <p className="mt-1 text-muted-foreground">{t('order.thankYou')}, {order.customer_name}</p>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Progress tracker */}
      {!isCanceled && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-1 flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{ scale: i === currentIdx ? 1.2 : 1 }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    i <= currentIdx
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < currentIdx ? <Check className="h-4 w-4" /> : i + 1}
                </motion.div>
                <span className="mt-1 text-[10px] capitalize text-muted-foreground hidden sm:block">{step.replace('_', ' ')}</span>
                {i < steps.length - 1 && (
                  <div className="absolute" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex">
            {steps.slice(0, -1).map((_, i) => (
              <div key={i} className={`h-1 flex-1 mx-1 rounded ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Order details */}
      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display font-semibold">{t('order.details')}</h3>
        <div className="mt-3 space-y-2">
          {orderItems.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.item_name}</span>
              <span className="text-muted-foreground">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-display font-bold">
          <span>{t('cart.total')}</span>
          <span className="text-primary">{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* WhatsApp button */}
      {restaurant?.phone && isValidE164(restaurant.phone) && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const waData: WhatsAppOrderData = {
                orderId: order.id,
                restaurantName: restaurant.name,
                orderType: order.order_type as 'delivery' | 'pickup',
                scheduledTime: order.scheduled_time,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                items: orderItems.map(oi => ({
                  name: oi.item_name,
                  quantity: oi.quantity,
                  unitPrice: oi.unit_price,
                  addons: Array.isArray(oi.addons) ? oi.addons.map((a: any) => ({ name: a.name, price: a.price })) : [],
                  notes: oi.notes,
                  total: oi.total,
                })),
                subtotal: order.subtotal,
                deliveryFee: order.delivery_fee,
                total: order.total,
                paymentMethod: order.payment_method,
              };
              window.open(buildWhatsAppUrl(restaurant.phone!, buildWhatsAppMessage(waData)), '_blank');
            }}
          >
            <MessageCircle className="h-4 w-4" />
            {t('order.openWhatsApp')}
          </Button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {t('order.orderPlacedAt')} {new Date(order.created_at).toLocaleString()}
      </div>
    </div>
  );
};

export default OrderStatusPage;
