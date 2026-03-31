import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Loader2, X, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MILESTONE_CONFIG = [
  { label: "30d" as const, title: "Fase 1 — Giorni 1–30" },
  { label: "60d" as const, title: "Fase 2 — Giorni 30–60" },
  { label: "90d" as const, title: "Fase 3 — Giorni 60–90" },
];

const ROLE_OPTIONS = ["AE", "SDR", "CSM", "SE", "Manager"];

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

export default function CreatePlanDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Step 0: Basics
  const [repId, setRepId] = useState("");
  const [roleTemplate, setRoleTemplate] = useState("");
  const [premessa, setPremessa] = useState("");

  // Key activities
  const [keyActivities, setKeyActivities] = useState<KeyActivityDraft[]>([]);
  const [newActivityTitle, setNewActivityTitle] = useState("");

  // Step 1: Milestones
  const [milestones, setMilestones] = useState<Record<string, MilestoneData>>({
    "30d": { obiettivo: "", focus: [], kpis: [] },
    "60d": { obiettivo: "", focus: [], kpis: [] },
    "90d": { obiettivo: "", focus: [], kpis: [] },
  });

  // Step 2: Output
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

  // When role changes, pre-populate key activities from templates
  const handleRoleChange = (role: string) => {
    setRoleTemplate(role);
    // Templates will load via the query above; we populate in a separate handler
  };

  // Apply templates when they load
  const applyTemplates = () => {
    if (!activityTemplates?.length) return;
    const fromTemplates: KeyActivityDraft[] = activityTemplates.map((t) => ({
      tempId: crypto.randomUUID(),
      title: t.title,
      collection_id: t.collection_id,
      collection_title: collections?.find((c) => c.id === t.collection_id)?.title,
    }));
    setKeyActivities(fromTemplates);
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

      // Create milestones
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

      // Copy template tasks into milestones
      const { data: templates } = await supabase
        .from("onboarding_templates")
        .select("*")
        .order("order_index");

      if (templates && templates.length > 0) {
        const { data: createdMilestones } = await supabase
          .from("onboarding_milestones")
          .select("id, label")
          .eq("plan_id", plan.id);

        if (createdMilestones) {
          const milestoneMap = new Map(createdMilestones.map((m) => [m.label, m.id]));
          // Filter by role if template has role set, otherwise include all
          const filteredTemplates = templates.filter((t) => {
            const tRole = (t as any).role;
            if (!tRole) return true; // no role = universal
            return tRole === roleTemplate;
          });
          const taskRows = filteredTemplates
            .filter((t) => milestoneMap.has(t.milestone_label))
            .map((t) => ({
              milestone_id: milestoneMap.get(t.milestone_label)!,
              title: t.title,
              type: t.type,
              section: t.section,
              order_index: t.order_index,
              is_common: true,
            }));

          if (taskRows.length > 0) {
            await supabase.from("onboarding_tasks").insert(taskRows);
          }
        }
      }

      // Insert key activities
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

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuovo Piano
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && "Crea Piano di Onboarding"}
            {step === 1 && "Attività Chiave"}
            {step === 2 && "Configura Milestone"}
            {step === 3 && "Output Atteso"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: Basics */}
        {step === 0 && (
          <div className="space-y-4 pt-2">
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
              <Label>Premessa (opzionale)</Label>
              <Textarea
                placeholder="Contesto sul profilo, caratteristiche del ruolo, sfide specifiche..."
                value={premessa}
                onChange={(e) => setPremessa(e.target.value)}
                rows={5}
              />
            </div>

            <Button className="w-full" disabled={!repId} onClick={() => setStep(1)}>
              Avanti — Attività Chiave
            </Button>
          </div>
        )}

        {/* Step 1: Key Activities */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Attività evergreen che il nuovo hire deve completare, indipendenti dalla timeline 30-60-90.
            </p>

            {/* Load from template button */}
            {roleTemplate && ROLE_OPTIONS.includes(roleTemplate) && activityTemplates && activityTemplates.length > 0 && keyActivities.length === 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={applyTemplates}>
                <BookOpen className="h-3.5 w-3.5" />
                Carica template {roleTemplate}
              </Button>
            )}

            {/* Activity list */}
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

            {/* Add new */}
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

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                Indietro
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                Avanti — Milestone
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Milestones */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
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

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Avanti — Output Atteso
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Output */}
        {step === 3 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Output atteso a 90 giorni</Label>
              <Textarea
                placeholder="Descrivi il risultato atteso al termine del piano di onboarding..."
                value={outputAtteso}
                onChange={(e) => setOutputAtteso(e.target.value)}
                rows={6}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                Indietro
              </Button>
              <Button
                className="flex-1"
                disabled={!repId || createPlan.isPending}
                onClick={() => createPlan.mutate()}
              >
                {createPlan.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Crea Piano
              </Button>
            </div>
          </div>
        )}
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
