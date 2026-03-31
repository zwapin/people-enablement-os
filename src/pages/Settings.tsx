import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = ["AE", "SDR", "CSM", "SE", "Manager"];

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState("AE");
  const [newTitle, setNewTitle] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["key-activity-templates", activeRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_key_activity_templates")
        .select("*, curricula:collection_id(id, title)")
        .eq("role", activeRole)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["collections-all"],
    queryFn: async () => {
      const { data } = await supabase.from("curricula").select("id, title").order("title");
      return data || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["key-activity-templates", activeRole] });

  const addTemplate = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = templates.length > 0 ? Math.max(...templates.map((t: any) => t.order_index ?? 0)) + 1 : 0;
      const { error } = await supabase.from("onboarding_key_activity_templates").insert({
        role: activeRole,
        title,
        order_index: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setNewTitle(""); toast.success("Attività aggiunta"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_key_activity_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Attività rimossa"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("onboarding_key_activity_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveTemplate = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= templates.length) return;
    const a = templates[index];
    const b = templates[swapIndex];
    await Promise.all([
      supabase.from("onboarding_key_activity_templates").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("onboarding_key_activity_templates").update({ order_index: a.order_index }).eq("id", b.id),
    ]);
    invalidate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci i template delle attività chiave per ruolo</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Template Attività Chiave</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Queste attività vengono automaticamente assegnate quando si crea un nuovo piano di onboarding per il ruolo selezionato.
        </p>

        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <TabsList className="mb-4">
            {ROLE_OPTIONS.map((role) => (
              <TabsTrigger key={role} value={role}>{role}</TabsTrigger>
            ))}
          </TabsList>

          {ROLE_OPTIONS.map((role) => (
            <TabsContent key={role} value={role} className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-4">Caricamento...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nessun template per {role}. Aggiungine uno qui sotto.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t: any, i: number) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveTemplate(i, "up")}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === templates.length - 1} onClick={() => moveTemplate(i, "down")}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        defaultValue={t.title}
                        className="flex-1 h-8 text-sm"
                        onBlur={(e) => {
                          if (e.target.value !== t.title) {
                            updateTemplate.mutate({ id: t.id, updates: { title: e.target.value } });
                          }
                        }}
                      />
                      <Select
                        value={t.collection_id || "none"}
                        onValueChange={(v) =>
                          updateTemplate.mutate({ id: t.id, updates: { collection_id: v === "none" ? null : v } })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="Link collection..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna collection</SelectItem>
                          {collections.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteTemplate.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Nuova attività..."
                  className="flex-1 h-9"
                  onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTemplate.mutate(newTitle.trim()); }}
                />
                <Button
                  size="sm"
                  disabled={!newTitle.trim() || addTemplate.isPending}
                  onClick={() => addTemplate.mutate(newTitle.trim())}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
