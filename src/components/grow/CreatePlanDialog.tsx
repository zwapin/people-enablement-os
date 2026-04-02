import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, X, BookOpen, Trash2, Sparkles, User, ListChecks, Target, FileOutput, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TASK_SECTIONS } from "@/lib/constants";

const MILESTONE_CONFIG = [
  { label: "30d" as const, title: "Fase 1 — Giorni 1–30" },
  { label: "60d" as const, title: "Fase 2 — Giorni 30–60" },
  { label: "90d" as const, title: "Fase 3 — Giorni 60–90" },
];

const ROLE_OPTIONS = ["AE", "SDR", "CSM", "SE", "Manager"];

const STEPS = [
  { id: 0, title: "Informazioni Base", subtitle: "Rep, ruolo e intro", icon: User },
  { id: 1, title: "Attività Chiave", subtitle: "Todo evergreen per ruolo", icon: ListChecks },
  { id: 2, title: "Milestone 30-60-90", subtitle: "Obiettivi, focus e KPI", icon: Target },
  { id: 3, title: "Output Atteso", subtitle: "Risultato a 90 giorni", icon: FileOutput },
];

type MilestoneData = {
  obiettivo: string;
  focus: string[];
  kpis: string[];
};

type KeyActivityDraft = {
  tempId: string;
  title: string;
  collection_id: string | null;
  collection_title?: string;
};

type TaskDraft = {
  tempId: string;
  title: string;
  section: string;
};

