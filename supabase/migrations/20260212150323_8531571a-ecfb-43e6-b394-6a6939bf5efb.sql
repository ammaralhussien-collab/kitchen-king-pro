
-- Add source column to orders table to track where orders originate
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';
