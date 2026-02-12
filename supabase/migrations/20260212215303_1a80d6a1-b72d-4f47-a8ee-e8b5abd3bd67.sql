
-- Drop the overly permissive SELECT policy on orders
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;

-- Create a restrictive SELECT policy: users see only their own orders, admins see all
CREATE POLICY "Users can read own orders"
ON public.orders
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Drop the overly permissive INSERT policy on orders (ordering disabled)
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Drop the overly permissive INSERT policies on order_items and payments
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can read order items" ON public.order_items;

-- Restrict order_items to authenticated users who own the order or are admin
CREATE POLICY "Users can read own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can read payments" ON public.payments;

-- Restrict payments similarly
CREATE POLICY "Users can read own payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = payments.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);
