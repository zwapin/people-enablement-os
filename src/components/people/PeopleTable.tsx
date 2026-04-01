import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
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
import { Trash2, Pencil, Check, X } from "lucide-react";
import { TEAMS } from "@/lib/constants";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  job_role: string | null;
  role: "admin" | "rep";
  is_active: boolean;
  last_activity_at: string | null;
  created_at: string;
}

interface PeopleTableProps {
  profiles: ProfileRow[];
  onRefresh: () => void;
}

export default function PeopleTable({ profiles, onRefresh }: PeopleTableProps) {
  const isMobile = useIsMobile();
  const [profileToDelete, setProfileToDelete] = useState<ProfileRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProfileRow>>({});

  const startEditing = (p: ProfileRow) => {
    setEditingId(p.id);
    setEditValues({
      full_name: p.full_name,
      email: p.email,
      department: p.department,
      job_role: p.job_role,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEditing = async (profileId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editValues.full_name,
        email: editValues.email,
        department: editValues.department || null,
        job_role: editValues.job_role || null,
      })
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
      
      const { error: fnError } = await supabase.functions.invoke("delete-user", {
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

  const handleRoleChange = async (profile: ProfileRow, newRole: "admin" | "rep") => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profile.id);

    if (error) {
      toast.error("Errore nell'aggiornamento del ruolo");
    } else {
      onRefresh();
    }
  };

  if (profiles.length === 0) {
    return (
      <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
        Nessun membro del team. Invita il tuo primo New Klaaryan per iniziare.
      </div>
    );
  }

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
                      <Input
                        value={editValues.full_name ?? ""}
                        onChange={(e) => setEditValues({ ...editValues, full_name: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Nome"
                      />
                      <Input
                        value={editValues.email ?? ""}
                        onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Email"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-foreground truncate">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                    </>
                  )}
                </div>
                <Switch
                  checked={p.is_active}
                  onCheckedChange={() => handleToggleActive(p)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {isEditing ? (
                  <>
                    <Select
                      value={editValues.department ?? ""}
                      onValueChange={(v) => setEditValues({ ...editValues, department: v })}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Team" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAMS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={editValues.job_role ?? ""}
                      onChange={(e) => setEditValues({ ...editValues, job_role: e.target.value })}
                      className="h-8 text-xs w-36"
                      placeholder="Ruolo lavorativo"
                    />
                  </>
                ) : (
                  <>
                    {p.department && (
                      <Badge variant="secondary" className="font-normal">{p.department}</Badge>
                    )}
                    {p.job_role && (
                      <span className="text-muted-foreground">{p.job_role}</span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={p.role}
                  onValueChange={(v) => handleRoleChange(p, v as "admin" | "rep")}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="rep">New Klaaryan</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveEditing(p.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setProfileToDelete(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
              <AlertDialogDescription>
                L'utente verrà disattivato e non potrà più accedere alla piattaforma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => profileToDelete && handleDeleteProfile(profileToDelete)}
              >
                Rimuovi
              </AlertDialogAction>
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
                    <Input
                      value={editValues.full_name ?? ""}
                      onChange={(e) => setEditValues({ ...editValues, full_name: e.target.value })}
                      className="h-8 text-sm w-40"
                    />
                  ) : (
                    p.full_name
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {isEditing ? (
                    <Input
                      value={editValues.email ?? ""}
                      onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                      className="h-8 text-sm w-48"
                    />
                  ) : (
                    p.email
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Select
                      value={editValues.department ?? ""}
                      onValueChange={(v) => setEditValues({ ...editValues, department: v })}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Team" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAMS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : p.department ? (
                    <Badge variant="secondary" className="font-normal">{p.department}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editValues.job_role ?? ""}
                      onChange={(e) => setEditValues({ ...editValues, job_role: e.target.value })}
                      className="h-8 text-sm w-36"
                      placeholder="Ruolo"
                    />
                  ) : (
                    p.job_role || <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={p.role}
                    onValueChange={(v) => handleRoleChange(p, v as "admin" | "rep")}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="rep">New Klaaryan</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.last_activity_at
                    ? formatDistanceToNow(new Date(p.last_activity_at), { addSuffix: true, locale: it })
                    : "Mai"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={() => handleToggleActive(p)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={() => saveEditing(p.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEditing}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setProfileToDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
            <AlertDialogDescription>
              L'utente verrà disattivato e non potrà più accedere alla piattaforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => profileToDelete && handleDeleteProfile(profileToDelete)}
            >
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
