import { Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/I18nProvider';
import { Minus, Plus, Trash2, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const CartPage = () => {
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const { t, formatCurrency } = useI18n();

  if (items.length === 0) {
    return (
      <div className="container flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="font-display text-2xl font-bold">{t('cart.empty')}</h2>
        <p className="mt-2 text-muted-foreground">{t('cart.emptyHint')}</p>
        <Link to="/menu">
          <Button className="mt-6">{t('app.browseMenu')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6">
      <Link to="/menu" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('app.continueShopping')}
      </Link>
      <h1 className="font-display text-2xl font-bold">{t('cart.title')}</h1>

      <div className="mt-6 space-y-4">
        <AnimatePresence>
          {items.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl">🍽️</div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-display font-semibold">{item.name}</h3>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.addons.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      + {item.addons.map(a => a.name).join(', ')}
                    </p>
                  )}
                  {item.notes && <p className="mt-0.5 text-xs text-muted-foreground italic">"{item.notes}"</p>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center rounded-md border border-border">
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="px-2 py-1"><Minus className="h-3 w-3" /></button>
                    <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1"><Plus className="h-3 w-3" /></button>
                  </div>
                  <span className="font-display font-bold text-primary">
                    {formatCurrency((item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('cart.subtotal')}</span>
          <span className="font-semibold">{formatCurrency(subtotal)}</span>
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">Online ordering coming soon!</p>
      </div>
    </div>
  );
};

export default CartPage;
