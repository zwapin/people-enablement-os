import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, RefreshCw, Loader2, CheckCheck, RotateCcw, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import ModuleEditor from "@/components/learn/ModuleEditor";
import CollectionModuleList from "@/components/learn/CollectionModuleList";
import CollectionCard from "@/components/learn/CollectionCard";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [viewAsRep, setViewAsRep] = useState(false);
  const activeJobId = useRef<string | null>(null);

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

  const { data: curricula, refetch: refetchCurricula } = useQuery({
    queryKey: ["curricula"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curricula")
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

  const refreshAll = () => {
    refetch();
    refetchCurricula();
  };

  const publishedModules = modules?.filter((m) => m.status === "published") ?? [];
  const draftModules = modules?.filter((m) => m.status === "draft") ?? [];
  const proposedModules = modules?.filter((m) => m.status === "proposed") ?? [];

  // Group modules by curriculum
  const publishedCollections = curricula?.filter(c => c.status === "published") ?? [];
  const allCollections = curricula ?? [];

  const getModulesForCollection = (collectionId: string, statusFilter?: string[]) => {
    const filtered = modules?.filter(m => m.curriculum_id === collectionId) ?? [];
    if (statusFilter) return filtered.filter(m => statusFilter.includes(m.status));
    return filtered;
  };

  const orphanModules = (statusFilter?: string[]) => {
    const filtered = modules?.filter(m => !m.curriculum_id) ?? [];
    if (statusFilter) return filtered.filter(m => statusFilter.includes(m.status));
    return filtered;
  };

  const stopGeneration = (success: boolean) => {
    if (success) {
      setProgress(100);
      setProgressLabel("Completato!");
    }
    setTimeout(() => {
      setProgress(0);
      setProgressLabel("");
      setGenerating(false);
    }, 1500);
  };

  const subscribeToJob = useCallback((jobId: string) => {
    activeJobId.current = jobId;
    setProgress(5);
    setProgressLabel("Avvio generazione...");

    const timeout = setTimeout(() => {
      if (activeJobId.current === jobId) {
        stopGeneration(false);
        toast.error("La generazione sta impiegando troppo tempo. Riprova più tardi.");
        supabase.removeChannel(channel);
        activeJobId.current = null;
      }
    }, 300000);

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as any;
          const newStatus = row.status;
          const currentStep = row.current_step;
          const totalSteps = row.total_steps ?? 0;
          const completedSteps = row.completed_steps ?? 0;

          if (currentStep === "outline") {
            setProgress(10);
            setProgressLabel("Analisi Knowledge Base e creazione outline...");
          } else if (currentStep === "outline_completed") {
            setProgress(20);
            setProgressLabel(`Outline completato. Generazione ${totalSteps} moduli...`);
            refreshAll();
          } else if (currentStep?.startsWith("module_") && totalSteps > 0) {
            const pct = 20 + Math.round((completedSteps / totalSteps) * 70);
            setProgress(pct);
            setProgressLabel(`Modulo ${completedSteps}/${totalSteps} completato...`);
            refreshAll();
          }

          if (newStatus === "completed") {
            clearTimeout(timeout);
            const count = row.result?.count ?? 0;
            const partial = row.result?.partial === true;
            stopGeneration(true);
            if (partial) {
              toast.warning(`Generazione parziale: ${count} moduli completati.`);
            } else {
              toast.success(`Collection generata: ${count} moduli proposti. Revisiona e approva.`);
            }
            refreshAll();
            supabase.removeChannel(channel);
            activeJobId.current = null;
          } else if (newStatus === "failed") {
            clearTimeout(timeout);
            stopGeneration(false);
            toast.error(`Generazione fallita: ${row.error || "Errore sconosciuto"}`);
            supabase.removeChannel(channel);
            activeJobId.current = null;
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [refetch, refetchCurricula]);

  const handleUpdateCurriculum = async (regenerateAll = false, collectionId?: string) => {
    setGenerating(true);
    setProgress(2);
    setProgressLabel("Invio richiesta...");
    try {
      const body: any = {};
      if (regenerateAll) body.regenerate_all = true;
      if (collectionId) body.collection_id = collectionId;
      const { data, error } = await supabase.functions.invoke("generate-curriculum", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.jobId) subscribeToJob(data.jobId);
    } catch (err: any) {
      stopGeneration(false);
      toast.error(err.message || "Generazione collection fallita");
    }
  };

  const handleApproveAll = async () => {
    const ids = proposedModules.map((m) => m.id);
    if (ids.length === 0) return;

    // Also publish any proposed curricula that contain these modules
    const proposedCurriculaIds = new Set(
      proposedModules.filter(m => m.curriculum_id).map(m => m.curriculum_id!)
    );

    const { error } = await supabase
      .from("modules")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      toast.error("Approvazione fallita");
      return;
    }

    // Publish related curricula
    if (proposedCurriculaIds.size > 0) {
      await supabase
        .from("curricula")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .in("id", Array.from(proposedCurriculaIds));
    }

    toast.success(`${ids.length} moduli pubblicati`);
    refreshAll();
  };

  const handleCreateCollection = async () => {
    const { data, error } = await supabase.from("curricula").insert({
      title: "Nuova Collection",
      status: "draft",
      order_index: (curricula?.length ?? 0),
    }).select("id").single();
    if (error) {
      toast.error("Creazione fallita");
    } else {
      navigate(`/learn/${data.id}`);
    }
  };

  const handleMigrateToCollections = async () => {
    const orphans = modules?.filter(m => !m.curriculum_id && (m.status === "published" || m.status === "draft")) ?? [];
    if (orphans.length === 0) {
      toast.info("Nessun modulo orfano da convertire");
      return;
    }

    let converted = 0;
    for (const mod of orphans) {
      const { data: newColl, error: collErr } = await supabase
        .from("curricula")
        .insert({
          title: mod.title,
          description: mod.summary || null,
          track: mod.track || "Generale",
          status: mod.status as any,
          order_index: mod.order_index,
        })
        .select("id")
        .single();

      if (collErr || !newColl) {
        console.error("Failed to create collection from module:", collErr);
        continue;
      }

      await supabase
        .from("modules")
        .update({ curriculum_id: newColl.id, updated_at: new Date().toISOString() })
        .eq("id", mod.id);

      converted++;
    }

    toast.success(`${converted} moduli convertiti in collection. Ora clicca "Aggiorna Collection" per generare i sotto-moduli.`);
    refreshAll();
  };

  // Auto-migration removed — curricula structure is now pre-populated

  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: "" });

  const handleBulkGenerate = async (curriculumId?: string) => {
    const targetModules = modules?.filter(m => {
      const matchesCurriculum = curriculumId ? m.curriculum_id === curriculumId : true;
      return matchesCurriculum && !m.content_body;
    }) ?? [];

    if (targetModules.length === 0) {
      toast.info("Tutti i moduli hanno già contenuto.");
      return;
    }

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: targetModules.length, label: "Avvio generazione bulk..." });

    let completed = 0;
    let failed = 0;

    for (const mod of targetModules) {
      setBulkProgress({
        current: completed + 1,
        total: targetModules.length,
        label: `Generazione: ${mod.title.substring(0, 50)}...`,
      });

      try {
        // Create job
        const { data: job, error: jobErr } = await supabase
          .from("generation_jobs")
          .insert({ job_type: "generate-module", status: "pending", input: { module_id: mod.id } })
          .select("id")
          .single();

        if (jobErr || !job) throw new Error("Job creation failed");

        // Invoke edge function
        const { error: fnErr } = await supabase.functions.invoke("generate-module", {
          body: { jobId: job.id },
        });

        if (fnErr) throw fnErr;

        // Poll for completion
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: jobStatus } = await supabase
            .from("generation_jobs")
            .select("status, error")
            .eq("id", job.id)
            .single();

          if (jobStatus?.status === "completed") break;
          if (jobStatus?.status === "failed") throw new Error(jobStatus.error || "Generation failed");
          attempts++;
        }

        completed++;
      } catch (err: any) {
        console.error(`Failed to generate module ${mod.title}:`, err);
        failed++;
      }

      // Small delay between modules
      if (completed + failed < targetModules.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setBulkGenerating(false);
    setBulkProgress({ current: 0, total: 0, label: "" });
    refreshAll();

    if (failed === 0) {
      toast.success(`${completed} moduli generati con successo!`);
    } else {
      toast.warning(`${completed} generati, ${failed} falliti.`);
    }
  };

  const handleEdit = (moduleId: string) => {
    setEditingModuleId(moduleId);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingModuleId(null);
    refreshAll();
  };

  if (editorOpen) {
    return <ModuleEditor moduleId={editingModuleId} onClose={handleEditorClose} collections={allCollections} />;
  }

  // Rep view
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
              La tua collection apparirà qui quando l'admin pubblicherà i moduli.
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
        <RepRoadmap
          modules={publishedModules}
          completions={completions ?? []}
          collections={publishedCollections}
        />
      </div>
    );
  }

  // Admin view
  const orphanPublished = orphanModules(["published"]);
  const orphanDraft = orphanModules(["draft"]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Formazione</h1>
            <p className="text-sm text-muted-foreground mt-1">
              L'AI analizza la Knowledge Base e propone la collection. Tu approvi.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch id="view-toggle-admin" checked={viewAsRep} onCheckedChange={setViewAsRep} />
            <Label htmlFor="view-toggle-admin" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Vista Rep</Label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkGenerate()}
            disabled={bulkGenerating || generating}
          >
            {bulkGenerating ? (
              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {bulkGenerating ? `Generazione ${bulkProgress.current}/${bulkProgress.total}...` : "Genera tutti"}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCreateCollection}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nuova Collection</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={generating}>
                <RotateCcw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Rigenera tutto</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rigenerare tutte le collection?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questo cancellerà tutti i moduli e collection esistenti e li rigenererà da zero dalla Knowledge Base. L'operazione non è reversibile.
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
          <Button size="sm" onClick={() => handleUpdateCurriculum(false)} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {generating ? "Generazione..." : "Aggiorna Collection"}
            </span>
          </Button>
        </div>
      </div>

      {/* Bulk generation progress */}
      {bulkGenerating && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{bulkProgress.label}</span>
            <span className="text-muted-foreground font-mono">
              {bulkProgress.current}/{bulkProgress.total}
            </span>
          </div>
          <Progress value={(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100} className="h-2" />
        </div>
      )}

      {/* Progress indicator */}
      {generating && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progressLabel}</span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            L'AI sta analizzando la Knowledge Base e generando la collection. Può richiedere fino a 3 minuti.
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
            onRefresh={refreshAll}
          />
        </div>
      )}

      {/* Collections */}
      {allCollections.filter(c => c.status !== "archived").length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Collections</h2>
          {allCollections
            .filter(c => c.status !== "archived")
            .map(c => (
              <CollectionCard
                key={c.id}
                collection={c}
                modules={getModulesForCollection(c.id)}
                isAdmin={true}
                onRefresh={refreshAll}
              />
            ))}
        </div>
      )}

      {/* Orphan Published */}
      {orphanPublished.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Moduli non assegnati — Pubblicati
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({orphanPublished.length})
            </span>
          </h2>
          <CollectionModuleList
            modules={orphanPublished}
            isAdmin={true}
            onEdit={handleEdit}
            onRefresh={refreshAll}
          />
        </div>
      )}

      {/* Orphan Drafts */}
      {orphanDraft.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Moduli non assegnati — Bozze
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({orphanDraft.length})
            </span>
          </h2>
          <CollectionModuleList
            modules={orphanDraft}
            isAdmin={true}
            onEdit={handleEdit}
            onRefresh={refreshAll}
          />
        </div>
      )}
    </div>
  );
}
