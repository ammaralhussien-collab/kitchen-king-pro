
-- Add delivery columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- RLS: Drivers can read their assigned orders
CREATE POLICY "Drivers read assigned orders"
ON public.orders
FOR SELECT
USING (assigned_driver_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

-- RLS: Drivers can update their assigned orders
CREATE POLICY "Drivers update assigned orders"
ON public.orders
FOR UPDATE
USING (assigned_driver_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

-- RLS: Staff can update orders (for assigning drivers)
CREATE POLICY "Staff update orders"
ON public.orders
FOR UPDATE
USING (has_role(auth.uid(), 'staff'::app_role));

-- RLS: Staff can read all orders
CREATE POLICY "Staff read orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));
