import React, { useState, useCallback, useEffect } from "react";
import { TASK_SECTIONS } from "@/lib/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  GripVertical,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import PlanCanvas from "./PlanCanvas";

type Task = Tables<"onboarding_tasks"> & { parent_task_id?: string | null };
type Milestone = Tables<"onboarding_milestones"> & { tasks: Task[] };
type Plan = Tables<"onboarding_plans"> & { milestones: Milestone[] };

type KeyActivity = {
  id: string;
  plan_id: string;
  title: string;
  collection_id: string | null;
  completed: boolean;
  completed_at: string | null;
  order_index: number;
  created_at: string;
};

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

function clonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan));
}

/* ── Sortable task row ── */
const SortableTaskRow = React.forwardRef<HTMLDivElement, {
  task: Task;
  isSubtask: boolean;
  isEditable: boolean;
  canToggleTasks: boolean;
  togglePending: boolean;
  onToggle: (taskId: string, completed: boolean) => void;
  onTitleChange: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentTaskId: string) => void;
}>(function SortableTaskRow({ task, isSubtask, isEditable, canToggleTasks, togglePending, onToggle, onTitleChange, onDelete, onAddSubtask }, _ref) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !isEditable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md px-3 py-2.5 transition-colors ${
        isSubtask ? "ml-8 border-l-2 border-border pl-3" : ""
      } ${task.completed ? "bg-muted/30" : "hover:bg-muted/50"}`}
    >
      {isEditable && (
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Checkbox
        checked={task.completed}
        disabled={isEditable || !canToggleTasks || togglePending}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
      />
      <div className="flex-1 min-w-0">
        {isEditable ? (
          <Input
            value={task.title}
            onChange={(e) => onTitleChange(task.id, e.target.value)}
            className="h-7 text-sm border-none bg-transparent px-0 focus-visible:ring-1"
          />
        ) : (
          <p className={`text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {task.title}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {TASK_TYPE_ICONS[task.type]}
        <span className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.type] || task.type}</span>
        {isEditable && !isSubtask && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            title="Aggiungi subtask"
            onClick={() => onAddSubtask(task.id)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
        {isEditable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
});

export default function PlanDetail({ plan, repName, canToggleTasks = false, isEditable = false, onBack }: PlanDetailProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [openMilestones, setOpenMilestones] = useState<Record<string, boolean>>({
    "30d": true, "60d": true, "90d": true,
  });

  const [editedPlan, setEditedPlan] = useState<Plan>(() => clonePlan(plan));
  const [hasChanges, setHasChanges] = useState(false);
  const [newFocusInputs, setNewFocusInputs] = useState<Record<string, string>>({});
  const [newKpiInputs, setNewKpiInputs] = useState<Record<string, string>>({});
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [newTaskSections, setNewTaskSections] = useState<Record<string, string>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Key activities state
  const [editedKeyActivities, setEditedKeyActivities] = useState<KeyActivity[]>([]);
  const [deletedKeyActivityIds, setDeletedKeyActivityIds] = useState<string[]>([]);
  const [newKeyActivityTitle, setNewKeyActivityTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch key activities for this plan
  const { data: keyActivities } = useQuery({
    queryKey: ["key-activities", plan.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_key_activities")
        .select("*")
        .eq("plan_id", plan.id)
        .order("order_index");
      return (data || []) as KeyActivity[];
    },
  });

  // Fetch collections for display/linking
  const { data: collections } = useQuery({
    queryKey: ["collections-for-plan"],
    queryFn: async () => {
      const { data } = await supabase.from("curricula").select("id, title").order("title");
      return data || [];
    },
  });

  const collectionMap = new Map((collections || []).map((c) => [c.id, c.title]));

  useEffect(() => {
    setEditedPlan(clonePlan(plan));
    setHasChanges(false);
    setDeletedTaskIds([]);
    setDeletedKeyActivityIds([]);
  }, [plan]);

  useEffect(() => {
    if (keyActivities) {
      setEditedKeyActivities(JSON.parse(JSON.stringify(keyActivities)));
    }
  }, [keyActivities]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const setPlanField = useCallback((field: keyof Plan, value: string) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
    markChanged();
  }, [markChanged]);

  const setMilestoneField = useCallback((milestoneId: string, field: string, value: unknown) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === milestoneId ? { ...m, [field]: value } : m),
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

  // --- Task helpers ---
  const setTaskTitle = useCallback((taskId: string, title: string) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => ({
        ...m,
        tasks: m.tasks.map(t => t.id === taskId ? { ...t, title } : t),
      })),
    }));
    markChanged();
  }, [markChanged]);

  const deleteTask = useCallback((taskId: string) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => ({
        ...m,
        tasks: m.tasks.filter(t => t.id !== taskId && (t as Task).parent_task_id !== taskId),
      })),
    }));
    const allTasks = editedPlan.milestones.flatMap(m => m.tasks);
    const childIds = allTasks.filter(t => (t as Task).parent_task_id === taskId).map(t => t.id);
    setDeletedTaskIds(prev => [...prev, taskId, ...childIds]);
    markChanged();
  }, [markChanged, editedPlan]);

  const setTaskParent = useCallback((taskId: string, parentTaskId: string | null) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => ({
        ...m,
        tasks: m.tasks.map(t => t.id === taskId ? { ...t, parent_task_id: parentTaskId } : t),
      })),
    }));
    markChanged();
  }, [markChanged]);

  // --- Inline add task (local-first) ---
  const handleAddTask = useCallback((milestoneId: string, parentTaskId?: string) => {
    const key = parentTaskId || milestoneId;
    const title = newTaskInputs[key]?.trim();
    if (!title) return;
    const section = parentTaskId ? null : (newTaskSections[milestoneId] || TASK_SECTIONS[0]);
    const tempId = `temp-${crypto.randomUUID()}`;
    const newTask: Task = {
      id: tempId,
      milestone_id: milestoneId,
      title,
      type: "activity",
      parent_task_id: parentTaskId || null,
      completed: false,
      completed_at: null,
      order_index: 999,
      is_common: false,
      section,
      module_id: null,
    };
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m =>
        m.id === milestoneId ? { ...m, tasks: [...m.tasks, newTask] } : m
      ),
    }));
    setNewTaskInputs(prev => ({ ...prev, [key]: "" }));
    markChanged();
  }, [newTaskInputs, newTaskSections, markChanged]);

  // --- Subtask prompt state ---
  const [subtaskPromptParentId, setSubtaskPromptParentId] = useState<string | null>(null);

  const handleAddSubtaskPrompt = useCallback((parentTaskId: string) => {
    setSubtaskPromptParentId(parentTaskId);
  }, []);

  // --- Key activity helpers ---
  const toggleKeyActivity = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("onboarding_key_activities")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["key-activities", plan.id] }),
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  const addKeyActivity = useCallback(() => {
    if (!newKeyActivityTitle.trim()) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    setEditedKeyActivities(prev => [...prev, {
      id: tempId,
      plan_id: plan.id,
      title: newKeyActivityTitle.trim(),
      collection_id: null,
      completed: false,
      completed_at: null,
      order_index: prev.length,
      created_at: new Date().toISOString(),
    }]);
    setNewKeyActivityTitle("");
    markChanged();
  }, [newKeyActivityTitle, plan.id, markChanged]);

  const deleteKeyActivity = useCallback((id: string) => {
    setEditedKeyActivities(prev => prev.filter(a => a.id !== id));
    if (!id.startsWith("temp-")) {
      setDeletedKeyActivityIds(prev => [...prev, id]);
    }
    markChanged();
  }, [markChanged]);

  const updateKeyActivityTitle = useCallback((id: string, title: string) => {
    setEditedKeyActivities(prev => prev.map(a => a.id === id ? { ...a, title } : a));
    markChanged();
  }, [markChanged]);

  const updateKeyActivityCollection = useCallback((id: string, collectionId: string | null) => {
    setEditedKeyActivities(prev => prev.map(a => a.id === id ? { ...a, collection_id: collectionId } : a));
    markChanged();
  }, [markChanged]);

  // --- Toggle task ---
  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] }),
    onError: () => toast.error("Errore nell'aggiornamento del task"),
  });

  // --- DnD handlers ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const allTasks = editedPlan.milestones.flatMap(m => m.tasks);
    const activeTask = allTasks.find(t => t.id === activeId);
    const overTask = allTasks.find(t => t.id === overId);

    if (!activeTask || !overTask) return;

    if ((overTask as Task).parent_task_id) return;

    if (!(activeTask as Task).parent_task_id || (activeTask as Task).parent_task_id !== overId) {
      setTaskParent(activeId, overId);
    }
  }, [editedPlan, setTaskParent]);

  // --- Save ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error: planErr } = await supabase
        .from("onboarding_plans")
        .update({ role_template: editedPlan.role_template, premessa: editedPlan.premessa, output_atteso: editedPlan.output_atteso })
        .eq("id", editedPlan.id);
      if (planErr) throw planErr;

      for (const m of editedPlan.milestones) {
        const { error: mErr } = await supabase
          .from("onboarding_milestones")
          .update({ obiettivo: m.obiettivo, focus: m.focus, kpis: m.kpis })
          .eq("id", m.id);
        if (mErr) throw mErr;
      }

      for (const m of editedPlan.milestones) {
        for (const t of m.tasks) {
          const isNew = t.id.startsWith("temp-");
          if (isNew) {
            const { error: iErr } = await supabase.from("onboarding_tasks").insert({
              milestone_id: m.id,
              title: t.title,
              type: t.type,
              section: t.section,
              order_index: t.order_index,
              parent_task_id: (t as Task).parent_task_id?.startsWith("temp-") ? null : (t as Task).parent_task_id || null,
            });
            if (iErr) throw iErr;
          } else {
            const parentId = (t as Task).parent_task_id;
            const { error: tErr } = await supabase
              .from("onboarding_tasks")
              .update({
                title: t.title,
                section: t.section,
                order_index: t.order_index,
                parent_task_id: parentId?.startsWith("temp-") ? null : parentId || null,
              })
              .eq("id", t.id);
            if (tErr) throw tErr;
          }
        }
      }

      if (deletedTaskIds.length > 0) {
        const { error: dErr } = await supabase.from("onboarding_tasks").delete().in("id", deletedTaskIds);
        if (dErr) throw dErr;
      }

      // Save key activities
      for (const ka of editedKeyActivities) {
        const isNew = ka.id.startsWith("temp-");
        if (isNew) {
          const { error } = await supabase.from("onboarding_key_activities").insert({
            plan_id: ka.plan_id,
            title: ka.title,
            collection_id: ka.collection_id || null,
            order_index: ka.order_index,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("onboarding_key_activities")
            .update({ title: ka.title, collection_id: ka.collection_id || null, order_index: ka.order_index })
            .eq("id", ka.id);
          if (error) throw error;
        }
      }

      if (deletedKeyActivityIds.length > 0) {
        const { error } = await supabase.from("onboarding_key_activities").delete().in("id", deletedKeyActivityIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Piano aggiornato");
      setHasChanges(false);
      setDeletedTaskIds([]);
      setDeletedKeyActivityIds([]);
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
      queryClient.invalidateQueries({ queryKey: ["key-activities", plan.id] });
    },
    onError: () => toast.error("Errore nel salvataggio"),
  });

  const displayPlan = isEditable ? editedPlan : plan;
  const allTasks = displayPlan.milestones.flatMap(m => m.tasks);
  const completedCount = allTasks.filter(t => t.completed).length;
  const progressPct = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

  const orderedMilestones = [...displayPlan.milestones].sort((a, b) => {
    const order = { "30d": 0, "60d": 1, "90d": 2 };
    return (order[a.label] ?? 0) - (order[b.label] ?? 0);
  });

  const displayKeyActivities = isEditable ? editedKeyActivities : (keyActivities || []);
  const kaCompleted = displayKeyActivities.filter(a => a.completed).length;
  const kaTotal = displayKeyActivities.length;

  const groupTasksBySection = (tasks: Task[]) => {
    const rootTasks = tasks.filter(t => !(t as Task).parent_task_id);
    const childMap = new Map<string, Task[]>();
    for (const t of tasks) {
      const pid = (t as Task).parent_task_id;
      if (pid) {
        const arr = childMap.get(pid) || [];
        arr.push(t);
        childMap.set(pid, arr);
      }
    }

    const sections = new Map<string, { task: Task; children: Task[] }[]>();
    const sorted = [...rootTasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const t of sorted) {
      const section = t.section || "Attività generali";
      const arr = sections.get(section) || [];
      arr.push({ task: t, children: (childMap.get(t.id) || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) });
      sections.set(section, arr);
    }
    return sections;
  };

  const activeDragTask = activeDragId ? allTasks.find(t => t.id === activeDragId) : null;

  // --- Editable list component ---
  const EditableList = ({ milestoneId, field, items, label, icon, colorClass }: {
    milestoneId: string; field: "focus" | "kpis"; items: string[]; label: string; icon: React.ReactNode; colorClass?: string;
  }) => {
    const inputKey = `${milestoneId}-${field}`;
    const inputVal = (field === "focus" ? newFocusInputs : newKpiInputs)[inputKey] || "";
    const setInput = field === "focus" ? setNewFocusInputs : setNewKpiInputs;

    return (
      <div className={colorClass ? `rounded-lg ${colorClass} p-3 space-y-2` : "space-y-2"}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          {icon} {label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {item}
              {isEditable && (
                <button type="button" onClick={() => removeFromList(milestoneId, field, i)} className="ml-0.5 hover:text-destructive">
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addToList(milestoneId, field, inputVal); setInput(prev => ({ ...prev, [inputKey]: "" })); } }}
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { addToList(milestoneId, field, inputVal); setInput(prev => ({ ...prev, [inputKey]: "" })); }}>
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
            {repName ? `Ecco il piano dei prossimi 90 giorni di ${repName}` : "Ecco il tuo piano dei prossimi 90 giorni"}
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
              Intro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditable ? (
              <PlanCanvas content={editedPlan.premessa || ""} onChange={(md) => setPlanField("premessa", md)} placeholder="Descrivi il contesto del ruolo..." />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{displayPlan.premessa}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overall progress */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso complessivo</span>
            <span className="font-mono text-foreground">{completedCount}/{allTasks.length} · {progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Key Activities — Evergreen section */}
      {(displayKeyActivities.length > 0 || isEditable) && (
        <Card className="border-border bg-accent/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Attività Chiave
              </CardTitle>
              {kaTotal > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {kaCompleted}/{kaTotal}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Attività evergreen indipendenti dalla timeline</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayKeyActivities.map((activity) => (
              <div key={activity.id} className={`flex items-center gap-2 rounded-md px-3 py-2.5 transition-colors ${activity.completed ? "bg-muted/30" : "hover:bg-muted/50"}`}>
                <Checkbox
                  checked={activity.completed}
                  disabled={isEditable || toggleKeyActivity.isPending}
                  onCheckedChange={(checked) => {
                    if (!activity.id.startsWith("temp-")) {
                      toggleKeyActivity.mutate({ id: activity.id, completed: !!checked });
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  {isEditable ? (
                    <Input
                      value={activity.title}
                      onChange={(e) => updateKeyActivityTitle(activity.id, e.target.value)}
                      className="h-7 text-sm border-none bg-transparent px-0 focus-visible:ring-1"
                    />
                  ) : (
                    <p className={`text-sm ${activity.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {activity.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Collection link */}
                  {isEditable ? (
                    <Select
                      value={activity.collection_id || "none"}
                      onValueChange={(v) => updateKeyActivityCollection(activity.id, v === "none" ? null : v)}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue placeholder="Collection..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna</SelectItem>
                        {(collections || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : activity.collection_id && collectionMap.get(activity.collection_id) ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => navigate(`/learn?collection=${activity.collection_id}`)}
                    >
                      <BookOpen className="h-3 w-3" />
                      {collectionMap.get(activity.collection_id)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Badge>
                  ) : null}
                  {isEditable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteKeyActivity(activity.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Add new key activity */}
            {isEditable && (
              <div className="flex gap-1.5 pt-2 border-t border-border">
                <Input
                  value={newKeyActivityTitle}
                  onChange={(e) => setNewKeyActivityTitle(e.target.value)}
                  placeholder="Aggiungi attività chiave..."
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyActivity(); } }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={!newKeyActivityTitle.trim()}
                  onClick={addKeyActivity}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {displayKeyActivities.length === 0 && !isEditable && (
              <p className="text-sm text-muted-foreground py-2 text-center">Nessuna attività chiave</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {orderedMilestones.map((milestone) => {
          const mDone = milestone.tasks.filter(t => t.completed).length;
          const mTotal = milestone.tasks.length;
          const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;
          const kpis = Array.isArray(milestone.kpis) ? milestone.kpis as string[] : [];
          const focus = Array.isArray(milestone.focus) ? milestone.focus as string[] : [];
          const sections = groupTasksBySection(milestone.tasks);
          const isOpen = openMilestones[milestone.label] ?? true;
          const allTaskIds = milestone.tasks.map(t => t.id);

          return (
            <Collapsible
              key={milestone.id}
              open={isOpen}
              onOpenChange={(open) => setOpenMilestones(prev => ({ ...prev, [milestone.label]: open }))}
            >
              <Card className="border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                        <div>
                          <CardTitle className="text-base">{MILESTONE_LABELS[milestone.label] || milestone.label}</CardTitle>
                          {MILESTONE_SUBTITLES[milestone.label] && (
                            <p className="text-xs text-muted-foreground mt-0.5">{MILESTONE_SUBTITLES[milestone.label]}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={mPct} className="h-1.5 w-20" />
                        <Badge variant="outline" className="text-[10px] font-mono">{mDone}/{mTotal}</Badge>
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
                            milestone.obiettivo && <p className="text-sm text-foreground">{milestone.obiettivo}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Focus */}
                    {(isEditable || focus.length > 0) && (
                      <EditableList milestoneId={milestone.id} field="focus" items={focus} label="Focus" icon={<Crosshair className="h-3.5 w-3.5" />} />
                    )}

                    {/* Tasks grouped by section with DnD */}
                    <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                      {Array.from(sections.entries()).map(([sectionName, taskEntries]) => (
                        <div key={sectionName} className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1 mb-2">
                            {sectionName}
                          </p>
                          {taskEntries.map(({ task, children }) => (
                            <div key={task.id}>
                              <SortableTaskRow
                                task={task}
                                isSubtask={false}
                                isEditable={isEditable}
                                canToggleTasks={canToggleTasks}
                                togglePending={toggleTask.isPending}
                                onToggle={(id, c) => toggleTask.mutate({ taskId: id, completed: c })}
                                onTitleChange={setTaskTitle}
                                onDelete={deleteTask}
                                onAddSubtask={handleAddSubtaskPrompt}
                              />
                              {children.map(child => (
                                <SortableTaskRow
                                  key={child.id}
                                  task={child}
                                  isSubtask
                                  isEditable={isEditable}
                                  canToggleTasks={canToggleTasks}
                                  togglePending={toggleTask.isPending}
                                  onToggle={(id, c) => toggleTask.mutate({ taskId: id, completed: c })}
                                  onTitleChange={setTaskTitle}
                                  onDelete={deleteTask}
                                  onAddSubtask={handleAddSubtaskPrompt}
                                />
                              ))}
                              {isEditable && subtaskPromptParentId === task.id && (
                                <div className="ml-8 border-l-2 border-border pl-3 flex gap-1.5 py-1.5">
                                  <Input
                                    autoFocus
                                    value={newTaskInputs[task.id] || ""}
                                    onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Nuova subtask..."
                                    className="h-7 text-xs flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { e.preventDefault(); handleAddTask(milestone.id, task.id); setSubtaskPromptParentId(null); }
                                      if (e.key === "Escape") setSubtaskPromptParentId(null);
                                    }}
                                  />
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { handleAddTask(milestone.id, task.id); setSubtaskPromptParentId(null); }}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </SortableContext>

                    {milestone.tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nessun task per questo milestone</p>
                    )}

                    {isEditable && (
                      <div className="flex gap-1.5 pt-2 border-t border-border">
                        <Input
                          value={newTaskInputs[milestone.id] || ""}
                          onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [milestone.id]: e.target.value }))}
                          placeholder="Aggiungi task..."
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(milestone.id); } }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={!newTaskInputs[milestone.id]?.trim()}
                          onClick={() => handleAddTask(milestone.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Task
                        </Button>
                      </div>
                    )}

                    {(isEditable || kpis.length > 0) && (
                      <EditableList milestoneId={milestone.id} field="kpis" items={kpis} label="Milestone di fase" icon={<Target className="h-3.5 w-3.5" />} colorClass="bg-success/5 border border-success/10" />
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        <DragOverlay>
          {activeDragTask && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2.5 bg-card border border-border shadow-lg">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm">{activeDragTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
              <PlanCanvas content={editedPlan.output_atteso || ""} onChange={(md) => setPlanField("output_atteso", md)} placeholder="Descrivi l'output atteso..." />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{displayPlan.output_atteso}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Persistent save bar in edit mode */}
      {isEditable && (
        <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {hasChanges ? (
              <span className="text-warning font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                Modifiche non salvate
              </span>
            ) : (
              <span className="text-muted-foreground">Nessuna modifica</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasChanges || saveMutation.isPending}
              onClick={() => {
                setEditedPlan(clonePlan(plan));
                setEditedKeyActivities(JSON.parse(JSON.stringify(keyActivities || [])));
                setHasChanges(false);
                setDeletedTaskIds([]);
                setDeletedKeyActivityIds([]);
              }}
            >
              Annulla
            </Button>
            <Button
              size="sm"
              disabled={!hasChanges || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Salvataggio..." : "Salva modifiche"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
