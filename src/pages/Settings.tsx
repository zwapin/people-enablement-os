import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TASK_SECTIONS } from "@/lib/constants";

const DEFAULT_ROLES = ["AE", "SDR", "CSM", "SE", "Manager"];
const MILESTONE_LABELS = [
  { value: "30d", label: "Fase 1 — 30 giorni" },
  { value: "60d", label: "Fase 2 — 60 giorni" },
  { value: "90d", label: "Fase 3 — 90 giorni" },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const [settingsTab, setSettingsTab] = useState("key-activities");

  // ─── Key Activity Templates ───
  const [activeRole, setActiveRole] = useState("AE");
  const [newTitle, setNewTitle] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["template-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_key_activity_templates")
        .select("role");
      if (error) throw error;
      const dbRoles = [...new Set((data || []).map((r) => r.role))].sort();
      return dbRoles.length > 0 ? dbRoles : DEFAULT_ROLES;
    },
  });

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["key-activity-templates", activeRole] });
    queryClient.invalidateQueries({ queryKey: ["template-roles"] });
  };

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

  const renameRole = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { error } = await supabase
        .from("onboarding_key_activity_templates")
        .update({ role: newName })
        .eq("role", oldName);
      if (error) throw error;
    },
    onSuccess: (_, { newName }) => {
      queryClient.invalidateQueries({ queryKey: ["template-roles"] });
      queryClient.invalidateQueries({ queryKey: ["key-activity-templates"] });
      setActiveRole(newName);
      setEditingRole(null);
      toast.success("Ruolo rinominato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: async (role: string) => {
      const { error } = await supabase
        .from("onboarding_key_activity_templates")
        .delete()
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: (_, role) => {
      queryClient.invalidateQueries({ queryKey: ["template-roles"] });
      queryClient.invalidateQueries({ queryKey: ["key-activity-templates"] });
      if (activeRole === role) {
        setActiveRole(roles.find((r) => r !== role) || "AE");
      }
      setRoleToDelete(null);
      toast.success("Ruolo e relativi template eliminati");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRole = () => {
    const name = newRoleName.trim().toUpperCase();
    if (!name) return;
    if (roles.includes(name)) {
      toast.error("Questo ruolo esiste già");
      return;
    }
    queryClient.setQueryData(["template-roles"], [...roles, name]);
    setActiveRole(name);
    setNewRoleName("");
    toast.success(`Ruolo ${name} aggiunto`);
  };

  // ─── Milestone Task Templates ───
  const [mtRole, setMtRole] = useState("AE");
  const [mtMilestone, setMtMilestone] = useState("30d");
  const [mtNewTitle, setMtNewTitle] = useState("");
  const [mtNewSection, setMtNewSection] = useState<string>(TASK_SECTIONS[0]);

  const { data: mtTemplates = [], isLoading: mtLoading } = useQuery({
    queryKey: ["milestone-templates", mtRole, mtMilestone],
    queryFn: async () => {
      let q = supabase.from("onboarding_templates").select("*").order("order_index");
      q = q.eq("milestone_label", mtMilestone as "30d" | "60d" | "90d");
      q = q.or(`role.eq.${mtRole},role.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateMt = () => {
    queryClient.invalidateQueries({ queryKey: ["milestone-templates", mtRole, mtMilestone] });
  };

  const addMtTemplate = useMutation({
    mutationFn: async ({ title, section }: { title: string; section: string }) => {
      const maxOrder = mtTemplates.length > 0 ? Math.max(...mtTemplates.map((t: any) => t.order_index ?? 0)) + 1 : 0;
      const { error } = await supabase.from("onboarding_templates").insert({
        role: mtRole,
        milestone_label: mtMilestone as "30d" | "60d" | "90d",
        title,
        section,
        order_index: maxOrder,
        type: "activity" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateMt(); setMtNewTitle(""); toast.success("Task template aggiunto"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMtTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateMt(); toast.success("Task template rimosso"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMtTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("onboarding_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMt(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci i template per i piani di onboarding</p>
      </div>

      <Tabs value={settingsTab} onValueChange={setSettingsTab}>
        <TabsList>
          <TabsTrigger value="key-activities">Attività Chiave</TabsTrigger>
          <TabsTrigger value="milestone-tasks">Task per Milestone</TabsTrigger>
        </TabsList>

        {/* ─── Tab: Attività Chiave ─── */}
        <TabsContent value="key-activities">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Template Attività Chiave</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Queste attività vengono automaticamente assegnate quando si crea un nuovo piano di onboarding per il ruolo selezionato.
            </p>

            <Tabs value={activeRole} onValueChange={setActiveRole}>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <TabsList>
                  {roles.map((role) => (
                    <TabsTrigger key={role} value={role} className="relative group">
                      {editingRole === role ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingRoleName}
                            onChange={(e) => setEditingRoleName(e.target.value.toUpperCase())}
                            className="h-5 w-16 text-xs px-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingRoleName.trim()) {
                                renameRole.mutate({ oldName: role, newName: editingRoleName.trim() });
                              }
                              if (e.key === "Escape") setEditingRole(null);
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); if (editingRoleName.trim()) renameRole.mutate({ oldName: role, newName: editingRoleName.trim() }); }}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); setEditingRole(null); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          {role}
                          <span className="hidden group-hover:inline-flex items-center ml-1 gap-0.5">
                            <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditingRole(role); setEditingRoleName(role); }} />
                            <X className="h-3 w-3 text-muted-foreground hover:text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); setRoleToDelete(role); }} />
                          </span>
                        </>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex items-center gap-1">
                  <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value.toUpperCase())} placeholder="Nuovo ruolo..." className="h-8 w-28 text-xs" onKeyDown={(e) => { if (e.key === "Enter") addRole(); }} />
                  <Button size="sm" variant="outline" className="h-8" onClick={addRole} disabled={!newRoleName.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {roles.map((role) => (
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
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveTemplate(i, "up")}><ArrowUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === templates.length - 1} onClick={() => moveTemplate(i, "down")}><ArrowDown className="h-3 w-3" /></Button>
                          </div>
                          <Input defaultValue={t.title} className="flex-1 h-8 text-sm" onBlur={(e) => { if (e.target.value !== t.title) updateTemplate.mutate({ id: t.id, updates: { title: e.target.value } }); }} />
                          <Select value={t.collection_id || "none"} onValueChange={(v) => updateTemplate.mutate({ id: t.id, updates: { collection_id: v === "none" ? null : v } })}>
                            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Link collection..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nessuna collection</SelectItem>
                              {collections.map((c) => (<SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteTemplate.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nuova attività..." className="flex-1 h-9" onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTemplate.mutate(newTitle.trim()); }} />
                    <Button size="sm" disabled={!newTitle.trim() || addTemplate.isPending} onClick={() => addTemplate.mutate(newTitle.trim())}>
                      <Plus className="h-4 w-4 mr-1" />Aggiungi
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </TabsContent>

        {/* ─── Tab: Task per Milestone ─── */}
        <TabsContent value="milestone-tasks">
          <div className="rounded-lg border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">Template Task per Milestone</h2>
              <p className="text-sm text-muted-foreground">
                Task che vengono pre-caricati nello stepper di creazione piano, raggruppati per sezione (Attività Chiave / Coaching).
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ruolo</label>
                <Select value={mtRole} onValueChange={setMtRole}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(roles.length > 0 ? roles : DEFAULT_ROLES).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fase</label>
                <Select value={mtMilestone} onValueChange={setMtMilestone}>
                  <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MILESTONE_LABELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Template list grouped by section */}
            {mtLoading ? (
              <p className="text-sm text-muted-foreground py-4">Caricamento...</p>
            ) : (
              <div className="space-y-4">
                {TASK_SECTIONS.map((section) => {
                  const sectionTemplates = mtTemplates.filter((t: any) => (t.section || TASK_SECTIONS[0]) === section);
                  return (
                    <div key={section} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{section}</p>
                      {sectionTemplates.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic pl-1">Nessun template</p>
                      ) : (
                        sectionTemplates.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                            <Input
                              defaultValue={t.title}
                              className="flex-1 h-8 text-sm"
                              onBlur={(e) => { if (e.target.value !== t.title) updateMtTemplate.mutate({ id: t.id, updates: { title: e.target.value } }); }}
                            />
                            <Select
                              value={t.section || TASK_SECTIONS[0]}
                              onValueChange={(v) => updateMtTemplate.mutate({ id: t.id, updates: { section: v } })}
                            >
                              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TASK_SECTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMtTemplate.mutate(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new template */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input
                value={mtNewTitle}
                onChange={(e) => setMtNewTitle(e.target.value)}
                placeholder="Nuovo task template..."
                className="flex-1 h-9"
                onKeyDown={(e) => { if (e.key === "Enter" && mtNewTitle.trim()) addMtTemplate.mutate({ title: mtNewTitle.trim(), section: mtNewSection }); }}
              />
              <Select value={mtNewSection} onValueChange={setMtNewSection}>
                <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_SECTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!mtNewTitle.trim() || addMtTemplate.isPending} onClick={() => addMtTemplate.mutate({ title: mtNewTitle.trim(), section: mtNewSection })}>
                <Plus className="h-4 w-4 mr-1" />Aggiungi
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete role confirmation */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il ruolo "{roleToDelete}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eliminati anche tutti i template delle attività chiave associati a questo ruolo. Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => roleToDelete && deleteRole.mutate(roleToDelete)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}