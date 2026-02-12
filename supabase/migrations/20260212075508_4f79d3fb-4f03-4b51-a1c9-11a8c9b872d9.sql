
-- Enable pg_net extension for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call the whatsapp-notify edge function on new order
CREATE OR REPLACE FUNCTION public.notify_new_order_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := 'https://kbjxdrbscmiqykurvoep.supabase.co/functions/v1/whatsapp-notify';
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Use pg_net to make an async HTTP POST to the edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
END;
$$;

-- Trigger on new order insert
CREATE TRIGGER on_new_order_whatsapp
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order_whatsapp();
