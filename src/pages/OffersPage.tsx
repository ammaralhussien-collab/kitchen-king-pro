import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/I18nProvider';
import { Plus, Clock, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import ChatOrderButton from '@/components/ChatOrderButton';

interface OfferItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  prep_time_minutes: number | null;
  is_offer: boolean;
  offer_price: number | null;
  offer_badge: string | null;
}

const OffersPage = () => {
  const [items, setItems] = useState<OfferItem[]>([]);
  const { addItem } = useCart();
  const { t, formatCurrency } = useI18n();

  useEffect(() => {
    const fetchOffers = async () => {
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .eq('is_offer', true)
        .order('sort_order');
      if (data) setItems(data);
    };
    fetchOffers();
  }, []);

  const quickAdd = (item: OfferItem) => {
    addItem({
      id: crypto.randomUUID(),
      itemId: item.id,
      name: item.name,
      price: item.offer_price ?? item.price,
      quantity: 1,
      addons: [],
      notes: '',
      image_url: item.image_url,
    });
    toast.success(`${item.name} ${t('item.addedToCart')}`);
  };

  return (
    <div>
      <div className="container py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">{t('offers.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('offers.subtitle')}</p>

        {items.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">{t('offers.empty')}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg relative"
            >
              {item.offer_badge && (
                <Badge className="absolute top-2 start-2 z-10 bg-accent text-accent-foreground">
                  <Tag className="h-3 w-3 me-1" />
                  {item.offer_badge}
                </Badge>
              )}
              <Link to={`/item/${item.id}`}>
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">🍽️</div>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/item/${item.id}`} className="font-display text-lg font-semibold text-foreground hover:text-primary transition-colors">
                      {item.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-display text-lg font-bold text-primary">
                      {formatCurrency(item.offer_price ?? item.price)}
                    </span>
                    {item.offer_price != null && item.offer_price < item.price && (
                      <span className="block text-xs text-muted-foreground line-through">
                        {formatCurrency(item.price)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {item.prep_time_minutes && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.prep_time_minutes} {t('app.min')}
                    </span>
                  )}
                  <button
                    onClick={() => quickAdd(item)}
                    className="ms-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    {t('item.add')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <ChatOrderButton />
    </div>
  );
};

export default OffersPage;
