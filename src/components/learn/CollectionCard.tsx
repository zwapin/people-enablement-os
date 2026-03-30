import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Eye,
  EyeOff,
  Archive,
  Check,
  X,
  BookOpen,
  FileText,
  HelpCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface Collection {
  id: string;
  title: string;
  description: string | null;
  track: string;
  order_index: number;
  status: string;
  created_at: string;
  updated_at: string;
  categories?: string[] | null;
}

const MACRO_CATEGORIES = [
  { key: "sales", label: "Sales" },
  { key: "customer_success", label: "Customer Success" },
  { key: "operations", label: "Operations" },
  { key: "common", label: "Common Knowledge" },
];

interface CollectionCardProps {
  collection: Collection;
  modules: Module[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function CollectionCard({
  collection,
  modules,
  isAdmin,
  onRefresh,
}: CollectionCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(collection.title);
  const [editDesc, setEditDesc] = useState(collection.description || "");
  const [showRepStats, setShowRepStats] = useState(false);

  const publishedModuleIds = modules.filter(m => m.status === "published").map(m => m.id);
  const publishedCount = publishedModuleIds.length;

  const { data: docCount } = useQuery({
    queryKey: ["doc-count", collection.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("knowledge_documents")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collection.id);
      return count ?? 0;
    },
  });

  const { data: faqCount } = useQuery({
    queryKey: ["faq-count", collection.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("knowledge_faqs")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collection.id);
      return count ?? 0;
    },
  });

