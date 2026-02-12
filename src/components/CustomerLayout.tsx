import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShoppingCart, UtensilsCrossed, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const CustomerLayout = () => {
  const { itemCount } = useCart();
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/menu" className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">Bella Cucina</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin/orders"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Admin
              </Link>
            )}
            {!user && (
              <Link
                to="/auth"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <User className="h-5 w-5" />
              </Link>
            )}
            <Link to="/cart" className="relative rounded-full bg-primary p-2.5 text-primary-foreground transition-transform hover:scale-105">
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default CustomerLayout;
