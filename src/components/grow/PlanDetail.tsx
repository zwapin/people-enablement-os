import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  BookOpen,
  Users,
  Calendar,
  ChevronDown,
  Target,
  Crosshair,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"onboarding_tasks">;
type Milestone = Tables<"onboarding_milestones"> & { tasks: Task[] };
type Plan = Tables<"onboarding_plans"> & { milestones: Milestone[] };

const MILESTONE_LABELS: Record<string, string> = {
  "30d": "Fase 1 — Giorni 1–30",
  "60d": "Fase 2 — Giorni 30–60",
  "90d": "Fase 3 — Giorni 60–90",
};

const MILESTONE_SUBTITLES: Record<string, string> = {
  "30d": "Onboarding & Pipeline Attiva",
  "60d": "Esecuzione",
  "90d": "Autonomia & Scalabilità",
};

const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  module_link: <BookOpen className="h-3.5 w-3.5 text-primary" />,
  activity: <Calendar className="h-3.5 w-3.5 text-warning" />,
  meeting: <Users className="h-3.5 w-3.5 text-info" />,
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
  onBack?: () => void;
}

export default function PlanDetail({ plan, repName, canToggleTasks = false, onBack }: PlanDetailProps) {
  const queryClient = useQueryClient();
  const [openMilestones, setOpenMilestones] = useState<Record<string, boolean>>({
    "30d": true,
    "60d": true,
    "90d": true,
  });

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

  // Group tasks by section within a milestone
  const groupTasksBySection = (tasks: Task[]) => {
    const sections = new Map<string, Task[]>();
    const sorted = [...tasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const t of sorted) {
      const section = t.section || "Attività generali";
      const arr = sections.get(section) || [];
      arr.push(t);
      sections.set(section, arr);
    }
    return sections;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">
            {repName ? `${repName} · Piano 90 Giorni` : "Il tuo Piano di Onboarding"}
          </h2>
          {plan.role_template && (
            <p className="text-sm text-muted-foreground font-medium">{plan.role_template}</p>
          )}
        </div>
      </div>

      {/* Premessa */}
      {plan.premessa && (
        <Card className="border-border bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Premessa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {plan.premessa}
            </p>
          </CardContent>
        </Card>
      )}

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
        const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;
        const kpis = Array.isArray(milestone.kpis) ? milestone.kpis as string[] : [];
        const focus = Array.isArray(milestone.focus) ? milestone.focus as string[] : [];
        
        const sections = groupTasksBySection(milestone.tasks);
        const isOpen = openMilestones[milestone.label] ?? true;

        return (
          <Collapsible
            key={milestone.id}
            open={isOpen}
            onOpenChange={(open) =>
              setOpenMilestones((prev) => ({ ...prev, [milestone.label]: open }))
            }
          >
            <Card className="border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <div>
                        <CardTitle className="text-base">
                          {MILESTONE_LABELS[milestone.label] || milestone.label}
                        </CardTitle>
                        {MILESTONE_SUBTITLES[milestone.label] && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {MILESTONE_SUBTITLES[milestone.label]}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={mPct} className="h-1.5 w-20" />
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {mDone}/{mTotal}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Obiettivo */}
                  {milestone.obiettivo && (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Obiettivo</p>
                          <p className="text-sm text-foreground">{milestone.obiettivo}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Focus */}
                  {focus.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Crosshair className="h-3.5 w-3.5" />
                        Focus
                      </p>
                      <ul className="space-y-1 pl-5">
                        {focus.map((f, i) => (
                          <li key={i} className="text-sm text-foreground list-disc">{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tasks grouped by section */}
                  {Array.from(sections.entries()).map(([sectionName, tasks]) => (
                    <div key={sectionName} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1 mb-2">
                        {sectionName}
                      </p>
                      {tasks.map((task) => (
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
                    </div>
                  ))}

                  {milestone.tasks.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nessun task per questo milestone
                    </p>
                  )}

                  {/* KPIs */}
                  {kpis.length > 0 && (
                    <div className="rounded-lg bg-success/5 border border-success/10 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-success uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Milestone di fase
                      </p>
                      <ul className="space-y-1 pl-5">
                        {kpis.map((kpi, i) => (
                          <li key={i} className="text-sm text-foreground list-disc">{kpi}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Output Atteso */}
      {plan.output_atteso && (
        <Card className="border-border bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Output Atteso a 90 Giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {plan.output_atteso}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
