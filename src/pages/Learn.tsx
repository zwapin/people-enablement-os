import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BookOpen, RefreshCw, Loader2, CheckCheck, RotateCcw, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import ModuleEditor from "@/components/learn/ModuleEditor";
import CollectionModuleList from "@/components/learn/CollectionModuleList";
import CollectionCard from "@/components/learn/CollectionCard";
import ProposalsList from "@/components/learn/ProposalsList";
import RepRoadmap from "@/components/learn/RepRoadmap";
import { MACRO_CATEGORIES, getCollectionCategories } from "@/lib/constants";
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
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const { isImpersonating, impersonating } = useImpersonation();
  const viewAsRep = isImpersonating;
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

  // ── Page-level queries for admin (shared across all CollectionCards) ──
  const { data: repProfiles } = useQuery({
    queryKey: ["rep-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "rep")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !viewAsRep,
  });

  const { data: allCompletions } = useQuery({
    queryKey: ["all-completions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_completions")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !viewAsRep,
  });

  const { data: allAssessmentQuestions } = useQuery({
    queryKey: ["all-assessment-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("module_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(q => {
        counts[q.module_id] = (counts[q.module_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin && !viewAsRep,
  });

  const { data: allDocCounts } = useQuery({
    queryKey: ["all-doc-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("collection_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(d => {
        if (d.collection_id) counts[d.collection_id] = (counts[d.collection_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin && !viewAsRep,
  });

  const { data: allFaqCounts } = useQuery({
    queryKey: ["all-faq-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_faqs")
        .select("collection_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(f => {
        if (f.collection_id) counts[f.collection_id] = (counts[f.collection_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin && !viewAsRep,
  });

  const refreshAll = () => {
    refetch();
    refetchCurricula();
  };

  const publishedModules = modules?.filter((m) => m.status === "published") ?? [];
  const draftModules = modules?.filter((m) => m.status === "draft") ?? [];
  const proposedModules = modules?.filter((m) => m.status === "proposed") ?? [];

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

    // Fire all jobs in parallel, then poll
    const jobEntries: { mod: typeof targetModules[0]; jobId: string }[] = [];
    
    for (const mod of targetModules) {
      try {
        const { data: job, error: jobErr } = await supabase
          .from("generation_jobs")
          .insert({ job_type: "generate-module", status: "pending", input: { module_id: mod.id } })
          .select("id")
          .single();

        if (jobErr || !job) continue;
        
        await supabase.functions.invoke("generate-module", {
          body: { jobId: job.id },
        });
        
        jobEntries.push({ mod, jobId: job.id });
      } catch {
        // skip failed job creation
      }
    }

    // Poll all jobs
    let completed = 0;
    let failed = 0;
    const pending = new Set(jobEntries.map(j => j.jobId));

    while (pending.size > 0) {
      await new Promise(r => setTimeout(r, 3000));
      
      const { data: statuses } = await supabase
        .from("generation_jobs")
        .select("id, status, error")
        .in("id", Array.from(pending));

      for (const s of statuses ?? []) {
        if (s.status === "completed") {
          completed++;
          pending.delete(s.id);
          setBulkProgress({
            current: completed + failed,
            total: jobEntries.length,
            label: `${completed} completati, ${failed} falliti`,
          });
        } else if (s.status === "failed") {
          failed++;
          pending.delete(s.id);
        }
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
    const firstName = (isImpersonating ? impersonating?.full_name : profile?.full_name)?.split(" ")[0] || "utente";

    const globalCompleted = publishedModules.filter(m => completions?.some(c => c.module_id === m.id)).length;
    const globalPct = publishedModules.length > 0 ? Math.round((globalCompleted / publishedModules.length) * 100) : 0;

    const repCollections = publishedCollections.map(c => {
      const cModules = publishedModules.filter(m => m.curriculum_id === c.id);
      const cCompleted = cModules.filter(m => completions?.some(comp => comp.module_id === m.id)).length;
      const cPct = cModules.length > 0 ? Math.round((cCompleted / cModules.length) * 100) : 0;
      return { ...c, moduleCount: cModules.length, completedCount: cCompleted, pct: cPct };
    }).filter(c => c.moduleCount > 0);

    if (repCollections.length === 0 && !isLoading) {
      return (
        <div className="space-y-6">
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
      <div className="space-y-8 max-w-3xl mx-auto">

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Ciao {firstName}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Ecco le tue collection di formazione. Continua da dove eri rimasto.
          </p>
        </div>

        <Card className="p-4 bg-card border-border space-y-2">
          <div className="flex items-center justify-between text-sm flex-wrap gap-1">
            <span className="text-muted-foreground">Progresso totale</span>
            <span className="font-mono text-foreground">
              {globalCompleted}/{publishedModules.length} moduli · {globalPct}%
            </span>
          </div>
          <Progress value={globalPct} className="h-2" />
        </Card>

        {/* Collection cards grouped by macro category */}
        {(() => {
          const getCats = (c: any): string[] => getCollectionCategories(c.categories);
          const categorized = MACRO_CATEGORIES.map(cat => ({
            ...cat,
            collections: repCollections.filter(c => getCats(c).includes(cat.key)),
          }));
          const uncategorized = repCollections.filter(c => getCats(c).length === 0);
          const hasCategories = categorized.some(cat => cat.collections.length > 0);

          const renderCard = (c: typeof repCollections[0]) => (
            <Card
              key={c.id}
              className="flex flex-col h-full p-5 bg-card border-border cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all"
              onClick={() => navigate(`/learn/${c.id}${viewAsRep ? "?view=rep" : ""}`)}
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-semibold text-foreground leading-tight">{c.title}</h3>
                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.completedCount}/{c.moduleCount} completati</span>
                  <span className="font-mono">{c.pct}%</span>
                </div>
                <Progress value={c.pct} className="h-1.5" />
              </div>
              {c.pct === 100 && (
                <Badge className="mt-3 w-fit bg-primary/10 text-primary border-primary/20 text-[10px]">
                  ✓ Completata
                </Badge>
              )}
            </Card>
          );

          const renderEmptyCategory = () => (
            <Card className="p-4 bg-card border-border text-sm text-muted-foreground">
              Nessuna collection disponibile in questa macro area al momento.
            </Card>
          );

          return (
            <div className="space-y-6">
              {categorized.map(cat => (
                <div key={cat.key} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {cat.label}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cat.collections.length > 0
                      ? cat.collections.map(renderCard)
                      : renderEmptyCategory()}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div className="space-y-3">
                  {hasCategories && (
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Altro
                    </h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {uncategorized.map(renderCard)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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

      {/* Collections grouped by macro category */}
      {(() => {
        const activeCollectionsFiltered = allCollections.filter(c => c.status !== "archived");
        const getCats = (c: any): string[] => getCollectionCategories(c.categories);
        const uncategorized = activeCollectionsFiltered.filter(c => getCats(c).length === 0);
        const categorized = MACRO_CATEGORIES.map(cat => ({
          ...cat,
          collections: activeCollectionsFiltered.filter(c => getCats(c).includes(cat.key)),
        }));

        const renderCollectionCard = (c: typeof allCollections[0]) => (
          <CollectionCard
            key={c.id}
            collection={c}
            modules={getModulesForCollection(c.id)}
            isAdmin={true}
            onRefresh={refreshAll}
            repProfiles={repProfiles ?? undefined}
            allCompletions={allCompletions ?? undefined}
            assessmentCounts={allAssessmentQuestions ?? undefined}
            docCount={allDocCounts?.[c.id] ?? 0}
            faqCount={allFaqCounts?.[c.id] ?? 0}
          />
        );

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Collections</h2>
              <Button variant="outline" size="sm" onClick={handleCreateCollection}>
                <Plus className="h-4 w-4 mr-1" />
                Nuova
              </Button>
            </div>

            {categorized.filter(cat => cat.collections.length > 0).map(cat => (
              <div key={cat.key} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.label}
                </h3>
                {cat.collections.map(renderCollectionCard)}
              </div>
            ))}

            {uncategorized.length > 0 && (
              <div className="space-y-3">
                {categorized.some(cat => cat.collections.length > 0) && (
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Non categorizzate
                  </h3>
                )}
                {uncategorized.map(renderCollectionCard)}
              </div>
            )}
          </div>
        );
      })()}

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
