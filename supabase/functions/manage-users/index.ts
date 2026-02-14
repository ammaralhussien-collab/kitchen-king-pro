import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Check caller is admin
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (!callerRoles || callerRoles.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET = list users
  if (req.method === "GET") {
    const search = url.searchParams.get("search") || "";

    // Get all auth users via admin API
    const { data: authData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 500 });
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: corsHeaders });
    }

    const authUsers = authData.users || [];

    // Get all profiles
    const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, phone");

    // Get all roles
    const { data: roles } = await adminClient.from("user_roles").select("user_id, role");

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles || []) {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    let result = authUsers.map((u: any) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email || "",
        full_name: (profile as any)?.full_name || "",
        phone: (profile as any)?.phone || "",
        roles: roleMap.get(u.id) || [],
        created_at: u.created_at,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (u: any) =>
          u.email.toLowerCase().includes(s) ||
          (u.full_name || "").toLowerCase().includes(s)
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PATCH = update role
  if (req.method === "PATCH") {
    const { target_user_id, new_role } = await req.json();

    const validRoles = ["admin", "user", "driver", "staff"];
    if (!validRoles.includes(new_role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers: corsHeaders });
    }

    // Prevent self-edit
    if (target_user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "ما فيك تغيّر صلاحيتك بنفسك" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // If removing admin from someone, check they're not the last admin
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id);

    const currentRole = targetRoles?.[0]?.role;

    if (currentRole === "admin" && new_role !== "admin") {
      // Count total admins
      const { count } = await adminClient
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if ((count || 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "ما فيك تشيل آخر أدمن" }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Upsert: delete existing role(s) for user, insert new one
    await adminClient.from("user_roles").delete().eq("user_id", target_user_id);

    // Only insert if role != 'user' (user is default / no role row needed)
    // Actually let's always insert so we can track
    const { error: insertErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: target_user_id, role: new_role });

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
});