export default function CreatePlanDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Step 0: Basics
  const [repId, setRepId] = useState("");
  const [roleTemplate, setRoleTemplate] = useState("");
  const [premessa, setPremessa] = useState("");

  // Key activities
  const [keyActivities, setKeyActivities] = useState<KeyActivityDraft[]>([]);
  const [newActivityTitle, setNewActivityTitle] = useState("");

  // Step 2: Milestones
  const [milestones, setMilestones] = useState<Record<string, MilestoneData>>({
    "30d": { obiettivo: "", focus: [], kpis: [] },
    "60d": { obiettivo: "", focus: [], kpis: [] },
    "90d": { obiettivo: "", focus: [], kpis: [] },
  });

  // Milestone tasks (grouped by milestone label)
  const [milestoneTasks, setMilestoneTasks] = useState<Record<string, TaskDraft[]>>({
    "30d": [],
    "60d": [],
    "90d": [],
  });
  const [newMilestoneTaskInputs, setNewMilestoneTaskInputs] = useState<Record<string, string>>({});
  const [newMilestoneTaskSections, setNewMilestoneTaskSections] = useState<Record<string, string>>({});

  // Step 3: Output
  const [outputAtteso, setOutputAtteso] = useState("");

  // Fetch reps without an active plan
  const { data: reps } = useQuery({
    queryKey: ["reps-without-plan"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "rep")
        .eq("is_active", true);

      const { data: activePlans } = await supabase
        .from("onboarding_plans")
        .select("rep_id")
        .eq("plan_status", "active");

      const activeRepIds = new Set((activePlans || []).map((p) => p.rep_id));
      return (profiles || []).filter((p) => !activeRepIds.has(p.user_id));
    },
    enabled: open,
  });

  // Fetch collections for linking
  const { data: collections } = useQuery({
    queryKey: ["collections-for-linking"],
    queryFn: async () => {
      const { data } = await supabase.from("curricula").select("id, title").order("title");
      return data || [];
    },
    enabled: open,
  });

  // Fetch key activity templates when role changes
  const { data: activityTemplates } = useQuery({
    queryKey: ["key-activity-templates", roleTemplate],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_key_activity_templates")
        .select("*")
        .eq("role", roleTemplate)
        .order("order_index");
      return data || [];
    },
    enabled: open && !!roleTemplate && ROLE_OPTIONS.includes(roleTemplate),
  });

  // Fetch milestone task templates when role changes
  const { data: taskTemplates } = useQuery({
    queryKey: ["milestone-task-templates", roleTemplate],
    queryFn: async () => {
      let q = supabase.from("onboarding_templates").select("*").order("order_index");
      if (roleTemplate) {
        q = q.or(`role.eq.${roleTemplate},role.is.null`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: open && !!roleTemplate,
  });

  const prevRoleRef = useRef(roleTemplate);

  // Auto-populate key activities when templates load for the selected role
  useEffect(() => {
    if (!activityTemplates?.length || !roleTemplate) return;
    if (prevRoleRef.current !== roleTemplate || keyActivities.length === 0) {
      const fromTemplates: KeyActivityDraft[] = activityTemplates.map((t) => ({
        tempId: crypto.randomUUID(),
        title: t.title,
        collection_id: t.collection_id,
        collection_title: collections?.find((c) => c.id === t.collection_id)?.title,
      }));
      setKeyActivities(fromTemplates);
      prevRoleRef.current = roleTemplate;
    }
  }, [activityTemplates, roleTemplate, collections]);

  // Auto-populate milestone tasks when task templates load
  const prevTaskRoleRef = useRef(roleTemplate);
  useEffect(() => {
    if (!taskTemplates?.length || !roleTemplate) return;
    if (prevTaskRoleRef.current !== roleTemplate || Object.values(milestoneTasks).every(arr => arr.length === 0)) {
      const grouped: Record<string, TaskDraft[]> = { "30d": [], "60d": [], "90d": [] };
      for (const t of taskTemplates) {
        const label = t.milestone_label;
        if (grouped[label]) {
          grouped[label].push({
            tempId: crypto.randomUUID(),
            title: t.title,
            section: t.section || TASK_SECTIONS[0],
          });
        }
      }
      setMilestoneTasks(grouped);
      prevTaskRoleRef.current = roleTemplate;
    }
  }, [taskTemplates, roleTemplate]);

  const handleRoleChange = (role: string) => {
    setRoleTemplate(role);
  };

  const addKeyActivity = () => {
    if (!newActivityTitle.trim()) return;
    setKeyActivities((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), title: newActivityTitle.trim(), collection_id: null },
    ]);
    setNewActivityTitle("");
  };

  const removeKeyActivity = (tempId: string) => {
    setKeyActivities((prev) => prev.filter((a) => a.tempId !== tempId));
  };

  const updateKeyActivityCollection = (tempId: string, collectionId: string | null) => {
    setKeyActivities((prev) =>
      prev.map((a) =>
        a.tempId === tempId
          ? { ...a, collection_id: collectionId, collection_title: collections?.find((c) => c.id === collectionId)?.title }
          : a
      )
    );
  };

  // AI Generation
  const generateWithAI = async (type: "premessa" | "milestones" | "output") => {
    if (!roleTemplate) {
      toast.error("Seleziona prima un ruolo per generare con AI");
      return;
    }
    setAiLoading(type);
    try {
      const repName = reps?.find((r) => r.user_id === repId)?.full_name || "";
      const { data, error } = await supabase.functions.invoke("generate-onboarding-plan", {
        body: { type, role: roleTemplate, repName, premessa, milestones },
      });
      if (error) throw error;

      if (type === "premessa" && data.premessa) {
        setPremessa(data.premessa);
        toast.success("Intro generata — puoi modificarla");
      } else if (type === "milestones" && data["30d"]) {
        setMilestones({
          "30d": { obiettivo: data["30d"].obiettivo || "", focus: data["30d"].focus || [], kpis: data["30d"].kpis || [] },
          "60d": { obiettivo: data["60d"].obiettivo || "", focus: data["60d"].focus || [], kpis: data["60d"].kpis || [] },
          "90d": { obiettivo: data["90d"].obiettivo || "", focus: data["90d"].focus || [], kpis: data["90d"].kpis || [] },
        });
        toast.success("Milestone generati — puoi modificarli");
      } else if (type === "output" && data.output_atteso) {
        setOutputAtteso(data.output_atteso);
        toast.success("Output atteso generato — puoi modificarlo");
      }
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error(err?.message || "Errore nella generazione AI");
    } finally {
      setAiLoading(null);
    }
  };

  const createPlan = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non autenticato");

      const { data: plan, error: planError } = await supabase
        .from("onboarding_plans")
        .insert({
          rep_id: repId,
          created_by: user.id,
          role_template: roleTemplate || null,
          premessa: premessa || null,
          output_atteso: outputAtteso || null,
        })
        .select()
        .single();
      if (planError) throw planError;

      const milestoneRows = MILESTONE_CONFIG.map((mc) => {
        const data = milestones[mc.label];
        return {
          plan_id: plan.id,
          label: mc.label,
          obiettivo: data.obiettivo || null,
          focus: data.focus.length > 0 ? data.focus : [],
          kpis: data.kpis.length > 0 ? data.kpis : [],
        };
      });

      const { error: msError } = await supabase.from("onboarding_milestones").insert(milestoneRows);
      if (msError) throw msError;

      // Insert tasks from milestoneTasks state (user-curated in stepper)
      const { data: createdMilestones } = await supabase
        .from("onboarding_milestones")
        .select("id, label")
        .eq("plan_id", plan.id);

      if (createdMilestones) {
        const milestoneMap = new Map(createdMilestones.map((m) => [m.label, m.id]));
        const taskRows: { milestone_id: string; title: string; type: "activity" | "meeting" | "module_link"; section: string | null; order_index: number; is_common: boolean }[] = [];
        for (const [label, tasks] of Object.entries(milestoneTasks)) {
          const msId = milestoneMap.get(label);
          if (!msId) continue;
          tasks.forEach((t, i) => {
            taskRows.push({
              milestone_id: msId,
              title: t.title,
              type: "activity",
              section: t.section || null,
              order_index: i,
              is_common: true,
            });
          });
        }
        if (taskRows.length > 0) {
          await supabase.from("onboarding_tasks").insert(taskRows);
        }
      }

      if (keyActivities.length > 0) {
        const kaRows = keyActivities.map((a, i) => ({
          plan_id: plan.id,
          title: a.title,
          collection_id: a.collection_id || null,
          order_index: i,
        }));
        const { error: kaErr } = await supabase.from("onboarding_key_activities").insert(kaRows);
        if (kaErr) throw kaErr;
      }

      return plan;
    },
    onSuccess: () => {
      toast.success("Piano di onboarding creato");
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
      queryClient.invalidateQueries({ queryKey: ["reps-without-plan"] });
      resetForm();
      setOpen(false);
      onCreated?.();
    },
    onError: (err: Error) => {
      toast.error("Errore nella creazione: " + err.message);
    },
  });

  const resetForm = () => {
    setStep(0);
    setRepId("");
    setRoleTemplate("");
    setPremessa("");
    setOutputAtteso("");
    setKeyActivities([]);
    setNewActivityTitle("");
    setMilestones({
      "30d": { obiettivo: "", focus: [], kpis: [] },
      "60d": { obiettivo: "", focus: [], kpis: [] },
      "90d": { obiettivo: "", focus: [], kpis: [] },
    });
    setMilestoneTasks({ "30d": [], "60d": [], "90d": [] });
    setNewMilestoneTaskInputs({});
    setNewMilestoneTaskSections({});
  };

  const updateMilestone = (label: string, field: keyof MilestoneData, value: string | string[]) => {
    setMilestones((prev) => ({
      ...prev,
      [label]: { ...prev[label], [field]: value },
    }));
  };

  const addListItem = (label: string, field: "focus" | "kpis", value: string) => {
    if (!value.trim()) return;
    setMilestones((prev) => ({
      ...prev,
      [label]: { ...prev[label], [field]: [...prev[label][field], value.trim()] },
    }));
  };

  const removeListItem = (label: string, field: "focus" | "kpis", index: number) => {
    setMilestones((prev) => ({
      ...prev,
      [label]: {
        ...prev[label],
        [field]: prev[label][field].filter((_, i) => i !== index),
      },
    }));
  };

  const canProceed = (s: number) => {
    if (s === 0) return !!repId;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuovo Piano
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-full h-[95vh] p-0 flex gap-0 [&>button]:hidden">
        {/* Sidebar Stepper */}
        <aside className="w-60 shrink-0 border-r bg-muted/30 p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-1">Nuovo Piano</h2>
          <p className="text-xs text-muted-foreground mb-8">Configura il piano di onboarding</p>

          <nav className="flex-1 space-y-1">
            {STEPS.map((s, i) => {
              const isDone = step > s.id;
              const isCurrent = step === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (isDone) setStep(s.id); }}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                    isCurrent && "bg-primary/10 text-primary",
                    isDone && "text-muted-foreground hover:bg-muted/50 cursor-pointer",
                    !isDone && !isCurrent && "text-muted-foreground/50 cursor-default"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isDone && "border-primary bg-primary/10 text-primary",
                    !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground/40"
                  )}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("text-sm font-medium", !isCurrent && !isDone && "text-muted-foreground/50")}>
                      {s.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground/70 leading-tight">{s.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-8 lg:p-10">
            <h3 className="text-xl font-semibold mb-1">{STEPS[step].title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{STEPS[step].subtitle}</p>

            {/* Step 0: Basics */}
            {step === 0 && (
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <Label>Membro del team</Label>
                  <Select value={repId} onValueChange={setRepId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un Klaaryan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(reps || []).map((r) => (
                        <SelectItem key={r.user_id} value={r.user_id}>
                          {r.full_name} ({r.email})
                        </SelectItem>
                      ))}
                      {reps?.length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          Tutti i rep hanno già un piano attivo
                        </p>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ruolo</Label>
                  <Select value={roleTemplate} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona il ruolo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intro (opzionale)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      disabled={!roleTemplate || aiLoading === "premessa"}
                      onClick={() => generateWithAI("premessa")}
                    >
                      {aiLoading === "premessa" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Genera con AI
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Contesto sul profilo, caratteristiche del ruolo, sfide specifiche..."
                    value={premessa}
                    onChange={(e) => setPremessa(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>
            )}

            {/* Step 1: Key Activities */}
            {step === 1 && (
              <div className="space-y-5 max-w-xl">
                <p className="text-sm text-muted-foreground">
                  Attività evergreen che il nuovo hire deve completare, indipendenti dalla timeline 30-60-90.
                </p>

                {!roleTemplate && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
                    Seleziona un ruolo nello step precedente per caricare automaticamente le attività template.
                  </p>
                )}

                <div className="space-y-2">
                  {keyActivities.map((activity) => (
                    <div key={activity.tempId} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                      <Checkbox checked={false} disabled className="opacity-50" />
                      <span className="flex-1 text-sm">{activity.title}</span>
                      {activity.collection_id && activity.collection_title && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <BookOpen className="h-3 w-3" />
                          {activity.collection_title}
                        </Badge>
                      )}
                      <Select
                        value={activity.collection_id || "none"}
                        onValueChange={(v) => updateKeyActivityCollection(activity.tempId, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue placeholder="Link collection..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna</SelectItem>
                          {(collections || []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeKeyActivity(activity.tempId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Aggiungi attività chiave..."
                    value={newActivityTitle}
                    onChange={(e) => setNewActivityTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyActivity(); } }}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addKeyActivity} disabled={!newActivityTitle.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Milestones */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Configura obiettivi, focus e KPI per ogni fase.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    disabled={!roleTemplate || aiLoading === "milestones"}
                    onClick={() => generateWithAI("milestones")}
                  >
                    {aiLoading === "milestones" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Genera con AI
                  </Button>
                </div>

                <Tabs defaultValue="30d">
                  <TabsList className="w-full">
                    {MILESTONE_CONFIG.map((mc) => (
                      <TabsTrigger key={mc.label} value={mc.label} className="flex-1 text-xs">
                        {mc.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {MILESTONE_CONFIG.map((mc) => (
                    <TabsContent key={mc.label} value={mc.label} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Obiettivo della fase</Label>
                        <Textarea
                          placeholder="Obiettivo principale di questa fase..."
                          value={milestones[mc.label].obiettivo}
                          onChange={(e) => updateMilestone(mc.label, "obiettivo", e.target.value)}
                          rows={2}
                        />
                      </div>

                      <ListEditor
                        label="Focus"
                        placeholder="Aggiungi punto di focus..."
                        items={milestones[mc.label].focus}
                        onAdd={(v) => addListItem(mc.label, "focus", v)}
                        onRemove={(i) => removeListItem(mc.label, "focus", i)}
                      />

                      <ListEditor
                        label="KPI / Milestone di fase"
                        placeholder="Aggiungi KPI misurabile..."
                        items={milestones[mc.label].kpis}
                        onAdd={(v) => addListItem(mc.label, "kpis", v)}
                        onRemove={(i) => removeListItem(mc.label, "kpis", i)}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {/* Step 3: Output */}
            {step === 3 && (
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Output atteso a 90 giorni</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      disabled={!roleTemplate || aiLoading === "output"}
                      onClick={() => generateWithAI("output")}
                    >
                      {aiLoading === "output" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Genera con AI
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Descrivi il risultato atteso al termine del piano di onboarding..."
                    value={outputAtteso}
                    onChange={(e) => setOutputAtteso(e.target.value)}
                    rows={6}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-8 lg:px-10 py-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Indietro
            </Button>

            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed(step)}>
                Avanti
              </Button>
            ) : (
              <Button
                disabled={!repId || createPlan.isPending}
                onClick={() => createPlan.mutate()}
              >
                {createPlan.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Crea Piano
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reusable list editor component
function ListEditor({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    onAdd(inputValue);
    setInputValue("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="text-sm"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={!inputValue.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="flex-1">{item}</span>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
