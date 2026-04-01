import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Archive, EyeOff, Eye, Trash2 } from "lucide-react";
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

interface CurriculumListProps {
  modules: Module[];
  isAdmin: boolean;
  onEdit: (moduleId: string) => void;
  onRefresh: () => void;
}

export default function CurriculumList({ modules, isAdmin, onEdit, onRefresh }: CurriculumListProps) {
  const handleToggleStatus = async (mod: Module) => {
    const newStatus = mod.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("modules")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", mod.id);

    if (error) {
      toast.error("Aggiornamento stato fallito");
    } else {
      toast.success(`Modulo ${newStatus === "published" ? "pubblicato" : "spostato in bozza"}`);
      onRefresh();
    }
  };

  const handleArchive = async (mod: Module) => {
    const { error } = await supabase
      .from("modules")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", mod.id);

    if (error) {
      toast.error("Archiviazione fallita");
    } else {
      toast.success("Modulo archiviato");
      onRefresh();
    }
  };

  const handleDelete = async (mod: Module) => {
    await supabase.from("assessment_questions").delete().eq("module_id", mod.id);
    const { error } = await supabase.from("modules").delete().eq("id", mod.id);

    if (error) {
      toast.error("Eliminazione fallita");
    } else {
      toast.success("Modulo eliminato");
      onRefresh();
    }
  };

  return (
    <div className="space-y-2">
      {modules.map((mod, index) => (
        <Card key={mod.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-card border-border cursor-pointer hover:border-primary/40 transition-colors" onClick={() => onEdit(mod.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-medium text-foreground truncate">{mod.title}</h3>
              <Badge
                variant={mod.status === "published" ? "default" : "secondary"}
                className="text-[10px] uppercase shrink-0"
              >
                {mod.status === "published" ? "Pubblicato" : mod.status === "draft" ? "Bozza" : mod.status === "archived" ? "Archiviato" : mod.status}
              </Badge>
            </div>
            {mod.summary && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{mod.summary}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Area: {mod.track}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleStatus(mod)}
                title={mod.status === "published" ? "Sposta in bozza" : "Pubblica"}
              >
                {mod.status === "published" ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(mod.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleArchive(mod)}
                title="Archivia"
                className="text-muted-foreground hover:text-foreground"
              >
                <Archive className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Elimina"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare questo modulo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Il modulo "{mod.title}" e tutte le domande associate verranno eliminati permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(mod)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}