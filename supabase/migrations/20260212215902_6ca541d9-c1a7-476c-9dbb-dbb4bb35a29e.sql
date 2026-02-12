
-- Explicitly deny anon access to orders table
CREATE POLICY "Deny anon access to orders"
ON public.orders FOR SELECT TO anon
USING (false);

-- Explicitly deny anon access to order_items
CREATE POLICY "Deny anon access to order items"
ON public.order_items FOR SELECT TO anon
USING (false);

-- Explicitly deny anon access to payments
CREATE POLICY "Deny anon access to payments"
ON public.payments FOR SELECT TO anon
USING (false);
