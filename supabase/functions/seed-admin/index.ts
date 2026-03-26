import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const email = "federico@klaaryo.com";
    const password = "Klaaryo2025!";

    // Delete existing user if any
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users.find((u) => u.email === email);
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id);
      // Clean up profile and roles
      await admin.from("profiles").delete().eq("user_id", existing.id);
      await admin.from("user_roles").delete().eq("user_id", existing.id);
    }

    // Create user
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Federico" },
    });

    if (error) throw error;

    const userId = data.user.id;

    // Wait for trigger to create profile
    await new Promise((r) => setTimeout(r, 1000));

    // Update profile to admin
    await admin.from("profiles").update({ role: "admin" }).eq("user_id", userId);
    // Update user_roles to admin
    await admin.from("user_roles").update({ role: "admin" }).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
