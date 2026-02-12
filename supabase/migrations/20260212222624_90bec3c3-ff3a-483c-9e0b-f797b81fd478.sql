
-- Drop all existing policies on orders
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Deny anon access to orders" ON public.orders;
DROP POLICY IF EXISTS "Only admins can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users read own orders only" ON public.orders;

-- SELECT: owner or admin
CREATE POLICY "Users read own orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- INSERT: authenticated users can only insert their own orders
CREATE POLICY "Users insert own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: admin only
CREATE POLICY "Admins update orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- DELETE: admin only
CREATE POLICY "Admins delete orders"
ON public.orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate order_items INSERT policy to allow order owners
DROP POLICY IF EXISTS "Only admins can create order items" ON public.order_items;
CREATE POLICY "Authenticated users insert own order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Drop and recreate payments INSERT policy to allow order owners
DROP POLICY IF EXISTS "Only admins can create payments" ON public.payments;
CREATE POLICY "Authenticated users insert own payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
