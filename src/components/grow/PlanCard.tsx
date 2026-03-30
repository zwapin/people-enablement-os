import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Calendar, User } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Plan = Tables<"onboarding_plans">;
type Milestone = Tables<"onboarding_milestones"> & {
  tasks: Tables<"onboarding_tasks">[];
};

interface PlanCardProps {
  plan: Plan & { milestones: Milestone[] };
  repName?: string;
  onClick?: () => void;
}

const MILESTONE_LABELS: Record<string, string> = {
  "30d": "30 Giorni",
  "60d": "60 Giorni",
  "90d": "90 Giorni",
};

export default function PlanCard({ plan, repName, onClick }: PlanCardProps) {
  const allTasks = plan.milestones.flatMap((m) => m.tasks);
  const completedTasks = allTasks.filter((t) => t.completed);
  const progressPct = allTasks.length > 0
    ? Math.round((completedTasks.length / allTasks.length) * 100)
    : 0;

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {repName || "Piano Onboarding"}
          </CardTitle>
          <Badge
            variant={plan.plan_status === "active" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {plan.plan_status === "active" ? "Attivo" : "Archiviato"}
          </Badge>
        </div>
        {plan.role_template && (
          <p className="text-xs text-muted-foreground">{plan.role_template}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-mono text-foreground">
              {completedTasks.length}/{allTasks.length} · {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Milestones summary */}
        <div className="flex gap-2">
          {(["30d", "60d", "90d"] as const).map((label) => {
            const milestone = plan.milestones.find((m) => m.label === label);
            if (!milestone) return null;
            const done = milestone.tasks.filter((t) => t.completed).length;
            const total = milestone.tasks.length;
            return (
              <div
                key={label}
                className="flex-1 rounded-md bg-muted/50 p-2 text-center space-y-0.5"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {MILESTONE_LABELS[label]}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {done}/{total}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Creato il {new Date(plan.created_at).toLocaleDateString("it-IT")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
