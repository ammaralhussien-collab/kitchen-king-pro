import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { currentPassword, newPassword } = await req.json();

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return json({ ok: false, code: 'invalid_input' }, 400);
    }
    if (newPassword.length === 0 || newPassword.length > 256) {
      return json({ ok: false, code: 'invalid_new_password' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('app_config')
      .select('password_hash')
      .eq('id', 'app_password')
      .single();

    if (error || !data) return json({ ok: false, code: 'server_error' }, 500);

    const currentHash = await sha256Hex(currentPassword);
    if (currentHash !== data.password_hash) {
      return json({ ok: false, code: 'wrong_current' }, 200);
    }

    const newHash = await sha256Hex(newPassword);
    const { error: upErr } = await supabase
      .from('app_config')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', 'app_password');

    if (upErr) return json({ ok: false, code: 'server_error' }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, code: 'server_error', error: String(e) }, 500);
  }
});