import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

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
}

const AdminSettingsPage = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('restaurants').select('*').limit(1).single().then(({ data }) => {
      if (data) setRestaurant(data as any);
    });
  }, []);

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
    }).eq('id', restaurant.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Settings saved!');
  };

  if (!restaurant) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  const update = (key: keyof Restaurant, value: any) => setRestaurant(r => r ? { ...r, [key]: value } : r);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold mb-6">Restaurant Settings</h1>

      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <span className="font-medium">Restaurant Open</span>
            <p className="text-xs text-muted-foreground">Toggle to accept orders</p>
          </div>
          <Switch checked={restaurant.is_open} onCheckedChange={v => update('is_open', v)} />
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">General</h3>
          <div><Label>Restaurant Name</Label><Input value={restaurant.name} onChange={e => update('name', e.target.value)} /></div>
          <div><Label>Description</Label><Input value={restaurant.description || ''} onChange={e => update('description', e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={restaurant.phone || ''} onChange={e => update('phone', e.target.value)} /></div>
          <div><Label>Address</Label><Input value={restaurant.address || ''} onChange={e => update('address', e.target.value)} /></div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold">Delivery</h3>
          <div><Label>Delivery Radius (km)</Label><Input type="number" value={restaurant.delivery_radius_km} onChange={e => update('delivery_radius_km', parseFloat(e.target.value))} /></div>
          <div><Label>Delivery Fee ($)</Label><Input type="number" step="0.01" value={restaurant.delivery_fee} onChange={e => update('delivery_fee', parseFloat(e.target.value))} /></div>
          <div><Label>Minimum Order ($)</Label><Input type="number" step="0.01" value={restaurant.minimum_order} onChange={e => update('minimum_order', parseFloat(e.target.value))} /></div>
        </div>

        <Button onClick={save} className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
