
-- Restaurant table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Restaurant',
  description TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  opening_hours JSONB DEFAULT '{}',
  delivery_radius_km NUMERIC DEFAULT 5,
  delivery_fee NUMERIC DEFAULT 0,
  minimum_order NUMERIC DEFAULT 0,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read restaurants" ON public.restaurants FOR SELECT USING (true);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (true);

-- Items
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  prep_time_minutes INT DEFAULT 15,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read items" ON public.items FOR SELECT USING (true);

-- Item Addons
CREATE TABLE public.item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read addons" ON public.item_addons FOR SELECT USING (true);

-- Orders
CREATE TYPE public.order_status AS ENUM ('received', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled');
CREATE TYPE public.order_type AS ENUM ('delivery', 'pickup');
CREATE TYPE public.payment_method AS ENUM ('cash', 'online');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  status public.order_status DEFAULT 'received' NOT NULL,
  order_type public.order_type NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT,
  scheduled_time TIMESTAMPTZ,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT USING (true);

-- Order Items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  addons JSONB DEFAULT '[]',
  notes TEXT,
  total NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read order items" ON public.order_items FOR SELECT USING (true);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  method public.payment_method NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read payments" ON public.payments FOR SELECT USING (true);

-- Admin role setup
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Admin policies for management tables
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage items" ON public.items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage addons" ON public.item_addons FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Seed default restaurant
INSERT INTO public.restaurants (name, description, phone, address) 
VALUES ('Bella Cucina', 'Authentic Italian cuisine made with love', '+1 (555) 123-4567', '123 Main Street, Downtown');

-- Seed categories
INSERT INTO public.categories (restaurant_id, name, description, sort_order) 
SELECT r.id, c.name, c.description, c.sort_order
FROM public.restaurants r,
(VALUES 
  ('Appetizers', 'Start your meal right', 1),
  ('Pasta', 'Handmade daily', 2),
  ('Pizza', 'Wood-fired perfection', 3),
  ('Desserts', 'Sweet endings', 4),
  ('Drinks', 'Refresh yourself', 5)
) AS c(name, description, sort_order);

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
