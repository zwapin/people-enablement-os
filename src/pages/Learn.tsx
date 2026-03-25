import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, RefreshCw, Loader2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import ModuleEditor from "@/components/learn/ModuleEditor";
import CurriculumList from "@/components/learn/CurriculumList";
import ProposalsList from "@/components/learn/ProposalsList";

export default function Learn() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const { data: modules, isLoading, refetch } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const publishedModules = modules?.filter((m) => m.status === "published") ?? [];
  const draftModules = modules?.filter((m) => m.status === "draft") ?? [];
  const proposedModules = modules?.filter((m) => m.status === "proposed") ?? [];

  const handleUpdateCurriculum = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-curriculum");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`AI ha proposto ${data.count} moduli. Revisiona e approva.`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Generazione curriculum fallita");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    const ids = proposedModules.map((m) => m.id);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("modules")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      toast.error("Approvazione fallita");
    } else {
      toast.success(`${ids.length} moduli pubblicati`);
      refetch();
    }
  };

  const handleEdit = (moduleId: string) => {
    setEditingModuleId(moduleId);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingModuleId(null);
    refetch();
  };

  if (editorOpen) {
    return <ModuleEditor moduleId={editingModuleId} onClose={handleEditorClose} />;
  }

  // Rep view — only published modules
  if (!isAdmin) {
    if (publishedModules.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Nessun modulo disponibile</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Il tuo curriculum apparirà qui quando l'admin pubblicherà i moduli.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">Il tuo curriculum di formazione.</p>
        </div>
        <CurriculumList modules={publishedModules} isAdmin={false} onEdit={() => {}} onRefresh={() => refetch()} />
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            L'AI analizza la Knowledge Base e propone il curriculum. Tu approvi.
          </p>
        </div>
        <Button onClick={handleUpdateCurriculum} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {generating ? "Analisi in corso..." : "Aggiorna Curriculum"}
        </Button>
      </div>

      {/* Proposals Section */}
      {proposedModules.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Proposte AI
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({proposedModules.length} moduli)
              </span>
            </h2>
            <Button variant="secondary" onClick={handleApproveAll}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Approva tutti
            </Button>
          </div>
          <ProposalsList
            modules={proposedModules}
            onEdit={handleEdit}
            onRefresh={() => refetch()}
          />
        </div>
      )}

      {/* Published Curriculum */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Curriculum Pubblicato
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({publishedModules.length} moduli)
          </span>
        </h2>
        {publishedModules.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nessun modulo pubblicato. Usa "Aggiorna Curriculum" per generare proposte dalla Knowledge Base.
          </div>
        ) : (
          <CurriculumList
            modules={publishedModules}
            isAdmin={true}
            onEdit={handleEdit}
            onRefresh={() => refetch()}
          />
        )}
      </div>

      {/* Draft Modules */}
      {draftModules.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Bozze
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({draftModules.length} moduli)
            </span>
          </h2>
          <CurriculumList
            modules={draftModules}
            isAdmin={true}
            onEdit={handleEdit}
            onRefresh={() => refetch()}
          />
        </div>
      )}
    </div>
  );
}
