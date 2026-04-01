import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Tag,
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
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";
import { MACRO_CATEGORIES, getCollectionCategories } from "@/lib/constants";

type Module = Tables<"modules">;
type Profile = Tables<"profiles">;
type Completion = Tables<"module_completions">;

interface Collection {
  id: string;
  title: string;
  description: string | null;
  track: string;
  order_index: number;
  status: string;
  created_at: string;
  updated_at: string;
  categories?: unknown;
}

interface CollectionCardProps {
  collection: Collection;
  modules: Module[];
  isAdmin: boolean;
  onRefresh: () => void;
  /** Pre-fetched from page level */
  repProfiles?: Profile[];
  /** Pre-fetched from page level */
  allCompletions?: Completion[];
  /** Pre-fetched from page level: { [moduleId]: questionCount } */
  assessmentCounts?: Record<string, number>;
  /** Pre-fetched from page level */
  docCount?: number;
  /** Pre-fetched from page level */
  faqCount?: number;
}

export default function CollectionCard({
  collection,
  modules,
  isAdmin,
  onRefresh,
  repProfiles,
  allCompletions,
  assessmentCounts,
  docCount,
  faqCount,
}: CollectionCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(collection.title);
  const [editDesc, setEditDesc] = useState(collection.description || "");
  const [showRepStats, setShowRepStats] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const publishedModuleIds = modules.filter(m => m.status === "published").map(m => m.id);
  const publishedCount = publishedModuleIds.length;

  const categories = getCollectionCategories(collection.categories);
  const PASS_THRESHOLD = 70;

  const getRepStats = () => {
    if (!repProfiles || !allCompletions || publishedCount === 0) return [];
    
    // Filter completions relevant to this collection's modules
    const relevantCompletions = allCompletions.filter(c => publishedModuleIds.includes(c.module_id));
    
    const completionsByUser = new Map<string, typeof relevantCompletions>();
    relevantCompletions.forEach(c => {
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

      const needsRetake = userCompletions.some(c =>
        modulesWithAssessment.has(c.module_id) && c.score < PASS_THRESHOLD
      );

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

  const handleToggleStatus = async () => {
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

  const handleArchive = async () => {
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

  const handleDelete = async () => {
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

  const handleToggleCategory = async (catKey: string) => {
    const current = [...categories];
    const updated = current.includes(catKey)
      ? current.filter(c => c !== catKey)
      : [...current, catKey];
    const { error } = await supabase
      .from("curricula")
      .update({ categories: updated, updated_at: new Date().toISOString() } as any)
      .eq("id", collection.id);
    if (error) {
      toast.error("Aggiornamento fallito");
    } else {
      onRefresh();
    }
  };

  const handleCardClick = () => {
    if (!editing) {
      // If collection has exactly 1 module, navigate directly to module view
      if (modules.length === 1) {
        navigate(`/learn/${collection.id}/module/${modules[0].id}`);
      } else {
        navigate(`/learn/${collection.id}`);
      }
    }
  };

  const repStats = isAdmin ? getRepStats() : [];

  return (
    <>
      <Card
        className="flex flex-col h-full border-border bg-card overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all"
        onClick={handleCardClick}
      >
        <div className="flex-1 p-5 space-y-3">
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
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground leading-tight">
                      {collection.title}
                    </h3>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {publishedCount > 0 && repStats.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowRepStats(!showRepStats)} title="Stato Klaaryan">
                            <Users className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditing(true)}>
                              <Pencil className="h-4 w-4 mr-2" />Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleToggleStatus}>
                              {collection.status === "published" ? (<><EyeOff className="h-4 w-4 mr-2" />Sposta in bozza</>) : (<><Eye className="h-4 w-4 mr-2" />Pubblica</>)}
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger><Tag className="h-4 w-4 mr-2" />Categorie</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {MACRO_CATEGORIES.map(cat => (
                                  <DropdownMenuItem key={cat.key} onClick={() => handleToggleCategory(cat.key)}>
                                    <span className="flex items-center gap-2 w-full">
                                      <span className={`h-3 w-3 rounded-sm border flex items-center justify-center ${categories.includes(cat.key) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                                        {categories.includes(cat.key) && <Check className="h-2 w-2 text-primary-foreground" />}
                                      </span>
                                      {cat.label}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleArchive}><Archive className="h-4 w-4 mr-2" />Archivia</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                              <Trash2 className="h-4 w-4 mr-2" />Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {collection.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{collection.description}</p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={collection.status === "published" ? "default" : "secondary"} className="text-[10px] uppercase shrink-0">
                  {collection.status === "published" ? "Pubblicato" : collection.status === "draft" ? "Bozza" : collection.status === "archived" ? "Archiviato" : collection.status}
                </Badge>
                {categories.map(catKey => {
                  const cat = MACRO_CATEGORIES.find(c => c.key === catKey);
                  return cat ? <Badge key={cat.key} variant="outline" className="text-[10px] shrink-0">{cat.label}</Badge> : null;
                })}
              </div>
            </>
          )}
        </div>

        {/* Progress footer */}
        {!editing && (
          <div className="px-5 pb-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{modules.length > 0 ? `${publishedCount}/${modules.length} moduli` : "0 moduli"}</span>
              <div className="flex items-center gap-2">
                {(docCount ?? 0) > 0 && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{docCount}</span>}
                {(faqCount ?? 0) > 0 && <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{faqCount}</span>}
              </div>
            </div>
            <Progress value={modules.length > 0 ? (publishedCount / modules.length) * 100 : 0} className="h-1.5" />
          </div>
        )}

        {/* Rep stats panel */}
        {isAdmin && showRepStats && repStats.length > 0 && (
          <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <Users className="h-3.5 w-3.5" />Stato Klaaryan ({repStats.length})
            </div>
            <div className="space-y-1.5">
              {repStats.map((rep, i) => {
                const allDone = rep.completedCount === rep.totalModules;
                const hasIssue = rep.needsRetake;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-card">
                    <span className="font-medium text-foreground truncate min-w-0">{rep.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground font-mono">{rep.completedCount}/{rep.totalModules}</span>
                      {allDone && !hasIssue && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1"><CheckCircle2 className="h-3 w-3" />Completato</Badge>}
                      {hasIssue && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive gap-1"><AlertTriangle className="h-3 w-3" />Da rifare ({rep.failedModules.length})</Badge>}
                      {!allDone && !hasIssue && rep.pendingAssessments > 0 && <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground gap-1"><XCircle className="h-3 w-3" />{rep.pendingAssessments} assessment</Badge>}
                      {!allDone && !hasIssue && rep.pendingAssessments === 0 && <Badge variant="outline" className="text-[10px] text-muted-foreground">In corso</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa collection?</AlertDialogTitle>
            <AlertDialogDescription>
              La collection &ldquo;{collection.title}&rdquo; e tutti i moduli, domande e documenti associati verranno eliminati permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
