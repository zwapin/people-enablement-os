import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import PlanCanvas from "./PlanCanvas";

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
  isEditable?: boolean;
  onBack?: () => void;
}

// Deep clone helper
function clonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan));
}

export default function PlanDetail({ plan, repName, canToggleTasks = false, isEditable = false, onBack }: PlanDetailProps) {
  const queryClient = useQueryClient();
  const [openMilestones, setOpenMilestones] = useState<Record<string, boolean>>({
    "30d": true,
    "60d": true,
    "90d": true,
  });

  // Editing state
  const [editedPlan, setEditedPlan] = useState<Plan>(() => clonePlan(plan));
  const [hasChanges, setHasChanges] = useState(false);
  const [newFocusInputs, setNewFocusInputs] = useState<Record<string, string>>({});
  const [newKpiInputs, setNewKpiInputs] = useState<Record<string, string>>({});
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);

  // Sync when plan prop changes (after save/refetch)
  useEffect(() => {
    setEditedPlan(clonePlan(plan));
    setHasChanges(false);
    setDeletedTaskIds([]);
  }, [plan]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // --- Plan-level field setters ---
  const setPlanField = useCallback((field: keyof Plan, value: string) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
    markChanged();
  }, [markChanged]);

  // --- Milestone field setters ---
  const setMilestoneField = useCallback((milestoneId: string, field: string, value: unknown) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m =>
        m.id === milestoneId ? { ...m, [field]: value } : m
      ),
    }));
    markChanged();
  }, [markChanged]);

  const addToList = useCallback((milestoneId: string, field: "focus" | "kpis", value: string) => {
    if (!value.trim()) return;
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => {
        if (m.id !== milestoneId) return m;
        const list = Array.isArray(m[field]) ? [...(m[field] as string[])] : [];
        list.push(value.trim());
        return { ...m, [field]: list };
      }),
    }));
    markChanged();
  }, [markChanged]);

  const removeFromList = useCallback((milestoneId: string, field: "focus" | "kpis", index: number) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => {
        if (m.id !== milestoneId) return m;
        const list = Array.isArray(m[field]) ? [...(m[field] as string[])] : [];
        list.splice(index, 1);
        return { ...m, [field]: list };
      }),
    }));
    markChanged();
  }, [markChanged]);

  // --- Task setters ---
  const setTaskTitle = useCallback((milestoneId: string, taskId: string, title: string) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, title } : t) }
          : m
      ),
    }));
    markChanged();
  }, [markChanged]);

  const deleteTask = useCallback((milestoneId: string, taskId: string) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.filter(t => t.id !== taskId) }
          : m
      ),
    }));
    setDeletedTaskIds(prev => [...prev, taskId]);
    markChanged();
  }, [markChanged]);

  // --- Toggle task (rep view) ---
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

  // --- Save all changes ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update plan
      const { error: planErr } = await supabase
        .from("onboarding_plans")
        .update({
          role_template: editedPlan.role_template,
          premessa: editedPlan.premessa,
          output_atteso: editedPlan.output_atteso,
        })
        .eq("id", editedPlan.id);
      if (planErr) throw planErr;

      // 2. Update milestones
      for (const m of editedPlan.milestones) {
        const { error: mErr } = await supabase
          .from("onboarding_milestones")
          .update({
            obiettivo: m.obiettivo,
            focus: m.focus,
            kpis: m.kpis,
          })
          .eq("id", m.id);
        if (mErr) throw mErr;
      }

      // 3. Update tasks
      for (const m of editedPlan.milestones) {
        for (const t of m.tasks) {
          const { error: tErr } = await supabase
            .from("onboarding_tasks")
            .update({ title: t.title, section: t.section, order_index: t.order_index })
            .eq("id", t.id);
          if (tErr) throw tErr;
        }
      }

      // 4. Delete removed tasks
      if (deletedTaskIds.length > 0) {
        const { error: dErr } = await supabase
          .from("onboarding_tasks")
          .delete()
          .in("id", deletedTaskIds);
        if (dErr) throw dErr;
      }
    },
    onSuccess: () => {
      toast.success("Piano aggiornato");
      setHasChanges(false);
      setDeletedTaskIds([]);
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
    },
    onError: () => {
      toast.error("Errore nel salvataggio");
    },
  });

  // Use editedPlan for rendering when editable, else original plan
  const displayPlan = isEditable ? editedPlan : plan;

  const allTasks = displayPlan.milestones.flatMap((m) => m.tasks);
  const completedCount = allTasks.filter((t) => t.completed).length;
  const progressPct = allTasks.length > 0
    ? Math.round((completedCount / allTasks.length) * 100)
    : 0;

  const orderedMilestones = [...displayPlan.milestones].sort((a, b) => {
    const order = { "30d": 0, "60d": 1, "90d": 2 };
    return (order[a.label] ?? 0) - (order[b.label] ?? 0);
  });

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

  // --- Editable list component ---
  const EditableList = ({ milestoneId, field, items, label, icon, colorClass }: {
    milestoneId: string;
    field: "focus" | "kpis";
    items: string[];
    label: string;
    icon: React.ReactNode;
    colorClass?: string;
  }) => {
    const inputKey = `${milestoneId}-${field}`;
    const inputVal = (field === "focus" ? newFocusInputs : newKpiInputs)[inputKey] || "";
    const setInput = field === "focus" ? setNewFocusInputs : setNewKpiInputs;

    return (
      <div className={colorClass ? `rounded-lg ${colorClass} p-3 space-y-2` : "space-y-2"}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          {icon}
          {label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {item}
              {isEditable && (
                <button
                  type="button"
                  onClick={() => removeFromList(milestoneId, field, i)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {isEditable && (
          <div className="flex gap-1.5 mt-1">
            <Input
              value={inputVal}
              onChange={(e) => setInput(prev => ({ ...prev, [inputKey]: e.target.value }))}
              placeholder="Aggiungi..."
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addToList(milestoneId, field, inputVal);
                  setInput(prev => ({ ...prev, [inputKey]: "" }));
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                addToList(milestoneId, field, inputVal);
                setInput(prev => ({ ...prev, [inputKey]: "" }));
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">
            {repName ? `${repName} · Piano 90 Giorni` : "Il tuo Piano di Onboarding"}
          </h2>
          {isEditable ? (
            <Input
              value={editedPlan.role_template || ""}
              onChange={(e) => setPlanField("role_template", e.target.value)}
              placeholder="Ruolo / Template..."
              className="mt-1 h-7 text-sm border-none bg-transparent px-0 font-medium text-muted-foreground focus-visible:ring-1"
            />
          ) : (
            displayPlan.role_template && (
              <p className="text-sm text-muted-foreground font-medium">{displayPlan.role_template}</p>
            )
          )}
        </div>
      </div>

      {/* Premessa */}
      {(isEditable || displayPlan.premessa) && (
        <Card className="border-border bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Premessa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditable ? (
              <PlanCanvas
                content={editedPlan.premessa || ""}
                onChange={(md) => setPlanField("premessa", md)}
                placeholder="Descrivi il contesto del ruolo..."
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {displayPlan.premessa}
              </p>
            )}
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
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Obiettivo</p>
                        {isEditable ? (
                          <Textarea
                            value={milestone.obiettivo || ""}
                            onChange={(e) => setMilestoneField(milestone.id, "obiettivo", e.target.value)}
                            placeholder="Obiettivo della fase..."
                            className="min-h-[40px] text-sm border-none bg-transparent px-0 resize-none focus-visible:ring-1"
                          />
                        ) : (
                          milestone.obiettivo && (
                            <p className="text-sm text-foreground">{milestone.obiettivo}</p>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Focus */}
                  {(isEditable || focus.length > 0) && (
                    <EditableList
                      milestoneId={milestone.id}
                      field="focus"
                      items={focus}
                      label="Focus"
                      icon={<Crosshair className="h-3.5 w-3.5" />}
                    />
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
                            disabled={isEditable || !canToggleTasks || toggleTask.isPending}
                            onCheckedChange={(checked) =>
                              toggleTask.mutate({ taskId: task.id, completed: !!checked })
                            }
                          />
                          <div className="flex-1 min-w-0">
                            {isEditable ? (
                              <Input
                                value={task.title}
                                onChange={(e) => setTaskTitle(milestone.id, task.id, e.target.value)}
                                className="h-7 text-sm border-none bg-transparent px-0 focus-visible:ring-1"
                              />
                            ) : (
                              <p
                                className={`text-sm ${
                                  task.completed
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {task.title}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {TASK_TYPE_ICONS[task.type]}
                            <span className="text-[10px] text-muted-foreground">
                              {TASK_TYPE_LABELS[task.type] || task.type}
                            </span>
                            {isEditable && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteTask(milestone.id, task.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
                  {(isEditable || kpis.length > 0) && (
                    <EditableList
                      milestoneId={milestone.id}
                      field="kpis"
                      items={kpis}
                      label="Milestone di fase"
                      icon={<Target className="h-3.5 w-3.5" />}
                      colorClass="bg-success/5 border border-success/10"
                    />
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Output Atteso */}
      {(isEditable || displayPlan.output_atteso) && (
        <Card className="border-border bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Output Atteso a 90 Giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditable ? (
              <PlanCanvas
                content={editedPlan.output_atteso || ""}
                onChange={(md) => setPlanField("output_atteso", md)}
                placeholder="Descrivi l'output atteso..."
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {displayPlan.output_atteso}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      {isEditable && hasChanges && (
        <div className="sticky bottom-4 flex justify-end z-10">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="shadow-lg gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      )}
    </div>
  );
}
