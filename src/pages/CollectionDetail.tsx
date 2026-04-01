import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useCallback, useEffect } from "react";
import RepRoadmap from "@/components/learn/RepRoadmap";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Loader2,
  BookOpen,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";
import CollectionModuleList from "@/components/learn/CollectionModuleList";
import DocumentsList from "@/components/learn/DocumentsList";
import FaqList from "@/components/learn/FaqList";
import ModuleEditor from "@/components/learn/ModuleEditor";
import OutlineReviewDialog from "@/components/learn/OutlineReviewDialog";

export default function CollectionDetail() {
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const viewAsRep = searchParams.get("view") === "rep";
  const isAdmin = profile?.role === "admin" && !viewAsRep;
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: "" });
  const activeJobId = useRef<string | null>(null);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // No-docs dialog
  const [noDocsDialogOpen, setNoDocsDialogOpen] = useState(false);

  // Generate instructions dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [generateDialogMode, setGenerateDialogMode] = useState<"outline" | "content">("outline");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Outline review dialog
  const [outlineReviewOpen, setOutlineReviewOpen] = useState(false);

  // Fetch completions for rep (must be at top level before any early returns)
  const { data: repCompletions } = useQuery({
    queryKey: ["module_completions", user?.id, curriculumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_completions")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !isAdmin,
  });

  const { data: collection } = useQuery({
    queryKey: ["collection", curriculumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curricula")
        .select("*")
        .eq("id", curriculumId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!curriculumId,
  });

  const { data: allCollections } = useQuery({
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

  const { data: modules, refetch: refetchModules } = useQuery({
    queryKey: ["modules", curriculumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("curriculum_id", curriculumId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!curriculumId,
  });

  // Documents for this collection
  const { data: collectionDocs, refetch: refetchDocCount } = useQuery({
    queryKey: ["collection-docs", curriculumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("id, title")
        .eq("collection_id", curriculumId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!curriculumId,
  });

  const docCount = collectionDocs?.length ?? 0;

  // Auto-enter title edit mode for new collections
  useEffect(() => {
    if (collection) {
      setTitleValue(collection.title);
      if (collection.title === "Nuova Collection" && collection.status === "draft") {
        setEditingTitle(true);
        setTimeout(() => titleInputRef.current?.select(), 100);
      }
    }
  }, [collection]);

  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === collection?.title) {
      setTitleValue(collection?.title || "");
      setEditingTitle(false);
      return;
    }
    const { error } = await supabase
      .from("curricula")
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq("id", curriculumId!);
    if (error) {
      toast.error("Errore nel salvataggio del titolo");
    } else {
      queryClient.invalidateQueries({ queryKey: ["collection", curriculumId] });
      queryClient.invalidateQueries({ queryKey: ["curricula"] });
    }
    setEditingTitle(false);
  };

  const refreshAll = () => {
    refetchModules();
    refetchDocCount();
    queryClient.invalidateQueries({ queryKey: ["collection", curriculumId] });
    queryClient.invalidateQueries({ queryKey: ["curricula"] });
    queryClient.invalidateQueries({ queryKey: ["doc-count", curriculumId] });
    queryClient.invalidateQueries({ queryKey: ["faq-count", curriculumId] });
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
        toast.error("La generazione sta impiegando troppo tempo.");
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
          const totalSteps = row.total_steps ?? 0;
          const completedSteps = row.completed_steps ?? 0;

          if (row.current_step === "outline") {
            setProgress(30);
            setProgressLabel("Analisi documenti e creazione outline...");
          } else if (row.current_step === "outline_completed") {
            setProgress(90);
            setProgressLabel("Outline completato!");
            refreshAll();
          }

          if (newStatus === "completed") {
            clearTimeout(timeout);
            const count = row.result?.count ?? 0;
            const isOutlineOnly = row.result?.outline_only === true;
            stopGeneration(true);
            if (isOutlineOnly) {
              toast.success(`${count} moduli proposti. Rivedi l'outline.`);
              // Open review dialog after refresh
              setTimeout(() => setOutlineReviewOpen(true), 500);
            } else {
              toast.success(`${count} moduli generati.`);
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
  }, [curriculumId]);

  const handleGenerate = async () => {
    if ((docCount ?? 0) === 0) {
      setNoDocsDialogOpen(true);
      return;
    }
    setSelectedDocIds((collectionDocs ?? []).map(d => d.id));
    setGenerateDialogMode("outline");
    setGenerateDialogOpen(true);
  };

  const doGenerate = async () => {
    if (generateDialogMode === "content") {
      return doBulkGenerate();
    }
    setGenerateDialogOpen(false);
    setGenerating(true);
    setProgress(2);
    setProgressLabel("Invio richiesta...");
    try {
      const body: any = { collection_id: curriculumId };
      if (customInstructions.trim()) {
        body.custom_instructions = customInstructions.trim();
      }
      if (selectedDocIds.length < (collectionDocs ?? []).length) {
        body.selected_document_ids = selectedDocIds;
      }
      const { data, error } = await supabase.functions.invoke("generate-curriculum", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.jobId) subscribeToJob(data.jobId);
      setCustomInstructions("");
    } catch (err: any) {
      stopGeneration(false);
      toast.error(err.message || "Generazione fallita");
    }
  };

  const handleBulkGenerate = async () => {
    const targetModules = modules?.filter(m => !m.content_body) ?? [];
    if (targetModules.length === 0) {
      toast.info("Tutti i moduli hanno già contenuto.");
      return;
    }
    setSelectedDocIds((collectionDocs ?? []).map(d => d.id));
    setGenerateDialogMode("content");
    setGenerateDialogOpen(true);
  };

  const doBulkGenerate = async () => {
    setGenerateDialogOpen(false);
    const targetModules = modules?.filter(m => !m.content_body) ?? [];

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: targetModules.length, label: "Avvio..." });

    let completed = 0;
    let failed = 0;

    for (const mod of targetModules) {
      setBulkProgress({
        current: completed + 1,
        total: targetModules.length,
        label: `Generazione: ${mod.title.substring(0, 50)}...`,
      });

      try {
        const { data: job, error: jobErr } = await supabase
          .from("generation_jobs")
          .insert({ job_type: "generate-module", status: "pending", input: { module_id: mod.id } })
          .select("id")
          .single();

        if (jobErr || !job) throw new Error("Job creation failed");

        const { error: fnErr } = await supabase.functions.invoke("generate-module", {
          body: { jobId: job.id },
        });
        if (fnErr) throw fnErr;

        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: jobStatus } = await supabase
            .from("generation_jobs")
            .select("status, error")
            .eq("id", job.id)
            .single();

          if (jobStatus?.status === "completed") break;
          if (jobStatus?.status === "failed") throw new Error(jobStatus.error || "Failed");
          attempts++;
        }

        completed++;
      } catch (err: any) {
        console.error(`Failed to generate module ${mod.title}:`, err);
        failed++;
      }

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

  const handleDeleteCollection = async () => {
    const moduleIds = (modules ?? []).map(m => m.id);
    // Delete assessment questions for all modules
    for (const mId of moduleIds) {
      await supabase.from("assessment_questions").delete().eq("module_id", mId);
    }
    // Delete modules
    await supabase.from("modules").delete().eq("curriculum_id", curriculumId!);
    // Delete knowledge documents & faqs
    await supabase.from("knowledge_documents").delete().eq("collection_id", curriculumId!);
    await supabase.from("knowledge_faqs").delete().eq("collection_id", curriculumId!);
    // Delete the collection itself
    const { error } = await supabase.from("curricula").delete().eq("id", curriculumId!);
    if (error) {
      toast.error("Eliminazione fallita");
    } else {
      toast.success("Collection eliminata");
      queryClient.invalidateQueries({ queryKey: ["curricula"] });
      navigate("/learn");
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
    return <ModuleEditor moduleId={editingModuleId} onClose={handleEditorClose} collections={allCollections ?? []} />;
  }

  if (!collection) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentModules = modules ?? [];
  const hasEmptyModules = currentModules.some(m => !m.content_body);
  const hasProposedModules = currentModules.some(m => m.status === "proposed");
  const draftOrPublishedModules = currentModules.filter(m => m.status === "draft" || m.status === "published");
  const hasExistingModules = draftOrPublishedModules.length > 0;

  // Determine if new docs were uploaded after the latest module was created
  const latestModuleDate = draftOrPublishedModules.length > 0
    ? Math.max(...draftOrPublishedModules.map(m => new Date(m.updated_at).getTime()))
    : 0;
  const latestDocDate = (collectionDocs ?? []).length > 0
    ? Math.max(...(collectionDocs ?? []).map(() => Date.now())) // docs don't have updated_at in our query, fallback
    : 0;

  // Button labels: "Genera" if no modules exist, "Aggiorna" if they do
  const moduliButtonLabel = hasExistingModules ? "Aggiorna moduli" : "Genera moduli";
  const contenutiButtonLabel = hasExistingModules && !hasEmptyModules ? "Aggiorna contenuti" : "Genera contenuti";
  const showContenutiButton = draftOrPublishedModules.length > 0;

  // repCompletions is fetched at top level (before early returns)

  // Rep view: show roadmap with stats
  if (!isAdmin) {
    const publishedModules = currentModules.filter(m => m.status === "published");

    const collectionCompletions = (repCompletions ?? []).filter(c =>
      publishedModules.some(m => m.id === c.module_id)
    );
    const completedCount = collectionCompletions.length;
    const avgScore = completedCount > 0
      ? Math.round(collectionCompletions.reduce((sum, c) => sum + c.score, 0) / completedCount)
      : 0;

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/learn" onClick={(e) => { e.preventDefault(); navigate("/learn"); }}>
                Formazione
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collection.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/learn")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{collection.title}</h1>
            {collection.description && (
              <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        {completedCount > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {completedCount}/{publishedModules.length} completati
            </span>
            <span>·</span>
            <span>Punteggio medio: <strong className="text-foreground">{avgScore}</strong></span>
          </div>
        )}

        {publishedModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessun modulo pubblicato in questa collection.</p>
          </div>
        ) : (
          <RepRoadmap
            modules={publishedModules}
            completions={repCompletions ?? []}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/learn" onClick={(e) => { e.preventDefault(); navigate("/learn"); }}>
              Formazione
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{collection.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/learn")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <Input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setTitleValue(collection.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="text-2xl font-bold h-auto py-0 px-1 border-primary"
                  autoFocus
                />
              ) : (
                <h1
                  className="text-2xl font-bold text-foreground cursor-pointer group flex items-center gap-1.5"
                  onClick={() => {
                    if (isAdmin) {
                      setEditingTitle(true);
                      setTimeout(() => titleInputRef.current?.select(), 50);
                    }
                  }}
                >
                  {collection.title}
                  {isAdmin && <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                </h1>
              )}
              <Badge
                variant={collection.status === "published" ? "default" : "secondary"}
                className="text-[10px] uppercase"
              >
                {collection.status === "published" ? "Pubblicato" : collection.status === "draft" ? "Bozza" : collection.status}
              </Badge>
            </div>
            {collection.description && (
              <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : hasExistingModules ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {moduliButtonLabel}
            </Button>
            {showContenutiButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkGenerate}
                disabled={bulkGenerating}
              >
                {bulkGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {contenutiButtonLabel}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina Collection
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa collection?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La collection "{collection.title}" e tutti i moduli, domande e documenti associati verranno eliminati permanentemente. Questa azione non è reversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCollection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Elimina tutto
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Generation progress */}
      {generating && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progressLabel}</span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

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

      {/* Moduli */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Moduli
          <span className="text-sm font-normal text-muted-foreground">({currentModules.length})</span>
        </h2>
        {hasProposedModules && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-foreground flex-1">
              {currentModules.filter(m => m.status === "proposed").length} moduli proposti dall'AI in attesa di revisione.
            </span>
            <Button size="sm" onClick={() => setOutlineReviewOpen(true)}>
              Rivedi outline
            </Button>
          </div>
        )}
        {currentModules.filter(m => m.status !== "proposed").length === 0 && !hasProposedModules ? (
          <p className="text-sm text-muted-foreground py-4">
            Nessun modulo. Clicca "{moduliButtonLabel}" per crearli dalla Knowledge Base.
          </p>
        ) : (
          <CollectionModuleList
            modules={currentModules.filter(m => m.status !== "proposed")}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onRefresh={refreshAll}
          />
        )}
      </div>

      {/* Documenti — solo admin */}
      {isAdmin && (
        <div className="space-y-3" data-documents-section>
          <h2 className="text-lg font-semibold text-foreground">Documenti</h2>
          <DocumentsList collectionId={curriculumId!} onUploadComplete={refreshAll} />
        </div>
      )}

      {/* FAQ — visibile a tutti, editabile solo admin */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">FAQ</h2>
        <FaqList collectionId={curriculumId!} readOnly={!isAdmin} />
      </div>

      {/* Generate instructions dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Genera moduli</DialogTitle>
            <DialogDescription>
              L'AI analizzerà i documenti e le FAQ per creare i moduli formativi. Puoi fornire istruzioni personalizzate per guidare la generazione.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Document selection */}
            {(collectionDocs ?? []).length > 0 && (
              <div className="space-y-2">
                <Label>Documenti da utilizzare</Label>
                <div className="border border-border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Checkbox
                      id="select-all-docs"
                      checked={selectedDocIds.length === (collectionDocs ?? []).length}
                      onCheckedChange={(checked) => {
                        setSelectedDocIds(checked ? (collectionDocs ?? []).map(d => d.id) : []);
                      }}
                    />
                    <label htmlFor="select-all-docs" className="text-sm font-medium cursor-pointer">
                      Seleziona tutti ({(collectionDocs ?? []).length})
                    </label>
                  </div>
                  {(collectionDocs ?? []).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`doc-${doc.id}`}
                        checked={selectedDocIds.includes(doc.id)}
                        onCheckedChange={(checked) => {
                          setSelectedDocIds(prev =>
                            checked
                              ? [...prev, doc.id]
                              : prev.filter(id => id !== doc.id)
                          );
                        }}
                      />
                      <label htmlFor={`doc-${doc.id}`} className="text-sm cursor-pointer truncate">
                        {doc.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Istruzioni personalizzate (opzionale)</Label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Es. 'Concentrati sulle tecniche di cold calling', 'Crea moduli brevi e pratici', 'Includi scenari di role-play per ogni modulo'..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={doGenerate} disabled={selectedDocIds.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              Genera
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No documents dialog */}
      <Dialog open={noDocsDialogOpen} onOpenChange={setNoDocsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nessun documento caricato</DialogTitle>
            <DialogDescription>
              Carica almeno un documento per generare i moduli. I documenti vengono usati dall'AI per creare il contenuto formativo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNoDocsDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => {
              setNoDocsDialogOpen(false);
              setTimeout(() => {
                document.querySelector('[data-documents-section]')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}>
              <Upload className="h-4 w-4 mr-2" />
              Vai ai documenti
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outline review dialog */}
      <OutlineReviewDialog
        open={outlineReviewOpen}
        onOpenChange={setOutlineReviewOpen}
        modules={currentModules}
        collectionId={curriculumId!}
        onApproved={refreshAll}
      />
    </div>
  );
}
