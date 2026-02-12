
ALTER TABLE public.restaurants
  ADD COLUMN hero_image_url text,
  ADD COLUMN hero_title text DEFAULT 'Authentic Italian Cuisine',
  ADD COLUMN hero_subtitle text DEFAULT 'Experience the finest flavors of Italy, crafted with passion and served with love';
