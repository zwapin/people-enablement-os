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

export default function CreatePlanDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [repId, setRepId] = useState("");
  const [roleTemplate, setRoleTemplate] = useState("");

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

      // Create plan
      const { data: plan, error: planError } = await supabase
        .from("onboarding_plans")
        .insert({
          rep_id: repId,
          created_by: user.id,
          role_template: roleTemplate || null,
        })
        .select()
        .single();
      if (planError) throw planError;

      // Create default milestones
      const milestones = [
        { plan_id: plan.id, label: "30d" as const, goals: ["Orientamento e primi strumenti"] },
        { plan_id: plan.id, label: "60d" as const, goals: ["Autonomia operativa"] },
        { plan_id: plan.id, label: "90d" as const, goals: ["Padronanza del ruolo"] },
      ];

      const { error: msError } = await supabase
        .from("onboarding_milestones")
        .insert(milestones);
      if (msError) throw msError;

      return plan;
    },
    onSuccess: () => {
      toast.success("Piano di onboarding creato");
      queryClient.invalidateQueries({ queryKey: ["onboarding-plans"] });
      queryClient.invalidateQueries({ queryKey: ["reps-without-plan"] });
      setOpen(false);
      setRepId("");
      setRoleTemplate("");
      onCreated?.();
    },
    onError: (err: Error) => {
      toast.error("Errore nella creazione: " + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuovo Piano
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crea Piano di Onboarding</DialogTitle>
        </DialogHeader>
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
            <Label>Ruolo / Template (opzionale)</Label>
            <Input
              placeholder="es. Account Executive, SDR..."
              value={roleTemplate}
              onChange={(e) => setRoleTemplate(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!repId || createPlan.isPending}
            onClick={() => createPlan.mutate()}
          >
            {createPlan.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Crea Piano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
