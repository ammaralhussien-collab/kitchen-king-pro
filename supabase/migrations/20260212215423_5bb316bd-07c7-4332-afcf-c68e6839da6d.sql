
-- Orders: deny all anonymous access, restrict SELECT to authenticated only
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
CREATE POLICY "Authenticated users read own orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- No INSERT for orders (ordering disabled)
-- Admins can still manage via existing ALL policy

-- order_items: restrict all access to authenticated via parent order
DROP POLICY IF EXISTS "Users can read own order items" ON public.order_items;
CREATE POLICY "Authenticated users read own order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- payments: restrict all access to authenticated via parent order
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Authenticated users read own payments"
ON public.payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = payments.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- user_roles: only admins can INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
