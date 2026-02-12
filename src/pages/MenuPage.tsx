import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { Plus, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import heroImgFallback from '@/assets/hero-restaurant.jpg';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Item {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  prep_time_minutes: number | null;
}

interface HeroData {
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
}

const MenuPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hero, setHero] = useState<HeroData>({ hero_image_url: null, hero_title: null, hero_subtitle: null });
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      const [catRes, itemRes, restRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('items').select('*').eq('is_available', true).order('sort_order'),
        supabase.from('restaurants').select('hero_image_url, hero_title, hero_subtitle').limit(1).single(),
      ]);
      if (catRes.data) {
        setCategories(catRes.data);
        if (catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
      }
      if (itemRes.data) setItems(itemRes.data);
      if (restRes.data) setHero(restRes.data);
    };
    fetchData();
  }, []);

  const quickAdd = (item: Item) => {
    addItem({
      id: crypto.randomUUID(),
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      addons: [],
      notes: '',
      image_url: item.image_url,
    });
    toast.success(`${item.name} added to cart`);
  };

  const filteredItems = activeCategory ? items.filter(i => i.category_id === activeCategory) : items;

  return (
    <div>
      {/* Hero */}
      <div className="relative h-48 overflow-hidden md:h-64">
        <img src={hero.hero_image_url || heroImgFallback} alt="Restaurant" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0 container">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">{hero.hero_title || 'Our Menu'}</h1>
          <p className="mt-1 text-muted-foreground">{hero.hero_subtitle || 'Authentic Italian cuisine, made with love'}</p>
        </div>
      </div>

      <div className="container py-6">
        {/* Category tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg"
            >
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
                  <span className="shrink-0 font-display text-lg font-bold text-primary">${item.price.toFixed(2)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {item.prep_time_minutes && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.prep_time_minutes} min
                    </span>
                  )}
                  <button
                    onClick={() => quickAdd(item)}
                    className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuPage;
