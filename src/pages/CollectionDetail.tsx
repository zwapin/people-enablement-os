import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Loader2,
  BookOpen,
  Upload,
  Pencil,
} from "lucide-react";
import CollectionModuleList from "@/components/learn/CollectionModuleList";
import DocumentsList from "@/components/learn/DocumentsList";
import FaqList from "@/components/learn/FaqList";
import ModuleEditor from "@/components/learn/ModuleEditor";

export default function CollectionDetail() {
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
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

  // Count documents for this collection
  const { data: docCount, refetch: refetchDocCount } = useQuery({
    queryKey: ["doc-count", curriculumId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_documents")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", curriculumId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!curriculumId,
  });

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
            setProgress(10);
            setProgressLabel("Analisi documenti e creazione outline...");
          } else if (row.current_step === "outline_completed") {
            setProgress(20);
            setProgressLabel(`Outline completato. Generazione ${totalSteps} moduli...`);
            refreshAll();
          } else if (row.current_step?.startsWith("module_") && totalSteps > 0) {
            const pct = 20 + Math.round((completedSteps / totalSteps) * 70);
            setProgress(pct);
            setProgressLabel(`Modulo ${completedSteps}/${totalSteps} completato...`);
            refreshAll();
          }

          if (newStatus === "completed") {
            clearTimeout(timeout);
            const count = row.result?.count ?? 0;
            stopGeneration(true);
            toast.success(`${count} moduli generati.`);
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
    // Check if there are documents first
    if ((docCount ?? 0) === 0) {
      setNoDocsDialogOpen(true);
      return;
    }
    doGenerate();
  };

  const doGenerate = async () => {
    setGenerating(true);
    setProgress(2);
    setProgressLabel("Invio richiesta...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-curriculum", {
        body: { collection_id: curriculumId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.jobId) subscribeToJob(data.jobId);
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
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Genera moduli
            </Button>
            {hasEmptyModules && (
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
                Genera contenuti
              </Button>
            )}
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
        {currentModules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nessun modulo. Clicca "Genera moduli" per crearli dalla Knowledge Base.
          </p>
        ) : (
          <CollectionModuleList
            modules={currentModules}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onRefresh={refreshAll}
          />
        )}
      </div>

      {/* Documenti & FAQ — solo admin */}
      {isAdmin && (
        <>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Documenti</h2>
            <DocumentsList collectionId={curriculumId!} onUploadComplete={refreshAll} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">FAQ</h2>
            <FaqList collectionId={curriculumId!} />
          </div>
        </>
      )}

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
              // Scroll to documents section
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
    </div>
  );
}
