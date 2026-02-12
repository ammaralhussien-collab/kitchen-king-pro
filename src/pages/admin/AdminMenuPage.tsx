import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';

interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Item {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  prep_time_minutes: number | null;
  image_url: string | null;
}

const AdminMenuPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<Item> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const fetchData = async () => {
    const [catRes, itemRes, restRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('items').select('*').order('sort_order'),
      supabase.from('restaurants').select('id').limit(1).single(),
    ]);
    if (catRes.data) {
      setCategories(catRes.data);
      if (!activeCategory && catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
    }
    if (itemRes.data) setItems(itemRes.data);
    if (restRes.data) setRestaurantId(restRes.data.id);
  };

  useEffect(() => { fetchData(); }, []);

  const saveCategory = async () => {
    if (!editingCategory?.name?.trim()) return;
    if (editingCategory.id) {
      await supabase.from('categories').update({ name: editingCategory.name, description: editingCategory.description, is_active: editingCategory.is_active }).eq('id', editingCategory.id);
    } else {
      await supabase.from('categories').insert({ name: editingCategory.name, description: editingCategory.description || null, restaurant_id: restaurantId, sort_order: categories.length });
    }
    toast.success('Category saved');
    setCatDialogOpen(false);
    setEditingCategory(null);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    toast.success('Category deleted');
    fetchData();
  };

  const saveItem = async () => {
    if (!editingItem?.name?.trim() || !editingItem?.price) return;
    const payload = {
      name: editingItem.name,
      description: editingItem.description || null,
      price: editingItem.price,
      is_available: editingItem.is_available ?? true,
      prep_time_minutes: editingItem.prep_time_minutes || 15,
      image_url: editingItem.image_url || null,
      category_id: editingItem.category_id || activeCategory!,
    };
    if (editingItem.id) {
      await supabase.from('items').update(payload).eq('id', editingItem.id);
    } else {
      await supabase.from('items').insert({ ...payload, sort_order: items.length });
    }
    toast.success('Item saved');
    setItemDialogOpen(false);
    setEditingItem(null);
    fetchData();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id);
    toast.success('Item deleted');
    fetchData();
  };

  const toggleAvailability = async (item: Item) => {
    await supabase.from('items').update({ is_available: !item.is_available }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  };

  const filteredItems = activeCategory ? items.filter(i => i.category_id === activeCategory) : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Menu Management</h1>
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Categories</h2>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditingCategory({ name: '', is_active: true })}>
                <Plus className="mr-1 h-3 w-3" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingCategory?.id ? 'Edit' : 'New'} Category</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editingCategory?.name || ''} onChange={e => setEditingCategory(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Description</Label><Input value={editingCategory?.description || ''} onChange={e => setEditingCategory(p => ({ ...p, description: e.target.value }))} /></div>
                <Button onClick={saveCategory} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {cat.name}
              </button>
              <button onClick={() => { setEditingCategory(cat); setCatDialogOpen(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => deleteCategory(cat.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold">Items</h2>
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingItem({ name: '', price: 0, is_available: true, category_id: activeCategory || '' })}>
              <Plus className="mr-1 h-3 w-3" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem?.id ? 'Edit' : 'New'} Item</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div><Label>Name</Label><Input value={editingItem?.name || ''} onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Description</Label><Textarea value={editingItem?.description || ''} onChange={e => setEditingItem(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Price</Label><Input type="number" step="0.01" value={editingItem?.price || ''} onChange={e => setEditingItem(p => ({ ...p, price: parseFloat(e.target.value) }))} /></div>
              <div><Label>Prep Time (min)</Label><Input type="number" value={editingItem?.prep_time_minutes || ''} onChange={e => setEditingItem(p => ({ ...p, prep_time_minutes: parseInt(e.target.value) }))} /></div>
              <div><Label>Image URL</Label><Input value={editingItem?.image_url || ''} onChange={e => setEditingItem(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." /></div>
              <Button onClick={saveItem} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filteredItems.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-sm text-primary font-semibold">${item.price.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={item.is_available} onCheckedChange={() => toggleAvailability(item)} />
              <button onClick={() => { setEditingItem(item); setItemDialogOpen(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => deleteItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No items in this category</p>
        )}
      </div>
    </div>
  );
};

export default AdminMenuPage;
