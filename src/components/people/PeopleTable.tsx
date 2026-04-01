import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";

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

  const handleDeleteProfile = async (profile: ProfileRow) => {
    try {
      // Delete from profiles (cascade will handle user_roles via auth)
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", profile.id);
      
      // Also invoke edge function to delete the auth user
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
        {profiles.map((p) => (
          <Card key={p.id} className="p-4 space-y-3 border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{p.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">{p.email}</p>
              </div>
              <Switch
                checked={p.is_active}
                onCheckedChange={() => handleToggleActive(p)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {p.department && (
                <Badge variant="secondary" className="font-normal">{p.department}</Badge>
              )}
              {p.job_role && (
                <span className="text-muted-foreground">{p.job_role}</span>
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
              <span className="text-xs text-muted-foreground">
                {p.last_activity_at
                  ? formatDistanceToNow(new Date(p.last_activity_at), { addSuffix: true, locale: it })
                  : "Mai"}
              </span>
            </div>
          </Card>
        ))}
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.full_name}</TableCell>
              <TableCell className="text-muted-foreground">{p.email}</TableCell>
              <TableCell>
                {p.department ? (
                  <Badge variant="secondary" className="font-normal">
                    {p.department}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{p.job_role || <span className="text-muted-foreground">—</span>}</TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
