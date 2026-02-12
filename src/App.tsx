import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import CustomerLayout from "@/components/CustomerLayout";
import AdminLayout from "@/components/AdminLayout";
import MenuPage from "@/pages/MenuPage";
import ItemDetailPage from "@/pages/ItemDetailPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderStatusPage from "@/pages/OrderStatusPage";
import AuthPage from "@/pages/AuthPage";
import AdminOrdersPage from "@/pages/admin/AdminOrdersPage";
import AdminOrderDetailPage from "@/pages/admin/AdminOrderDetailPage";
import AdminMenuPage from "@/pages/admin/AdminMenuPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import OffersPage from "@/pages/OffersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<CustomerLayout />}>
                  <Route path="/" element={<MenuPage />} />
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/offers" element={<OffersPage />} />
                  <Route path="/item/:id" element={<ItemDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order/:id" element={<OrderStatusPage />} />
                </Route>
                <Route path="/auth" element={<AuthPage />} />
                <Route element={<AdminLayout />}>
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
                  <Route path="/admin/menu" element={<AdminMenuPage />} />
                  <Route path="/admin/settings" element={<AdminSettingsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
