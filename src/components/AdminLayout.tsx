import { Link, Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Settings, ChefHat, Truck, Users, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const AdminLayout = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
      if (!data || data.length === 0) {
        navigate('/auth', { replace: true });
      } else {
        setVerified(true);
      }
    };
    verifyAccess();
  }, [user, navigate]);

  const navItems = [
    { to: '/admin/orders', label: t('admin.orders'), icon: ClipboardList },
    { to: '/admin/menu', label: t('admin.menu'), icon: ChefHat },
    { to: '/admin/dispatch', label: 'Dispatch', icon: Truck },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/settings', label: t('admin.settings'), icon: Settings },
  ];

  if (loading || !verified) return <div className="flex h-screen items-center justify-center"><span className="animate-pulse-soft text-muted-foreground">{t('app.loading')}</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-e border-border bg-card p-4 md:flex">
        <Link to="/admin/menu" className="mb-8 flex items-center gap-2 px-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold">{t('app.admin')}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                location.pathname.startsWith(to)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link to="/menu" className="mt-auto rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
          {t('app.backToMenu')}
        </Link>
      </aside>
      <div className="flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex w-full items-center justify-between">
            <span className="font-display font-bold">{t('app.admin')}</span>
            <div className="flex gap-2">
              {navItems.map(({ to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'rounded-lg p-2',
                    location.pathname.startsWith(to) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
