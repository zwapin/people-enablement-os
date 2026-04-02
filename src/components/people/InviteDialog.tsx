import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TEAMS } from "@/lib/constants";

interface InviteDialogProps {
  onInvited: () => void;
}

export default function InviteDialog({ onInvited }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [jobRole, setJobRole] = useState("");
  const [memberType, setMemberType] = useState("new_klaaryan");
  const [roleTemplate, setRoleTemplate] = useState("");

  // Fetch distinct roles from onboarding_key_activity_templates
  const { data: roleOptions } = useQuery({
    queryKey: ["invite-role-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_key_activity_templates")
        .select("role");
      if (!data) return [];
      const unique = [...new Set(data.map((r) => r.role))].sort();
      return unique;
    },
    enabled: open,
  });

  const toggleTeam = (team: string) => {
    setDepartments((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          department: departments[0] || null,
          departments,
          job_role: jobRole.trim() || null,
          member_type: memberType,
          role_template: roleTemplate || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Invito inviato a ${email}`);
      setOpen(false);
      resetForm();
      onInvited();
    } catch (err: any) {
      toast.error(err.message || "Errore nell'invio dell'invito");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setDepartments([]);
    setJobRole("");
    setMemberType("new_klaaryan");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invita membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invita un nuovo membro del team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" required />
          </div>
          <div className="space-y-2">
            <Label>Team</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {departments.length === 0 ? "Seleziona team" : `${departments.length} team selezionati`}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2">
                <div className="space-y-1">
                  {TEAMS.map((team) => (
                    <label key={team} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer">
                      <Checkbox checked={departments.includes(team)} onCheckedChange={() => toggleTeam(team)} />
                      {team}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {departments.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {departments.map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobRole">Ruolo lavorativo</Label>
            <Input id="jobRole" value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="Account Executive" />
          </div>
          <div className="space-y-2">
            <Label>Tipo membro</Label>
            <Select value={memberType} onValueChange={setMemberType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_klaaryan">New Klaaryan</SelectItem>
                <SelectItem value="veteran_klaaryan">Veteran Klaaryan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Invia invito
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
