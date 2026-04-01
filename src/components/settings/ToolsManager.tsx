import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TEAMS } from "@/lib/constants";

export default function ToolsManager() {
  const queryClient = useQueryClient();
  const [activeTeam, setActiveTeam] = useState<string>(TEAMS[0]);
  const [newName, setNewName] = useState("");
  const [newIconUrl, setNewIconUrl] = useState("");
  const [newInviteLink, setNewInviteLink] = useState("");

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ["team_tools_admin", activeTeam],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_tools")
        .select("*")
        .eq("team", activeTeam)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team_tools_admin", activeTeam] });
    queryClient.invalidateQueries({ queryKey: ["team_tools"] });
  };

  const addTool = useMutation({
    mutationFn: async () => {
      const maxOrder = tools.length > 0 ? Math.max(...tools.map((t) => t.order_index ?? 0)) + 1 : 0;
      const { error } = await supabase.from("team_tools").insert({
        team: activeTeam,
        name: newName.trim(),
        icon_url: newIconUrl.trim() || null,
        invite_link: newInviteLink.trim() || null,
        order_index: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNewName("");
      setNewIconUrl("");
      setNewInviteLink("");
      toast.success("Tool aggiunto");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_tools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tool rimosso"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTool = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("team_tools").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-2">Tool per Team</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Gestisci i tool che ogni New Klaaryan deve imparare ad usare. Il link di invito verrà mostrato nella loro Home.
      </p>

      <Tabs value={activeTeam} onValueChange={setActiveTeam}>
        <TabsList className="mb-4">
          {TEAMS.map((team) => (
            <TabsTrigger key={team} value={team}>{team}</TabsTrigger>
          ))}
        </TabsList>

        {TEAMS.map((team) => (
          <TabsContent key={team} value={team} className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Caricamento...</p>
            ) : tools.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nessun tool per {team}.</p>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div key={tool.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {tool.icon_url ? (
                        <img src={tool.icon_url} alt="" className="w-4 h-4 object-contain" />
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">{tool.name.charAt(0)}</span>
                      )}
                    </div>
                    <Input
                      defaultValue={tool.name}
                      className="flex-1 h-8 text-sm"
                      onBlur={(e) => {
                        if (e.target.value !== tool.name) {
                          updateTool.mutate({ id: tool.id, updates: { name: e.target.value } });
                        }
                      }}
                    />
                    <Input
                      defaultValue={tool.invite_link || ""}
                      placeholder="Link di invito..."
                      className="flex-1 h-8 text-xs"
                      onBlur={(e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== tool.invite_link) {
                          updateTool.mutate({ id: tool.id, updates: { invite_link: val } });
                        }
                      }}
                    />
                    {tool.invite_link && (
                      <a
                        href={tool.invite_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteTool.mutate(tool.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome tool..."
                  className="flex-1 h-9"
                />
                <Input
                  value={newInviteLink}
                  onChange={(e) => setNewInviteLink(e.target.value)}
                  placeholder="Link di invito (opzionale)..."
                  className="flex-1 h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newIconUrl}
                  onChange={(e) => setNewIconUrl(e.target.value)}
                  placeholder="URL icona (opzionale)..."
                  className="flex-1 h-9 text-xs"
                />
                <Button
                  size="sm"
                  disabled={!newName.trim() || addTool.isPending}
                  onClick={() => addTool.mutate()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
