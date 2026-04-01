import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Trash2, Pencil, Check, X, ChevronDown } from "lucide-react";
import { TEAMS } from "@/lib/constants";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  departments?: any;
  job_role: string | null;
  role: "admin" | "rep";
  is_active: boolean;
  last_activity_at: string | null;
  created_at: string;
  member_type?: string;
}

function getProfileDepartments(p: ProfileRow): string[] {
  if (Array.isArray(p.departments) && p.departments.length > 0) return p.departments;
  if (p.department) return [p.department];
  return [];
}

interface PeopleTableProps {
  profiles: ProfileRow[];
  onRefresh: () => void;
}

function MultiTeamSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggleTeam = (team: string) => {
    if (value.includes(team)) {
      onChange(value.filter(t => t !== team));
    } else {
      onChange([...value, team]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[140px]">
          {value.length === 0 ? "Seleziona team" : `${value.length} team`}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-1">
          {TEAMS.map((team) => (
            <label key={team} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer">
              <Checkbox
                checked={value.includes(team)}
                onCheckedChange={() => toggleTeam(team)}
              />
              {team}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PeopleTable({ profiles, onRefresh }: PeopleTableProps) {
  const isMobile = useIsMobile();
  const [profileToDelete, setProfileToDelete] = useState<ProfileRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    full_name?: string;
    email?: string;
    departments?: string[];
    job_role?: string;
    member_type?: string;
  }>({});

  const startEditing = (p: ProfileRow) => {
    setEditingId(p.id);
    setEditValues({
      full_name: p.full_name,
      email: p.email,
      departments: getProfileDepartments(p),
      job_role: p.job_role ?? "",
      member_type: (p as any).member_type ?? "new_klaaryan",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEditing = async (profileId: string) => {
    const depts = editValues.departments ?? [];
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editValues.full_name,
        email: editValues.email,
        department: depts[0] || null,
        departments: depts,
        job_role: editValues.job_role || null,
        member_type: editValues.member_type || "new_klaaryan",
      } as any)
      .eq("id", profileId);

    if (error) {
      toast.error("Errore nel salvataggio");
    } else {
      toast.success("Profilo aggiornato");
      setEditingId(null);
      setEditValues({});
      onRefresh();
    }
  };

  const handleDeleteProfile = async (profile: ProfileRow) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", profile.id);

      await supabase.functions.invoke("delete-user", {
        body: { user_id: profile.user_id },
      });

      if (error) throw error;

      toast.success(`${profile.full_name} è stato rimosso`);
      setProfileToDelete(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Errore nella rimozione");
    }
  };

  const handleToggleActive = async (profile: ProfileRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      toast.error("Errore nell'aggiornamento dello stato");
    } else {
      onRefresh();
    }
  };

  const handleCombinedRoleChange = async (profile: ProfileRow, newValue: string) => {
    let newRole: "admin" | "rep";
    let newMemberType: string;
    if (newValue === "admin") {
      newRole = "admin";
      newMemberType = profile.member_type ?? "new_klaaryan";
    } else if (newValue === "veteran_klaaryan") {
      newRole = "rep";
      newMemberType = "veteran_klaaryan";
    } else {
      newRole = "rep";
      newMemberType = "new_klaaryan";
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole, member_type: newMemberType } as any)
      .eq("id", profile.id);

    if (error) {
      toast.error("Errore nell'aggiornamento del ruolo");
    } else {
      onRefresh();
    }
  };

  const getCombinedRole = (p: ProfileRow): string => {
    if (p.role === "admin") return "admin";
    return (p as any).member_type === "veteran_klaaryan" ? "veteran_klaaryan" : "new_klaaryan";
  };

  if (profiles.length === 0) {
    return (
      <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
        Nessun membro del team. Invita il tuo primo membro per iniziare.
      </div>
    );
  }

  const renderTeamBadges = (p: ProfileRow) => {
    const depts = getProfileDepartments(p);
    if (depts.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {depts.map((d) => (
          <Badge key={d} variant="secondary" className="font-normal text-[10px]">{d}</Badge>
        ))}
      </div>
    );
  };

  const renderMemberType = (p: ProfileRow) => {
    const mt = (p as any).member_type ?? "new_klaaryan";
    return (
      <Badge
        variant="outline"
        className={`text-[10px] ${mt === "veteran_klaaryan" ? "border-primary/40 text-primary" : "border-muted text-muted-foreground"}`}
      >
        {mt === "veteran_klaaryan" ? "Veteran" : "New"}
      </Badge>
    );
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {profiles.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <Card key={p.id} className="p-4 space-y-3 border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editValues.full_name ?? ""} onChange={(e) => setEditValues({ ...editValues, full_name: e.target.value })} className="h-8 text-sm" placeholder="Nome" />
                      <Input value={editValues.email ?? ""} onChange={(e) => setEditValues({ ...editValues, email: e.target.value })} className="h-8 text-sm" placeholder="Email" />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-foreground truncate">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                    </>
                  )}
                </div>
                <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {isEditing ? (
                  <>
                    <MultiTeamSelect value={editValues.departments ?? []} onChange={(v) => setEditValues({ ...editValues, departments: v })} />
                    <Input value={editValues.job_role ?? ""} onChange={(e) => setEditValues({ ...editValues, job_role: e.target.value })} className="h-8 text-xs w-36" placeholder="Ruolo lavorativo" />
                    <Select value={editValues.member_type ?? "new_klaaryan"} onValueChange={(v) => setEditValues({ ...editValues, member_type: v })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_klaaryan">New Klaaryan</SelectItem>
                        <SelectItem value="veteran_klaaryan">Veteran Klaaryan</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    {renderTeamBadges(p)}
                    {p.job_role && <span className="text-muted-foreground">{p.job_role}</span>}
                    {renderMemberType(p)}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Select value={getCombinedRole(p)} onValueChange={(v) => handleCombinedRoleChange(p, v)}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="new_klaaryan">New Klaaryan</SelectItem>
                    <SelectItem value="veteran_klaaryan">Veteran Klaaryan</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveEditing(p.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setProfileToDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        <AlertDialog open={!!profileToDelete} onOpenChange={(open) => !open && setProfileToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rimuovere {profileToDelete?.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>L'utente verrà disattivato e non potrà più accedere alla piattaforma.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => profileToDelete && handleDeleteProfile(profileToDelete)}>Rimuovi</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Ruolo lavorativo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead>Ultima attività</TableHead>
            <TableHead>Attivo</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {isEditing ? (
                    <Input value={editValues.full_name ?? ""} onChange={(e) => setEditValues({ ...editValues, full_name: e.target.value })} className="h-8 text-sm w-40" />
                  ) : p.full_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {isEditing ? (
                    <Input value={editValues.email ?? ""} onChange={(e) => setEditValues({ ...editValues, email: e.target.value })} className="h-8 text-sm w-48" />
                  ) : p.email}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <MultiTeamSelect value={editValues.departments ?? []} onChange={(v) => setEditValues({ ...editValues, departments: v })} />
                  ) : renderTeamBadges(p)}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input value={editValues.job_role ?? ""} onChange={(e) => setEditValues({ ...editValues, job_role: e.target.value })} className="h-8 text-sm w-36" placeholder="Ruolo" />
                  ) : (p.job_role || <span className="text-muted-foreground">—</span>)}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Select value={editValues.member_type ?? "new_klaaryan"} onValueChange={(v) => setEditValues({ ...editValues, member_type: v })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_klaaryan">New Klaaryan</SelectItem>
                        <SelectItem value="veteran_klaaryan">Veteran Klaaryan</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : renderMemberType(p)}
                </TableCell>
                <TableCell>
                  <Select value={p.role} onValueChange={(v) => handleRoleChange(p, v as "admin" | "rep")}>
                    <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="rep">Rep</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.last_activity_at ? formatDistanceToNow(new Date(p.last_activity_at), { addSuffix: true, locale: it }) : "Mai"}
                </TableCell>
                <TableCell>
                  <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={() => saveEditing(p.id)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setProfileToDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!profileToDelete} onOpenChange={(open) => !open && setProfileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere {profileToDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>L'utente verrà disattivato e non potrà più accedere alla piattaforma.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => profileToDelete && handleDeleteProfile(profileToDelete)}>Rimuovi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
