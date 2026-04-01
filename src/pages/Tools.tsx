import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ExternalLink, Wrench } from "lucide-react";
import { toast } from "sonner";
import { getProfileDepartments } from "@/lib/constants";

export default function Tools() {
  const { profile } = useAuth();
  const { isImpersonating, impersonating } = useImpersonation();
  const activeProfile = isImpersonating ? impersonating : profile;
  const departments = getProfileDepartments(activeProfile ?? {});

  const { data: tools } = useQuery({
    queryKey: ["team_tools", departments],
    queryFn: async () => {
      if (departments.length === 0) return [];
      const { data, error } = await supabase
        .from("team_tools")
        .select("*")
        .in("team", departments)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: departments.length > 0,
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">I tuoi Tool</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gli strumenti del tuo team. Clicca per copiare il link di invito.
        </p>
      </div>

      {departments.length === 0 || !tools || tools.length === 0 ? (
        <Card className="p-8 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nessun tool configurato per il tuo team.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {tools.map((tool, idx) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 + idx * 0.05 }}
            >
              <Card
                className={`bg-card border-border transition-all ${
                  tool.invite_link
                    ? "hover:shadow-md hover:border-primary/30 cursor-pointer"
                    : "opacity-70"
                }`}
                onClick={() => {
                  if (tool.invite_link) {
                    navigator.clipboard.writeText(tool.invite_link);
                    toast.success(`Link di ${tool.name} copiato!`);
                  }
                }}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {tool.icon_url ? (
                      <img
                        src={tool.icon_url}
                        alt={tool.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {tool.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate w-full">
                    {tool.name}
                  </p>
                  {tool.invite_link ? (
                    <div className="flex items-center gap-1 text-[10px] text-primary">
                      <ExternalLink className="h-3 w-3" />
                      <span>Copia link</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">In arrivo</span>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