  // Fetch rep profiles
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
    enabled: isAdmin,
  });

  // Fetch all completions for published modules in this collection
  const { data: allCompletions } = useQuery({
    queryKey: ["collection-completions", collection.id, publishedModuleIds],
    queryFn: async () => {
      if (publishedModuleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("module_completions")
        .select("*")
        .in("module_id", publishedModuleIds);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && publishedModuleIds.length > 0,
  });

  // Fetch assessment questions count per module to know if assessment exists
  const { data: assessmentCounts } = useQuery({
    queryKey: ["assessment-counts", collection.id, publishedModuleIds],
    queryFn: async () => {
      if (publishedModuleIds.length === 0) return {};
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("module_id")
        .in("module_id", publishedModuleIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(q => {
        counts[q.module_id] = (counts[q.module_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin && publishedModuleIds.length > 0,
  });

  const PASS_THRESHOLD = 70;

  const getRepStats = () => {
    if (!repProfiles || !allCompletions || publishedCount === 0) return [];
    const completionsByUser = new Map<string, typeof allCompletions>();
    allCompletions.forEach(c => {
      const arr = completionsByUser.get(c.user_id) ?? [];
      arr.push(c);
      completionsByUser.set(c.user_id, arr);
    });

    const modulesWithAssessment = new Set(
      Object.keys(assessmentCounts ?? {}).filter(id => (assessmentCounts![id] || 0) > 0)
    );

    return repProfiles.map(rep => {
      const userCompletions = completionsByUser.get(rep.user_id) ?? [];
      const completedModuleIds = new Set(userCompletions.map(c => c.module_id));
      const completedCount = publishedModuleIds.filter(id => completedModuleIds.has(id)).length;

      // Check if any completed module has assessment but score < threshold
      const needsRetake = userCompletions.some(c =>
        modulesWithAssessment.has(c.module_id) && c.score < PASS_THRESHOLD
      );

      // Modules with assessment that haven't been completed yet
      const pendingAssessments = publishedModuleIds.filter(
        id => modulesWithAssessment.has(id) && !completedModuleIds.has(id)
      ).length;

      return {
        name: rep.full_name,
        completedCount,
        totalModules: publishedCount,
        needsRetake,
        pendingAssessments,
        failedModules: userCompletions.filter(
          c => modulesWithAssessment.has(c.module_id) && c.score < PASS_THRESHOLD
        ),
      };
    });
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("curricula")
      .update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", collection.id);

    if (error) {
      toast.error("Aggiornamento fallito");
    } else {
      toast.success("Collection aggiornata");
      setEditing(false);
      onRefresh();
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = collection.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("curricula")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", collection.id);

    if (error) {
      toast.error("Aggiornamento stato fallito");
    } else {
      toast.success(
        `Collection ${newStatus === "published" ? "pubblicata" : "spostata in bozza"}`
      );
      onRefresh();
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("curricula")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", collection.id);

    if (error) {
      toast.error("Archiviazione fallita");
    } else {
      toast.success("Collection archiviata");
      onRefresh();
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const moduleIds = modules.map(m => m.id);
    for (const mId of moduleIds) {
      await supabase.from("assessment_questions").delete().eq("module_id", mId);
    }
    await supabase.from("modules").delete().eq("curriculum_id", collection.id);
    await supabase.from("knowledge_documents").delete().eq("collection_id", collection.id);
    await supabase.from("knowledge_faqs").delete().eq("collection_id", collection.id);
    const { error } = await supabase.from("curricula").delete().eq("id", collection.id);
    if (error) {
      toast.error("Eliminazione fallita");
    } else {
      toast.success("Collection eliminata");
      onRefresh();
    }
  };

  const handleCardClick = () => {
    if (!editing) {
      navigate(`/learn/${collection.id}`);
    }
  };

  const repStats = isAdmin ? getRepStats() : [];

  return (
    <Card
      className="border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
      onClick={handleCardClick}
    >
      <div className="flex items-start sm:items-center gap-3 p-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-semibold"
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Descrizione..."
                className="min-h-[40px] text-sm"
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="h-3 w-3 mr-1" />
                  Salva
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(false);
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Annulla
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-semibold text-foreground truncate">
                  {collection.title}
                </h3>
                <Badge
                  variant={
                    collection.status === "published" ? "default" : "secondary"
                  }
                  className="text-[10px] uppercase shrink-0"
                >
                  {collection.status === "published"
                    ? "Pubblicato"
                    : collection.status === "draft"
                    ? "Bozza"
                    : collection.status === "archived"
                    ? "Archiviato"
                    : collection.status}
                </Badge>
              </div>
              {collection.description && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {collection.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {modules.length} moduli
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {docCount ?? 0} documenti
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  {faqCount ?? 0} FAQ
                </span>
              </div>
            </>
          )}
        </div>

        {isAdmin && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Category selector */}
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={(collection as any).category || "none"}
                onValueChange={async (val) => {
                  const newCat = val === "none" ? null : val;
                  const { error } = await supabase
                    .from("curricula")
                    .update({ category: newCat, updated_at: new Date().toISOString() })
                    .eq("id", collection.id);
                  if (error) {
                    toast.error("Aggiornamento fallito");
                  } else {
                    onRefresh();
                  }
                }}
              >
                <SelectTrigger className="h-7 w-[130px] text-[11px]">
                  <SelectValue placeholder="Categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Nessuna</SelectItem>
                  {MACRO_CATEGORIES.map(cat => (
                    <SelectItem key={cat.key} value={cat.key} className="text-xs">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {publishedCount > 0 && repStats.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRepStats(!showRepStats);
                }}
                title="Stato Klaaryan"
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleStatus}
              title={
                collection.status === "published"
                  ? "Sposta in bozza"
                  : "Pubblica"
              }
            >
              {collection.status === "published" ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleArchive}
              title="Archivia"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                  title="Elimina"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa collection?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La collection "{collection.title}" e tutti i moduli, domande e documenti associati verranno eliminati permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Rep stats panel */}
      {isAdmin && showRepStats && repStats.length > 0 && (
        <div
          className="border-t border-border px-4 py-3 space-y-2 bg-muted/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" />
            Stato Klaaryan ({repStats.length})
          </div>
          <div className="space-y-1.5">
            {repStats.map((rep, i) => {
              const allDone = rep.completedCount === rep.totalModules;
              const hasIssue = rep.needsRetake;

              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-card"
                >
                  <span className="font-medium text-foreground truncate min-w-0">
                    {rep.name}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Modules completed */}
                    <span className="text-muted-foreground font-mono">
                      {rep.completedCount}/{rep.totalModules}
                    </span>

                    {/* Status icon */}
                    {allDone && !hasIssue && (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Completato
                      </Badge>
                    )}
                    {hasIssue && (
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Da rifare ({rep.failedModules.length})
                      </Badge>
                    )}
                    {!allDone && !hasIssue && rep.pendingAssessments > 0 && (
                      <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground gap-1">
                        <XCircle className="h-3 w-3" />
                        {rep.pendingAssessments} assessment
                      </Badge>
                    )}
                    {!allDone && !hasIssue && rep.pendingAssessments === 0 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        In corso
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
