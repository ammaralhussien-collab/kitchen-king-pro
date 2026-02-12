import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { Minus, Plus, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  prep_time_minutes: number | null;
}

interface Addon {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

const ItemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
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
      if (itemRes.data) setItem(itemRes.data);
      if (addonRes.data) setAddons(addonRes.data);
    };
    fetch();
  }, [id]);

  if (!item) return <div className="flex h-96 items-center justify-center text-muted-foreground">Loading...</div>;

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      next.has(addonId) ? next.delete(addonId) : next.add(addonId);
      return next;
    });
  };

  const selectedAddonsList = addons.filter(a => selectedAddons.has(a.id));
  const addonsTotal = selectedAddonsList.reduce((s, a) => s + a.price, 0);
  const totalPrice = (item.price + addonsTotal) * quantity;

  const handleAdd = () => {
    addItem({
      id: crypto.randomUUID(),
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      addons: selectedAddonsList.map(a => ({ id: a.id, name: a.name, price: a.price })),
      notes,
      image_url: item.image_url,
    });
    toast.success(`${item.name} added to cart`);
    navigate('/menu');
  };

  return (
    <div className="container max-w-2xl py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {item.image_url ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-muted">
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-6xl">🍽️</div>
      )}

      <div className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">{item.name}</h1>
          <span className="font-display text-2xl font-bold text-primary">${item.price.toFixed(2)}</span>
        </div>
        {item.prep_time_minutes && (
          <span className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {item.prep_time_minutes} min prep time
          </span>
        )}
        <p className="mt-3 text-muted-foreground">{item.description}</p>
      </div>

      {addons.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">Add-ons</h3>
          <div className="mt-3 space-y-3">
            {addons.map(addon => (
              <label key={addon.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedAddons.has(addon.id)} onCheckedChange={() => toggleAddon(addon.id)} />
                  <span className="text-sm font-medium">{addon.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">+${addon.price.toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Special Instructions</h3>
        <Textarea className="mt-2" placeholder="Any allergies or preferences..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center rounded-lg border border-border">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-muted-foreground hover:text-foreground"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center font-semibold">{quantity}</span>
          <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>
        </div>
        <Button onClick={handleAdd} className="flex-1 text-base font-semibold" size="lg">
          Add to Cart — ${totalPrice.toFixed(2)}
        </Button>
      </div>
    </div>
  );
};

export default ItemDetailPage;
