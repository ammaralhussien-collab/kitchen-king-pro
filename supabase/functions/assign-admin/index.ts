import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  const { email } = await req.json()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  // Find user by email
  const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers()
  
  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), { status: 400 })
  }

  const user = users.find(u => u.email === email)
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
  }

  // Assign admin role
  const { error } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: user.id, role: 'admin' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ success: true, message: 'Admin role assigned' }))
})
