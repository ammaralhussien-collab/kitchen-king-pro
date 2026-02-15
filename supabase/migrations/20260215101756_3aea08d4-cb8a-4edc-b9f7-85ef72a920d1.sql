
-- Add idempotency_key column to orders
ALTER TABLE public.orders ADD COLUMN idempotency_key text UNIQUE;

-- Index for fast lookups
CREATE INDEX idx_orders_idempotency_key ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
