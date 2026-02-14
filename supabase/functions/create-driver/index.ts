import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (!callerRoles || callerRoles.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  // Parse and validate input
  const { email, password, full_name, phone } = await req.json();

  if (!email || !password || !full_name) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (typeof password !== "string" || password.length < 10) {
    return new Response(JSON.stringify({ error: "Password must be at least 10 characters" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (phone && !/^\+?\d+$/.test(phone)) {
    return new Response(JSON.stringify({ error: "Invalid phone format" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Create auth user
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = createErr.message?.toLowerCase() || "";
    if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
      return new Response(JSON.stringify({ error: "هذا البريد مستخدم مسبقاً" }), {
        status: 409,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ error: createErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const newUserId = newUser.user.id;

  // Create profile
  const { error: profileErr } = await adminClient.from("profiles").insert({
    user_id: newUserId,
    full_name: full_name.trim(),
    phone: phone?.trim() || null,
  });

  if (profileErr) {
    // Rollback: delete the auth user
    await adminClient.auth.admin.deleteUser(newUserId);
    return new Response(JSON.stringify({ error: "Failed to create profile: " + profileErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Assign driver role
  const { error: roleErr } = await adminClient.from("user_roles").insert({
    user_id: newUserId,
    role: "driver",
  });

  if (roleErr) {
    // Rollback
    await adminClient.from("profiles").delete().eq("user_id", newUserId);
    await adminClient.auth.admin.deleteUser(newUserId);
    return new Response(JSON.stringify({ error: "Failed to assign role: " + roleErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({ success: true, user_id: newUserId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
