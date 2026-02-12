import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, ImageIcon } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  is_open: boolean;
  delivery_radius_km: number;
  delivery_fee: number;
  minimum_order: number;
  logo_url: string | null;
  logo_height_px: number;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
}

const AdminSettingsPage = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    supabase.from('restaurants').select('*').limit(1).single().then(({ data }) => {
      if (data) setRestaurant(data as any);
    });
  }, []);

  const handleHeroUpload = async (file: File) => {
    setHeroUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `hero-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('menu-images').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      update('hero_image_url', urlData.publicUrl);
      toast.success('Hero image uploaded');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setHeroUploading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('menu-images').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      update('logo_url', urlData.publicUrl);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const save = async () => {
    if (!restaurant) return;
    setLoading(true);
    const { error } = await supabase.from('restaurants').update({
      name: restaurant.name,
      description: restaurant.description,
      phone: restaurant.phone,
      address: restaurant.address,
      is_open: restaurant.is_open,
      delivery_radius_km: restaurant.delivery_radius_km,
      delivery_fee: restaurant.delivery_fee,
      minimum_order: restaurant.minimum_order,
      logo_url: restaurant.logo_url,
      logo_height_px: restaurant.logo_height_px,
      hero_image_url: restaurant.hero_image_url,
      hero_title: restaurant.hero_title,
      hero_subtitle: restaurant.hero_subtitle,
    }).eq('id', restaurant.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(t('admin.saveSettings'));
  };

  if (!restaurant) return <div className="py-12 text-center text-muted-foreground">{t('app.loading')}</div>;

  const update = (key: keyof Restaurant, value: any) => setRestaurant(r => r ? { ...r, [key]: value } : r);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold mb-6">{t('admin.restaurantSettings')}</h1>

      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <span className="font-medium">{t('admin.restaurantOpen')}</span>
            <p className="text-xs text-muted-foreground">{t('admin.toggleOrders')}</p>
          </div>
          <Switch checked={restaurant.is_open} onCheckedChange={v => update('is_open', v)} />
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">{t('admin.logo')}</h3>
          <div>
            <Label>Restaurant Logo</Label>
            <div className="mt-1 space-y-2">
              {restaurant.logo_url && (
                <div className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                  <img src={restaurant.logo_url} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="flex gap-2">
                <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => logoFileRef.current?.click()}>
                  {logoUploading ? 'Uploading…' : <><Upload className="me-1 h-3 w-3" /> Upload</>}
                </Button>
              </div>
              <Input value={restaurant.logo_url || ''} onChange={e => update('logo_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label>Logo Height (px)</Label>
            <Input type="number" min={24} max={120} value={restaurant.logo_height_px ?? 44} onChange={e => update('logo_height_px', parseInt(e.target.value) || 44)} />
            <p className="text-xs text-muted-foreground mt-1">Min 24, Max 120. Default is 44px.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">{t('admin.general')}</h3>
          <div><Label>Restaurant Name</Label><Input value={restaurant.name} onChange={e => update('name', e.target.value)} /></div>
          <div><Label>Description</Label><Input value={restaurant.description || ''} onChange={e => update('description', e.target.value)} /></div>
          <div><Label>{t('admin.phone')}</Label><Input value={restaurant.phone || ''} onChange={e => update('phone', e.target.value)} /></div>
          <div><Label>{t('admin.address')}</Label><Input value={restaurant.address || ''} onChange={e => update('address', e.target.value)} /></div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">{t('admin.deliverySettings')}</h3>
          <div><Label>Delivery Radius (km)</Label><Input type="number" value={restaurant.delivery_radius_km} onChange={e => update('delivery_radius_km', parseFloat(e.target.value))} /></div>
          <div><Label>Delivery Fee</Label><Input type="number" step="0.01" value={restaurant.delivery_fee} onChange={e => update('delivery_fee', parseFloat(e.target.value))} /></div>
          <div><Label>Minimum Order</Label><Input type="number" step="0.01" value={restaurant.minimum_order} onChange={e => update('minimum_order', parseFloat(e.target.value))} /></div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">{t('admin.heroSection')}</h3>
          <div><Label>Hero Title</Label><Input value={restaurant.hero_title || ''} onChange={e => update('hero_title', e.target.value)} placeholder={t('hero.title')} /></div>
          <div><Label>Hero Subtitle</Label><Input value={restaurant.hero_subtitle || ''} onChange={e => update('hero_subtitle', e.target.value)} placeholder={t('hero.subtitle')} /></div>
          <div>
            <Label>Hero Image</Label>
            <div className="mt-1 space-y-2">
              {restaurant.hero_image_url && (
                <div className="relative w-full h-32 rounded-md overflow-hidden border border-border">
                  <img src={restaurant.hero_image_url} alt="Hero preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex gap-2">
                <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleHeroUpload(e.target.files[0]); }} />
                <Button type="button" variant="outline" size="sm" disabled={heroUploading} onClick={() => heroFileRef.current?.click()}>
                  {heroUploading ? 'Uploading…' : <><Upload className="me-1 h-3 w-3" /> Upload</>}
                </Button>
                {!restaurant.hero_image_url && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3 w-3" /> Or paste URL below</div>
                )}
              </div>
              <Input value={restaurant.hero_image_url || ''} onChange={e => update('hero_image_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <Button onClick={save} className="w-full" disabled={loading}>
          {loading ? t('app.saving') : t('admin.saveSettings')}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
