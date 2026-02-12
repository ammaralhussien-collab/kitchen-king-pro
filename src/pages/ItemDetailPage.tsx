import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/I18nProvider';
import { getLocalizedName, getLocalizedDesc } from '@/lib/localize';
import { Minus, Plus, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Item {
  id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
  name_ar: string | null;
  description: string | null;
  desc_en: string | null;
  desc_de: string | null;
  desc_ar: string | null;
  price: number;
  image_url: string | null;
  prep_time_minutes: number | null;
  is_offer: boolean | null;
  offer_price: number | null;
}

interface Addon {
  id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
  name_ar: string | null;
  price: number;
  is_available: boolean;
}

const ItemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t, lang, formatCurrency } = useI18n();
  const [item, setItem] = useState<Item | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [itemRes, addonRes] = await Promise.all([
        supabase.from('items').select('*').eq('id', id).single(),
        supabase.from('item_addons').select('*').eq('item_id', id).eq('is_available', true),
      ]);
      if (itemRes.data) setItem(itemRes.data as any);
      if (addonRes.data) setAddons(addonRes.data as any);
    };
    fetch();
  }, [id]);

  if (!item) return <div className="flex h-96 items-center justify-center text-muted-foreground">{t('app.loading')}</div>;

  const localName = getLocalizedName(item, lang);
  const localDesc = getLocalizedDesc(item, lang);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      next.has(addonId) ? next.delete(addonId) : next.add(addonId);
      return next;
    });
  };

  const selectedAddonsList = addons.filter(a => selectedAddons.has(a.id));
  const addonsTotal = selectedAddonsList.reduce((s, a) => s + a.price, 0);
  const effectivePrice = (item.is_offer && item.offer_price) ? item.offer_price : item.price;
  const totalPrice = (effectivePrice + addonsTotal) * quantity;

  const handleAdd = () => {
    addItem({
      id: crypto.randomUUID(),
      itemId: item.id,
      name: localName,
      price: effectivePrice,
      quantity,
      addons: selectedAddonsList.map(a => ({ id: a.id, name: getLocalizedName(a, lang), price: a.price })),
      notes,
      image_url: item.image_url,
    });
    toast.success(`${localName} ${t('item.addedToCart')}`);
    navigate('/menu');
  };

  return (
    <div className="container max-w-2xl py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('app.back')}
      </button>

      {item.image_url ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-muted">
          <img src={item.image_url} alt={localName} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-6xl">🍽️</div>
      )}

      <div className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">{localName}</h1>
          <div className="text-right">
            <span className="font-display text-2xl font-bold text-primary">{formatCurrency(effectivePrice)}</span>
            {item.is_offer && item.offer_price && (
              <span className="ms-2 text-sm text-muted-foreground line-through">{formatCurrency(item.price)}</span>
            )}
          </div>
        </div>
        {item.prep_time_minutes && (
          <span className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {item.prep_time_minutes} {t('app.min')} {t('app.prepTime')}
          </span>
        )}
        <p className="mt-3 text-muted-foreground">{localDesc}</p>
      </div>

      {addons.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">{t('item.addons')}</h3>
          <div className="mt-3 space-y-3">
            {addons.map(addon => (
              <label key={addon.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedAddons.has(addon.id)} onCheckedChange={() => toggleAddon(addon.id)} />
                  <span className="text-sm font-medium">{getLocalizedName(addon, lang)}</span>
                </div>
                <span className="text-sm text-muted-foreground">+{formatCurrency(addon.price)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">{t('item.specialInstructions')}</h3>
        <Textarea className="mt-2" placeholder={t('item.allergiesPlaceholder')} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center rounded-lg border border-border">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-muted-foreground hover:text-foreground"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center font-semibold">{quantity}</span>
          <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>
        </div>
        <Button onClick={handleAdd} className="flex-1 text-base font-semibold" size="lg">
          {t('item.addToCart')} — {formatCurrency(totalPrice)}
        </Button>
      </div>
    </div>
  );
};

export default ItemDetailPage;
