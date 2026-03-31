import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  ArrowRight,
  CalendarDays,
} from "lucide-react";

interface Props {
  userId: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function OnboardingPlanSection({ userId }: Props) {
  const navigate = useNavigate();

  const { data: plans } = useQuery({
    queryKey: ["onboarding_plans_home", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_plans")
        .select("*")
        .eq("rep_id", userId)
        .eq("plan_status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const planIds = plans?.map((p) => p.id) ?? [];

  const { data: keyActivities } = useQuery({
    queryKey: ["key_activities_home", planIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_key_activities")
        .select("*")
        .in("plan_id", planIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: planIds.length > 0,
  });

  const { data: milestones } = useQuery({
    queryKey: ["milestones_home", planIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_milestones")
        .select("*")
        .in("plan_id", planIds);
      if (error) throw error;
      return data;
    },
    enabled: planIds.length > 0,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks_home", milestones?.map((m) => m.id)],
    queryFn: async () => {
      const mIds = milestones!.map((m) => m.id);
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .in("milestone_id", mIds)
        .is("parent_task_id", null);
      if (error) throw error;
      return data;
    },
    enabled: (milestones?.length ?? 0) > 0,
  });

  if (!plans || plans.length === 0) return null;

  const plan = plans[0];
  const planKeyActivities = keyActivities?.filter((a) => a.plan_id === plan.id) ?? [];
  const planMilestones = milestones?.filter((m) => m.plan_id === plan.id) ?? [];
  const planTasks = tasks?.filter((t) =>
    planMilestones.some((m) => m.id === t.milestone_id)
  ) ?? [];

  const kaCompleted = planKeyActivities.filter((a) => a.completed).length;
  const kaTotal = planKeyActivities.length;
  const kaPct = kaTotal > 0 ? Math.round((kaCompleted / kaTotal) * 100) : 0;

  const taskCompleted = planTasks.filter((t) => t.completed).length;
  const taskTotal = planTasks.length;
  const taskPct = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  const milestoneLabels: Record<string, string> = {
    "30d": "30 giorni",
    "60d": "60 giorni",
    "90d": "90 giorni",
  };

  return (
    <motion.div variants={fadeUp} className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        Il tuo piano di onboarding
      </h2>

      <Card
        className="bg-card border-border hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => navigate("/grow")}
      >
        <CardContent className="p-5 space-y-4">
          {/* Key Activities summary */}
          {kaTotal > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Attività chiave
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {kaCompleted}/{kaTotal}
                </Badge>
              </div>
              <Progress value={kaPct} className="h-1.5" />
              <div className="space-y-1">
                {planKeyActivities.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    {a.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={a.completed ? "text-muted-foreground line-through" : "text-foreground"}>
                      {a.title}
                    </span>
                  </div>
                ))}
                {kaTotal > 4 && (
                  <p className="text-xs text-muted-foreground pl-5">
                    +{kaTotal - 4} altr{kaTotal - 4 === 1 ? "a" : "e"} attività
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Milestone progress */}
          {planMilestones.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground pt-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Milestone
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["30d", "60d", "90d"] as const).map((label) => {
                  const ms = planMilestones.find((m) => m.label === label);
                  if (!ms) return null;
                  const msTasks = planTasks.filter((t) => t.milestone_id === ms.id);
                  const msCompleted = msTasks.filter((t) => t.completed).length;
                  const msTotal = msTasks.length;
                  const msPct = msTotal > 0 ? Math.round((msCompleted / msTotal) * 100) : 0;
                  return (
                    <div key={label} className="text-center space-y-1">
                      <p className="text-xs text-muted-foreground">{milestoneLabels[label]}</p>
                      <div className="relative mx-auto w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" className="stroke-muted" strokeWidth="4" />
                          <circle
                            cx="24" cy="24" r="20" fill="none"
                            className="stroke-primary"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${(msPct / 100) * 125.6} 125.6`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold text-foreground">
                          {msPct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{msCompleted}/{msTotal}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground pt-2">
              Progresso totale: {taskCompleted + kaCompleted}/{taskTotal + kaTotal} completati
            </p>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
