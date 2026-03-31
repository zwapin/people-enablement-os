import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { TrendingUp, Loader2 } from "lucide-react";
import PlanCard from "@/components/grow/PlanCard";
import PlanDetail from "@/components/grow/PlanDetail";
import CreatePlanDialog from "@/components/grow/CreatePlanDialog";
import AddTaskDialog from "@/components/grow/AddTaskDialog";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"onboarding_tasks">;
type Milestone = Tables<"onboarding_milestones"> & { tasks: Task[] };
type Plan = Tables<"onboarding_plans"> & { milestones: Milestone[] };

export default function Grow() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { isImpersonating, impersonating } = useImpersonation();
  const viewAsRep = isImpersonating;
  const effectiveAdmin = isAdmin && !viewAsRep;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Fetch profiles for rep names (admin only)
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

  // Fetch plans with milestones and tasks
  const { data: plans, isLoading } = useQuery({
    queryKey: ["onboarding-plans"],
    queryFn: async () => {
      // Get plans
      const planQuery = isAdmin
        ? supabase.from("onboarding_plans").select("*").order("created_at", { ascending: false })
        : supabase.from("onboarding_plans").select("*").eq("rep_id", user!.id);

      const { data: rawPlans, error: pErr } = await planQuery;
      if (pErr) throw pErr;
      if (!rawPlans?.length) return [] as Plan[];

      const planIds = rawPlans.map((p) => p.id);

      // Get milestones
      const { data: rawMilestones } = await supabase
        .from("onboarding_milestones")
        .select("*")
        .in("plan_id", planIds);

      const milestoneIds = (rawMilestones || []).map((m) => m.id);

      // Get tasks
      const { data: rawTasks } = milestoneIds.length > 0
        ? await supabase.from("onboarding_tasks").select("*").in("milestone_id", milestoneIds)
        : { data: [] as Task[] };

      // Assemble
      const tasksByMilestone = new Map<string, Task[]>();
      for (const t of rawTasks || []) {
        const arr = tasksByMilestone.get(t.milestone_id) || [];
        arr.push(t);
        tasksByMilestone.set(t.milestone_id, arr);
      }

      const milestonesByPlan = new Map<string, Milestone[]>();
      for (const m of rawMilestones || []) {
        const arr = milestonesByPlan.get(m.plan_id) || [];
        arr.push({ ...m, tasks: tasksByMilestone.get(m.id) || [] });
        milestonesByPlan.set(m.plan_id, arr);
      }

      return rawPlans.map((p) => ({
        ...p,
        milestones: milestonesByPlan.get(p.id) || [],
      })) as Plan[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

  // Detail view
  if (selectedPlan) {
    return (
      <div className="space-y-6">
        {effectiveAdmin && (
          <div className="flex justify-end">
            <AddTaskDialog milestones={selectedPlan.milestones} />
          </div>
        )}
        <PlanDetail
          plan={selectedPlan}
          repName={isAdmin ? profileMap.get(selectedPlan.rep_id) : undefined}
          canToggleTasks={!effectiveAdmin}
          onBack={() => setSelectedPlanId(null)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crescita</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {effectiveAdmin
              ? "Gestisci i piani di onboarding 30-60-90 del team."
              : "Il tuo percorso di onboarding personalizzato."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch
                id="grow-view-toggle"
                checked={viewAsRep}
                onCheckedChange={handleToggleView}
              />
              <Label htmlFor="grow-view-toggle" className="text-sm cursor-pointer">
                New Klaaryan
              </Label>
            </div>
          )}
          {effectiveAdmin && <CreatePlanDialog />}
        </div>
      </div>

      {(!plans || plans.length === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            {effectiveAdmin
              ? "Nessun piano di onboarding creato. Crea il primo piano per un membro del team."
              : "Non hai ancora un piano di onboarding assegnato."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              repName={isAdmin ? profileMap.get(plan.rep_id) : undefined}
              onClick={() => setSelectedPlanId(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
