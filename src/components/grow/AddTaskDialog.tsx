import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Milestone = Tables<"onboarding_milestones">;

const MILESTONE_LABELS: Record<string, string> = {
  "30d": "Fase 1 — 30 Giorni",
  "60d": "Fase 2 — 60 Giorni",
  "90d": "Fase 3 — 90 Giorni",
};

const TASK_TYPES = [
  { value: "activity", label: "Attività" },
  { value: "module_link", label: "Modulo" },
  { value: "meeting", label: "Meeting" },
];

interface AddTaskDialogProps {
  milestones: Milestone[];
}

export default function AddTaskDialog({ milestones }: AddTaskDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [milestoneId, setMilestoneId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("activity");
  const [section, setSection] = useState("");

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("onboarding_tasks").insert({
        milestone_id: milestoneId,
        title,
        type: type as "activity" | "module_link" | "meeting",
        section: section || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task aggiunto");
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
      setOpen(false);
      setTitle("");
      setMilestoneId("");
      setType("activity");
      setSection("");
    },
    onError: () => toast.error("Errore nell'aggiunta del task"),
  });

  const sortedMilestones = [...milestones].sort((a, b) => {
    const order = { "30d": 0, "60d": 1, "90d": 2 };
    return (order[a.label] ?? 0) - (order[b.label] ?? 0);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Aggiungi Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Milestone</Label>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona milestone..." />
              </SelectTrigger>
              <SelectContent>
                {sortedMilestones.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {MILESTONE_LABELS[m.label] || m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              placeholder="es. Shadowing su 5 deal attivi..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Sezione / Area (opzionale)</Label>
            <Input
              placeholder="es. Integrazione SDR, Discovery avanzata..."
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={!milestoneId || !title.trim() || addTask.isPending}
            onClick={() => addTask.mutate()}
          >
            {addTask.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Aggiungi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
