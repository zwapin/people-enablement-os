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

    // Extract auth header to identify the admin creating the invite
    const authHeader = req.headers.get("authorization");
    let adminUserId: string | null = null;
    if (authHeader) {
      const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      adminUserId = adminUser?.id ?? null;
    }

    const { email, full_name, department, departments, job_role, member_type, role_template } = await req.json();

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

    // Auto-create onboarding plan if role_template is provided and member is new_klaaryan
    let planId: string | null = null;
    const effectiveMemberType = member_type || "new_klaaryan";
    if (role_template && effectiveMemberType === "new_klaaryan") {
      try {
        const createdBy = adminUserId || newUserId;

        // 1. Create plan
        const { data: plan, error: planError } = await supabaseAdmin
          .from("onboarding_plans")
          .insert({
            rep_id: newUserId,
            created_by: createdBy,
            role_template,
          })
          .select("id")
          .single();

        if (planError) throw planError;
        planId = plan.id;

        // 2. Create milestones (30d, 60d, 90d)
        const milestoneLabels = ["30d", "60d", "90d"] as const;
        const milestoneRows = milestoneLabels.map((label) => ({
          plan_id: plan.id,
          label,
          kpis: [],
          focus: [],
        }));

        const { error: msError } = await supabaseAdmin
          .from("onboarding_milestones")
          .insert(milestoneRows);
        if (msError) throw msError;

        // 3. Fetch created milestones to get IDs
        const { data: createdMilestones } = await supabaseAdmin
          .from("onboarding_milestones")
          .select("id, label")
          .eq("plan_id", plan.id);

        const milestoneMap = new Map(
          (createdMilestones || []).map((m: any) => [m.label, m.id])
        );

        // 4. Copy task templates for this role
        const { data: taskTemplates } = await supabaseAdmin
          .from("onboarding_templates")
          .select("*")
          .or(`role.eq.${role_template},role.is.null`)
          .order("order_index");

        if (taskTemplates && taskTemplates.length > 0) {
          const taskRows = taskTemplates
            .filter((t: any) => milestoneMap.has(t.milestone_label))
            .map((t: any) => ({
              milestone_id: milestoneMap.get(t.milestone_label),
              title: t.title,
              type: t.type || "activity",
              section: t.section || null,
              order_index: t.order_index || 0,
              is_common: true,
            }));

          if (taskRows.length > 0) {
            await supabaseAdmin.from("onboarding_tasks").insert(taskRows);
          }
        }

        // 5. Copy key activity templates for this role
        const { data: kaTemplates } = await supabaseAdmin
          .from("onboarding_key_activity_templates")
          .select("*")
          .eq("role", role_template)
          .order("order_index");

        if (kaTemplates && kaTemplates.length > 0) {
          const kaRows = kaTemplates.map((t: any, i: number) => ({
            plan_id: plan.id,
            title: t.title,
            collection_id: t.collection_id || null,
            order_index: t.order_index ?? i,
          }));
          await supabaseAdmin.from("onboarding_key_activities").insert(kaRows);
        }

        console.log(`Auto-created onboarding plan ${plan.id} for user ${newUserId} with role ${role_template}`);
      } catch (planErr) {
        console.error("Error creating onboarding plan:", planErr);
        // Don't fail the invite if plan creation fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId, plan_id: planId }),
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
