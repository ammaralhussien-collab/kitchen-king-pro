import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, Settings, ChefHat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/menu', label: 'Menu', icon: ChefHat },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const AdminLayout = () => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex h-screen items-center justify-center"><span className="animate-pulse-soft text-muted-foreground">Loading...</span></div>;
  if (!user || !isAdmin) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-card p-4 md:flex">
        <Link to="/admin/orders" className="mb-8 flex items-center gap-2 px-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold">Admin</span>
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
          ← Back to Menu
        </Link>
      </aside>
      <div className="flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex w-full items-center justify-between">
            <span className="font-display font-bold">Admin</span>
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
