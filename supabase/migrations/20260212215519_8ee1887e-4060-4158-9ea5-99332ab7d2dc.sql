
-- Add admin-only INSERT policies for orders, order_items, payments (ordering disabled for public)
CREATE POLICY "Only admins can create orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin UPDATE/DELETE for payments
CREATE POLICY "Admins can update payments"
ON public.payments FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete payments"
ON public.payments FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
