
-- Make user_id NOT NULL so every order must have an owner
-- First update any existing NULL user_id orders (table is empty but be safe)
UPDATE public.orders SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- Now make the column NOT NULL
ALTER TABLE public.orders ALTER COLUMN user_id SET NOT NULL;

-- Tighten the SELECT policy to explicitly require user_id match
DROP POLICY IF EXISTS "Authenticated users read own orders" ON public.orders;
CREATE POLICY "Users read own orders only"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid());
