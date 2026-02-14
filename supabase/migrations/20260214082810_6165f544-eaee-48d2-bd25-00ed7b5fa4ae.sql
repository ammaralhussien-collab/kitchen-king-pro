
-- Add new payment_method enum value
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cash_on_delivery';

-- Add new order_status enum value
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';

-- Add new columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS items_snapshot jsonb;
