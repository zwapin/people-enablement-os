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
}

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

  const handleCardClick = () => {
    if (!editing) {
      navigate(`/learn/${collection.id}`);
    }
  };

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
          <div className="flex items-center gap-1 shrink-0">
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
          </div>
        )}
      </div>
    </Card>
  );
}
