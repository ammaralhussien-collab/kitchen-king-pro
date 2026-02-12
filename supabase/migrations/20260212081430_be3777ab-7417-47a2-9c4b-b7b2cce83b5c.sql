
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS is_offer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_price numeric,
  ADD COLUMN IF NOT EXISTS offer_badge text;
