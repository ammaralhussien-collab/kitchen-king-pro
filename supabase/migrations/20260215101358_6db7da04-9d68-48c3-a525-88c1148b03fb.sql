
-- Create order rate limits table
CREATE TABLE public.order_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_order_rate_limits_user_created ON public.order_rate_limits (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.order_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can insert their own rate limit rows
CREATE POLICY "Users insert own rate limit rows"
  ON public.order_rate_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read own rows (needed for count check)
CREATE POLICY "Users read own rate limit rows"
  ON public.order_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all (for cleanup)
CREATE POLICY "Admins manage rate limits"
  ON public.order_rate_limits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
