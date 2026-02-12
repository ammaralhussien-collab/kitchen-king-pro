
-- Add multilingual columns to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS desc_en text,
  ADD COLUMN IF NOT EXISTS desc_de text,
  ADD COLUMN IF NOT EXISTS desc_ar text;

-- Populate name_de from existing name column as default
UPDATE public.items SET name_de = name WHERE name_de IS NULL;

-- Add multilingual columns to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS name_ar text;

-- Populate name_de from existing name column as default
UPDATE public.categories SET name_de = name WHERE name_de IS NULL;

-- Add multilingual columns to item_addons table
ALTER TABLE public.item_addons
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS name_ar text;

UPDATE public.item_addons SET name_de = name WHERE name_de IS NULL;
