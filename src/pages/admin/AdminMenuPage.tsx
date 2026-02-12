import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { getLocalizedName } from '@/lib/localize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Upload, ImageIcon } from 'lucide-react';

interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
  name_ar: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Item {
  id: string;
  category_id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
  name_ar: string | null;
  description: string | null;
  desc_en: string | null;
  desc_de: string | null;
  desc_ar: string | null;
  price: number;
  is_available: boolean;
  prep_time_minutes: number | null;
  image_url: string | null;
  is_offer: boolean;
  offer_price: number | null;
  offer_badge: string | null;
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, lang, formatCurrency } = useI18n();

  const fetchData = async () => {
    const [catRes, itemRes, restRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('items').select('*').order('sort_order'),
      supabase.from('restaurants').select('id').limit(1).single(),
    ]);
    if (catRes.data) {
      setCategories(catRes.data as any);
      if (!activeCategory && catRes.data.length > 0) setActiveCategory(catRes.data[0].id);
    }
    if (itemRes.data) setItems(itemRes.data as any);
    if (restRes.data) setRestaurantId(restRes.data.id);
  };

  useEffect(() => { fetchData(); }, []);

  const saveCategory = async () => {
    if (!editingCategory?.name?.trim()) return;
    const payload: any = {
      name: editingCategory.name,
      name_de: editingCategory.name_de || editingCategory.name,
      name_en: editingCategory.name_en || null,
      name_ar: editingCategory.name_ar || null,
      description: editingCategory.description,
      is_active: editingCategory.is_active,
    };
    if (editingCategory.id) {
      await supabase.from('categories').update(payload).eq('id', editingCategory.id);
    } else {
      await supabase.from('categories').insert({ ...payload, restaurant_id: restaurantId, sort_order: categories.length });
    }
    toast.success(t('app.save'));
    setCatDialogOpen(false);
    setEditingCategory(null);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    toast.success(t('app.delete'));
    fetchData();
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('menu-images').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      setEditingItem(p => ({ ...p, image_url: urlData.publicUrl }));
      toast.success(t('admin.upload'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveItem = async () => {
    if (!editingItem?.name?.trim() || !editingItem?.price) return;
    const payload: any = {
      name: editingItem.name,
      name_de: editingItem.name_de || editingItem.name,
      name_en: editingItem.name_en || null,
      name_ar: editingItem.name_ar || null,
      description: editingItem.description || null,
      desc_de: editingItem.desc_de || editingItem.description || null,
      desc_en: editingItem.desc_en || null,
      desc_ar: editingItem.desc_ar || null,
      price: editingItem.price,
      is_available: editingItem.is_available ?? true,
      prep_time_minutes: editingItem.prep_time_minutes || 15,
      image_url: editingItem.image_url || null,
      category_id: editingItem.category_id || activeCategory!,
      is_offer: editingItem.is_offer ?? false,
      offer_price: editingItem.is_offer ? (editingItem.offer_price || null) : null,
      offer_badge: editingItem.is_offer ? (editingItem.offer_badge || null) : null,
    };
    if (editingItem.id) {
      await supabase.from('items').update(payload).eq('id', editingItem.id);
    } else {
      await supabase.from('items').insert({ ...payload, sort_order: items.length });
    }
    toast.success(t('app.save'));
    setItemDialogOpen(false);
    setEditingItem(null);
    fetchData();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id);
    toast.success(t('app.delete'));
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
        <h1 className="font-display text-2xl font-bold">{t('admin.menuManagement')}</h1>
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">{t('admin.categories')}</h2>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditingCategory({ name: '', is_active: true })}>
                <Plus className="me-1 h-3 w-3" /> {t('admin.addCategory')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingCategory?.id ? t('app.edit') : t('app.add')} — {t('admin.categories')}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t('admin.categoryName')}</Label><Input value={editingCategory?.name || ''} onChange={e => setEditingCategory(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>{t('admin.nameDE')}</Label><Input value={editingCategory?.name_de || ''} onChange={e => setEditingCategory(p => ({ ...p, name_de: e.target.value }))} /></div>
                <div><Label>{t('admin.nameEN')}</Label><Input value={editingCategory?.name_en || ''} onChange={e => setEditingCategory(p => ({ ...p, name_en: e.target.value }))} /></div>
                <div><Label>{t('admin.nameAR')}</Label><Input value={editingCategory?.name_ar || ''} onChange={e => setEditingCategory(p => ({ ...p, name_ar: e.target.value }))} /></div>
                <div><Label>{t('admin.categoryDesc')}</Label><Input value={editingCategory?.description || ''} onChange={e => setEditingCategory(p => ({ ...p, description: e.target.value }))} /></div>
                <Button onClick={saveCategory} className="w-full">{t('app.save')}</Button>
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
                {getLocalizedName(cat, lang)}
              </button>
              <button onClick={() => { setEditingCategory(cat); setCatDialogOpen(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => deleteCategory(cat.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold">{t('admin.items')}</h2>
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingItem({ name: '', price: 0, is_available: true, category_id: activeCategory || '' })}>
              <Plus className="me-1 h-3 w-3" /> {t('admin.addItem')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingItem?.id ? t('app.edit') : t('app.add')} — {t('admin.items')}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
              <div><Label>{t('admin.itemName')}</Label><Input value={editingItem?.name || ''} onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>{t('admin.nameDE')}</Label><Input value={editingItem?.name_de || ''} onChange={e => setEditingItem(p => ({ ...p, name_de: e.target.value }))} /></div>
                <div><Label>{t('admin.nameEN')}</Label><Input value={editingItem?.name_en || ''} onChange={e => setEditingItem(p => ({ ...p, name_en: e.target.value }))} /></div>
                <div><Label>{t('admin.nameAR')}</Label><Input value={editingItem?.name_ar || ''} onChange={e => setEditingItem(p => ({ ...p, name_ar: e.target.value }))} /></div>
              </div>
              <div><Label>{t('admin.itemDesc')}</Label><Textarea value={editingItem?.description || ''} onChange={e => setEditingItem(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>{t('admin.descDE')}</Label><Input value={editingItem?.desc_de || ''} onChange={e => setEditingItem(p => ({ ...p, desc_de: e.target.value }))} /></div>
                <div><Label>{t('admin.descEN')}</Label><Input value={editingItem?.desc_en || ''} onChange={e => setEditingItem(p => ({ ...p, desc_en: e.target.value }))} /></div>
                <div><Label>{t('admin.descAR')}</Label><Input value={editingItem?.desc_ar || ''} onChange={e => setEditingItem(p => ({ ...p, desc_ar: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('admin.price')}</Label><Input type="number" step="0.01" value={editingItem?.price || ''} onChange={e => setEditingItem(p => ({ ...p, price: parseFloat(e.target.value) }))} /></div>
                <div><Label>{t('admin.prepTime')}</Label><Input type="number" value={editingItem?.prep_time_minutes || ''} onChange={e => setEditingItem(p => ({ ...p, prep_time_minutes: parseInt(e.target.value) }))} /></div>
              </div>
              <div>
                <Label>{t('admin.category')}</Label>
                <Select value={editingItem?.category_id || ''} onValueChange={v => setEditingItem(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('admin.selectCategory')} /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{getLocalizedName(cat, lang)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('admin.image')}</Label>
                <div className="mt-1 space-y-2">
                  {editingItem?.image_url && (
                    <div className="relative w-full h-32 rounded-md overflow-hidden border border-border">
                      <img src={editingItem.image_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? t('admin.uploading') : <><Upload className="me-1 h-3 w-3" /> {t('admin.upload')}</>}
                    </Button>
                    {!editingItem?.image_url && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" /> {t('admin.orPasteUrl')}
                      </div>
                    )}
                  </div>
                  <Input
                    value={editingItem?.image_url || ''}
                    onChange={e => setEditingItem(p => ({ ...p, image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label>{t('admin.offer')}</Label>
                  <Switch checked={editingItem?.is_offer ?? false} onCheckedChange={v => setEditingItem(p => ({ ...p, is_offer: v }))} />
                </div>
                {editingItem?.is_offer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t('admin.offerPrice')}</Label><Input type="number" step="0.01" value={editingItem?.offer_price ?? ''} onChange={e => setEditingItem(p => ({ ...p, offer_price: e.target.value ? parseFloat(e.target.value) : null }))} /></div>
                    <div><Label>{t('admin.offerBadge')}</Label><Input value={editingItem?.offer_badge ?? ''} onChange={e => setEditingItem(p => ({ ...p, offer_badge: e.target.value }))} placeholder="z.B. 20% RABATT" /></div>
                  </div>
                )}
              </div>
              <Button onClick={saveItem} className="w-full">{t('app.save')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filteredItems.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              {item.image_url && (
                <img src={item.image_url} alt={getLocalizedName(item, lang)} className="h-10 w-10 rounded object-cover" />
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium">{getLocalizedName(item, lang)}</span>
                {item.is_offer && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">{t('admin.offer')}</span>
                )}
                <span className="text-sm text-primary font-semibold">{formatCurrency(item.price)}</span>
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
          <p className="py-8 text-center text-muted-foreground">{t('admin.noItems')}</p>
        )}
      </div>
    </div>
  );
};

export default AdminMenuPage;
