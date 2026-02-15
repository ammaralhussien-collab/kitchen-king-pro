import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { ShoppingCart, UtensilsCrossed, User, Tag, Globe } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { supportedLanguages, type Language } from "@/i18n/translations";

const langLabels: Record<Language, string> = { de: "DE", en: "EN", ar: "AR" };

const CustomerLayout = () => {
  const { itemCount } = useCart();
  const { user, isAdmin, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoHeight, setLogoHeight] = useState(44);
  const [restaurantName, setRestaurantName] = useState("Bella Cucina");

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("logo_url, name, logo_height_px")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setLogoUrl(data.logo_url);
          setLogoHeight(data.logo_height_px ?? 44);
          setRestaurantName(data.name);
        }
      });
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><span className="animate-pulse text-muted-foreground">Loading…</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/menu" className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={restaurantName}
                style={{ height: `${logoHeight}px`, width: "auto" }}
                className="object-contain"
              />
            ) : (
              <>
                <UtensilsCrossed className="h-6 w-6 text-primary" />
                <span className="font-display text-xl font-bold text-foreground">{restaurantName}</span>
              </>
            )}
          </Link>
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            {/* Language Switcher */}
            <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
              {supportedLanguages.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-sm font-medium transition ${
                    lang === l ? "bg-primary text-white" : "bg-transparent hover:bg-muted"
                  }`}
                >
                  {langLabels[l]}
                </button>
              ))}
            </div>
            <Link
              to="/offers"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Tag className="h-4 w-4" />
              {t("app.offers")}
            </Link>
            {isAdmin && (
              <Link
                to="/admin/menu"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("app.admin")}
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
            <Link
              to="/cart"
              className="relative rounded-full bg-primary p-2.5 text-primary-foreground transition-transform hover:scale-105"
            >
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
