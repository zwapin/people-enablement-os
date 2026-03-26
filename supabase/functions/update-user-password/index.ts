import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { email, password } = await req.json();
  
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find user by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return new Response(JSON.stringify({ error: listError.message }), { status: 500 });
  
  const user = users.find(u => u.email === email);
  if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
