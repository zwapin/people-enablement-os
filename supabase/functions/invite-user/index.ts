import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { email, full_name, department, departments, job_role, member_type } = await req.json();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "email and full_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user via admin API with invite
    const siteUrl =
      Deno.env.get("SITE_URL") ||
      `https://${Deno.env.get("SUPABASE_URL")!.match(/\/\/([^.]+)/)?.[1]}.lovableproject.com`;

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, department, job_role },
        redirectTo: `${siteUrl}/reset-password`,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = inviteData.user.id;

    // Update profile with department, departments, job_role, member_type
    await new Promise((r) => setTimeout(r, 500));

    await supabaseAdmin
      .from("profiles")
      .update({
        department: department || (Array.isArray(departments) && departments.length > 0 ? departments[0] : null),
        departments: Array.isArray(departments) ? departments : (department ? [department] : []),
        job_role,
        member_type: member_type || "new_klaaryan",
      })
      .eq("user_id", newUserId);

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
