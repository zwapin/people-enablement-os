import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, BookOpen, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"onboarding_tasks">;
type Milestone = Tables<"onboarding_milestones"> & { tasks: Task[] };
type Plan = Tables<"onboarding_plans"> & { milestones: Milestone[] };

const MILESTONE_LABELS: Record<string, string> = {
  "30d": "Primi 30 Giorni",
  "60d": "30 – 60 Giorni",
  "90d": "60 – 90 Giorni",
};

const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  module_link: <BookOpen className="h-3.5 w-3.5 text-primary" />,
  activity: <Calendar className="h-3.5 w-3.5 text-amber-500" />,
  meeting: <Users className="h-3.5 w-3.5 text-blue-500" />,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  module_link: "Modulo",
  activity: "Attività",
  meeting: "Meeting",
};

interface PlanDetailProps {
  plan: Plan;
  repName?: string;
  canToggleTasks?: boolean;
  onBack: () => void;
}

export default function PlanDetail({ plan, repName, canToggleTasks = false, onBack }: PlanDetailProps) {
  const queryClient = useQueryClient();

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento del task");
    },
  });

  const allTasks = plan.milestones.flatMap((m) => m.tasks);
  const completedCount = allTasks.filter((t) => t.completed).length;
  const progressPct = allTasks.length > 0
    ? Math.round((completedCount / allTasks.length) * 100)
    : 0;

  const orderedMilestones = [...plan.milestones].sort((a, b) => {
    const order = { "30d": 0, "60d": 1, "90d": 2 };
    return (order[a.label] ?? 0) - (order[b.label] ?? 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {repName ? `Piano di ${repName}` : "Il tuo Piano di Onboarding"}
          </h2>
          {plan.role_template && (
            <p className="text-sm text-muted-foreground">{plan.role_template}</p>
          )}
        </div>
      </div>

      {/* Overall progress */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso complessivo</span>
            <span className="font-mono text-foreground">
              {completedCount}/{allTasks.length} · {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Milestones */}
      {orderedMilestones.map((milestone) => {
        const mDone = milestone.tasks.filter((t) => t.completed).length;
        const mTotal = milestone.tasks.length;
        const goals = Array.isArray(milestone.goals) ? milestone.goals as string[] : [];

        return (
          <Card key={milestone.id} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {MILESTONE_LABELS[milestone.label] || milestone.label}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {mDone}/{mTotal}
                </Badge>
              </div>
              {goals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {goals.map((goal, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                      {goal}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {milestone.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    task.completed ? "bg-muted/30" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={task.completed}
                    disabled={!canToggleTasks || toggleTask.isPending}
                    onCheckedChange={(checked) =>
                      toggleTask.mutate({ taskId: task.id, completed: !!checked })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.completed
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {TASK_TYPE_ICONS[task.type]}
                    <span className="text-[10px] text-muted-foreground">
                      {TASK_TYPE_LABELS[task.type] || task.type}
                    </span>
                  </div>
                </div>
              ))}
              {milestone.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nessun task per questo milestone
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
