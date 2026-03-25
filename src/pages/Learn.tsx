import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, RefreshCw, Loader2, CheckCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import ModuleEditor from "@/components/learn/ModuleEditor";
import CurriculumList from "@/components/learn/CurriculumList";
import ProposalsList from "@/components/learn/ProposalsList";
import RepRoadmap from "@/components/learn/RepRoadmap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Learn() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [viewAsRep, setViewAsRep] = useState(false);

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

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

  const { data: completions } = useQuery({
    queryKey: ["module_completions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_completions")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && (!isAdmin || viewAsRep),
  });

  const publishedModules = modules?.filter((m) => m.status === "published") ?? [];
  const draftModules = modules?.filter((m) => m.status === "draft") ?? [];
  const proposedModules = modules?.filter((m) => m.status === "proposed") ?? [];

  const startProgressSimulation = () => {
    setProgress(0);
    setProgressLabel("Analisi Knowledge Base...");
    const steps = [
      { at: 10, label: "Analisi Knowledge Base..." },
      { at: 30, label: "Progettazione curriculum..." },
      { at: 50, label: "Generazione contenuti moduli..." },
      { at: 70, label: "Creazione domande di valutazione..." },
      { at: 85, label: "Salvataggio moduli..." },
    ];
    let current = 0;
    progressInterval.current = setInterval(() => {
      current += 1;
      if (current >= 95) {
        if (progressInterval.current) clearInterval(progressInterval.current);
        return;
      }
      setProgress(current);
      const step = [...steps].reverse().find(s => current >= s.at);
      if (step) setProgressLabel(step.label);
    }, 500);
  };

  const stopProgressSimulation = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    setProgress(100);
    setProgressLabel("Completato!");
    setTimeout(() => {
      setProgress(0);
      setProgressLabel("");
    }, 1500);
  };

  const handleUpdateCurriculum = async (regenerateAll = false) => {
    setGenerating(true);
    startProgressSimulation();
    try {
      const { data, error } = await supabase.functions.invoke("generate-curriculum", {
        body: regenerateAll ? { regenerate_all: true } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      stopProgressSimulation();
      toast.success(
        regenerateAll
          ? `Curriculum rigenerato: ${data.count} moduli proposti. Revisiona e approva.`
          : `AI ha proposto ${data.count} moduli. Revisiona e approva.`
      );
      refetch();
    } catch (err: any) {
      stopProgressSimulation();
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

  // Rep view — roadmap (real rep OR admin previewing)
  if (!isAdmin || viewAsRep) {
    if (publishedModules.length === 0 && !isLoading) {
      return (
        <div className="space-y-6">
          {isAdmin && (
            <div className="flex items-center gap-3">
              <Switch id="view-toggle" checked={viewAsRep} onCheckedChange={setViewAsRep} />
              <Label htmlFor="view-toggle" className="text-sm text-muted-foreground cursor-pointer">Vista Rep</Label>
            </div>
          )}
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Nessun modulo disponibile</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Il tuo curriculum apparirà qui quando l'admin pubblicherà i moduli.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Switch id="view-toggle" checked={viewAsRep} onCheckedChange={setViewAsRep} />
            <Label htmlFor="view-toggle" className="text-sm text-muted-foreground cursor-pointer">Vista Rep</Label>
          </div>
        )}
        <RepRoadmap modules={publishedModules} completions={completions ?? []} />
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Formazione</h1>
            <p className="text-sm text-muted-foreground mt-1">
              L'AI analizza la Knowledge Base e propone il curriculum. Tu approvi.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Switch id="view-toggle-admin" checked={viewAsRep} onCheckedChange={setViewAsRep} />
            <Label htmlFor="view-toggle-admin" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Vista Rep</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={generating}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rigenera tutto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rigenerare tutto il curriculum?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questo cancellerà tutti i moduli esistenti (pubblicati, bozze e proposte) e li rigenererà da zero in italiano dalla Knowledge Base. L'operazione non è reversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleUpdateCurriculum(true)}>
                  Rigenera tutto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => handleUpdateCurriculum(false)} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {generating ? "Analisi in corso..." : "Aggiorna Curriculum"}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      {generating && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progressLabel}</span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            L'AI sta analizzando la Knowledge Base e generando il curriculum. Può richiedere fino a 60 secondi.
          </p>
        </div>
      )}

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
