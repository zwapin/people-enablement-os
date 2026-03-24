import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
  const handleToggleActive = async (profile: ProfileRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update status");
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
      toast.error("Failed to update role");
    } else {
      onRefresh();
    }
  };

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Job Role</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No team members yet. Invite your first rep to get started.
              </TableCell>
            </TableRow>
          ) : (
            profiles.map((p) => (
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
                      <SelectItem value="rep">Rep</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.last_activity_at
                    ? formatDistanceToNow(new Date(p.last_activity_at), { addSuffix: true })
                    : "Never"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={() => handleToggleActive(p)}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
