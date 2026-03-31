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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MILESTONE_CONFIG = [
  { label: "30d" as const, title: "Fase 1 — Giorni 1–30" },
  { label: "60d" as const, title: "Fase 2 — Giorni 30–60" },
  { label: "90d" as const, title: "Fase 3 — Giorni 60–90" },
];

type MilestoneData = {
  obiettivo: string;
  focus: string[];
  kpis: string[];
};

export default function CreatePlanDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0=basics, 1=milestones, 2=output

  // Step 0: Basics
  const [repId, setRepId] = useState("");
  const [roleTemplate, setRoleTemplate] = useState("");
  const [premessa, setPremessa] = useState("");

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

      // Create milestones with rich data
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

      const { error: msError } = await supabase
        .from("onboarding_milestones")
        .insert(milestoneRows);
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
          const taskRows = templates
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

  const addListItem = (label: string, field: "focus" | "kpis" | "early_warnings", value: string) => {
    if (!value.trim()) return;
    setMilestones((prev) => ({
      ...prev,
      [label]: { ...prev[label], [field]: [...prev[label][field], value.trim()] },
    }));
  };

  const removeListItem = (label: string, field: "focus" | "kpis" | "early_warnings", index: number) => {
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
            {step === 1 && "Configura Milestone"}
            {step === 2 && "Output Atteso"}
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
              <Label>Ruolo / Template</Label>
              <Input
                placeholder="es. Account Executive Enterprise, SDR..."
                value={roleTemplate}
                onChange={(e) => setRoleTemplate(e.target.value)}
              />
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
              Avanti — Configura Milestone
            </Button>
          </div>
        )}

        {/* Step 1: Milestones */}
        {step === 1 && (
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

                  <ListEditor
                    label="Early Warning"
                    placeholder="Aggiungi segnale di allarme..."
                    items={milestones[mc.label].early_warnings}
                    onAdd={(v) => addListItem(mc.label, "early_warnings", v)}
                    onRemove={(i) => removeListItem(mc.label, "early_warnings", i)}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                Indietro
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                Avanti — Output Atteso
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Output */}
        {step === 2 && (
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
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
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
