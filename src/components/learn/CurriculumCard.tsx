import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Eye,
  EyeOff,
  Archive,
  Check,
  X,
  BookOpen,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import CurriculumList from "./CurriculumList";
import DocumentsList from "./DocumentsList";
import FaqList from "./FaqList";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface Curriculum {
  id: string;
  title: string;
  description: string | null;
  track: string;
  order_index: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CurriculumCardProps {
  curriculum: Curriculum;
  modules: Module[];
  isAdmin: boolean;
  onEdit: (moduleId: string) => void;
  onRefresh: () => void;
  onBulkGenerate?: (curriculumId: string) => void;
  isBulkGenerating?: boolean;
  onGenerateCurriculum?: (collectionId: string) => void;
  isGenerating?: boolean;
}

export default function CurriculumCard({
  curriculum,
  modules,
  isAdmin,
  onEdit,
  onRefresh,
  onBulkGenerate,
  isBulkGenerating,
  onGenerateCurriculum,
  isGenerating,
}: CurriculumCardProps) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(curriculum.title);
  const [editDesc, setEditDesc] = useState(curriculum.description || "");

  const handleSaveEdit = async () => {
    const { error } = await supabase
      .from("curricula")
      .update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", curriculum.id);

    if (error) {
      toast.error("Aggiornamento fallito");
    } else {
      toast.success("Curriculum aggiornato");
      setEditing(false);
      onRefresh();
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = curriculum.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("curricula")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", curriculum.id);

    if (error) {
      toast.error("Aggiornamento stato fallito");
    } else {
      toast.success(
        `Curriculum ${newStatus === "published" ? "pubblicato" : "spostato in bozza"}`
      );
      onRefresh();
    }
  };

  const handleArchive = async () => {
    const { error } = await supabase
      .from("curricula")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", curriculum.id);

    if (error) {
      toast.error("Archiviazione fallita");
    } else {
      toast.success("Curriculum archiviato");
      onRefresh();
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border bg-card overflow-hidden">
        <div className="flex items-start sm:items-center gap-3 p-4 flex-wrap">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7">
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
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
                    onClick={() => setEditing(false)}
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
                    {curriculum.title}
                  </h3>
                  <Badge
                    variant={
                      curriculum.status === "published" ? "default" : "secondary"
                    }
                    className="text-[10px] uppercase shrink-0"
                  >
                    {curriculum.status === "published"
                      ? "Pubblicato"
                      : curriculum.status === "draft"
                      ? "Bozza"
                      : curriculum.status === "archived"
                      ? "Archiviato"
                      : curriculum.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {modules.length} moduli
                  </span>
                </div>
                {curriculum.description && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {curriculum.description}
                  </p>
                )}
              </>
            )}
          </div>

          {isAdmin && !editing && (
            <div className="flex items-center gap-1 shrink-0">
              {onGenerateCurriculum && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onGenerateCurriculum(curriculum.id)}
                  disabled={isGenerating}
                  title="Genera curriculum da KB"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-primary" />
                  )}
                </Button>
              )}
              {onBulkGenerate && modules.some(m => !m.content_body) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onBulkGenerate(curriculum.id)}
                  disabled={isBulkGenerating}
                  title="Genera contenuti moduli"
                >
                  {isBulkGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleToggleStatus}
                title={
                  curriculum.status === "published"
                    ? "Sposta in bozza"
                    : "Pubblica"
                }
              >
                {curriculum.status === "published" ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
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
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 sm:pl-14">
            {isAdmin ? (
              <Tabs defaultValue="modules" className="space-y-3">
                <TabsList className="h-8">
                  <TabsTrigger value="modules" className="text-xs">Moduli</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documenti</TabsTrigger>
                  <TabsTrigger value="faqs" className="text-xs">FAQ</TabsTrigger>
                </TabsList>

                <TabsContent value="modules">
                  {modules.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Nessun modulo in questo curriculum.
                    </p>
                  ) : (
                    <CurriculumList
                      modules={modules}
                      isAdmin={isAdmin}
                      onEdit={onEdit}
                      onRefresh={onRefresh}
                    />
                  )}
                </TabsContent>

                <TabsContent value="documents">
                  <DocumentsList collectionId={curriculum.id} />
                </TabsContent>

                <TabsContent value="faqs">
                  <FaqList collectionId={curriculum.id} />
                </TabsContent>
              </Tabs>
            ) : (
              modules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nessun modulo in questo curriculum.
                </p>
              ) : (
                <CurriculumList
                  modules={modules}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onRefresh={onRefresh}
                />
              )
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
