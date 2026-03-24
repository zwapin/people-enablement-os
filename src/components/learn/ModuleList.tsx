import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GripVertical, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface ModuleListProps {
  modules: Module[];
  isAdmin: boolean;
  onEdit: (moduleId: string) => void;
  onRefresh: () => void;
}

export default function ModuleList({ modules, isAdmin, onEdit, onRefresh }: ModuleListProps) {
  const handleToggleStatus = async (mod: Module) => {
    const newStatus = mod.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("modules")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", mod.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Module ${newStatus === "published" ? "published" : "unpublished"}`);
      onRefresh();
    }
  };

  const handleDelete = async (mod: Module) => {
    if (!confirm(`Delete "${mod.title}"? This cannot be undone.`)) return;

    // Delete questions first, then module
    await supabase.from("assessment_questions").delete().eq("module_id", mod.id);
    const { error } = await supabase.from("modules").delete().eq("id", mod.id);

    if (error) {
      toast.error("Failed to delete module");
    } else {
      toast.success("Module deleted");
      onRefresh();
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const current = modules[index];
    const above = modules[index - 1];
    await Promise.all([
      supabase.from("modules").update({ order_index: above.order_index }).eq("id", current.id),
      supabase.from("modules").update({ order_index: current.order_index }).eq("id", above.id),
    ]);
    onRefresh();
  };

  const handleMoveDown = async (index: number) => {
    if (index === modules.length - 1) return;
    const current = modules[index];
    const below = modules[index + 1];
    await Promise.all([
      supabase.from("modules").update({ order_index: below.order_index }).eq("id", current.id),
      supabase.from("modules").update({ order_index: current.order_index }).eq("id", below.id),
    ]);
    onRefresh();
  };

  return (
    <div className="space-y-2">
      {modules.map((mod, index) => (
        <Card
          key={mod.id}
          className="flex items-center gap-4 p-4 bg-card border-border"
        >
          {isAdmin && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <GripVertical className="h-4 w-4 rotate-180" />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === modules.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </div>
          )}

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
                {mod.status}
              </Badge>
            </div>
            {mod.summary && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{mod.summary}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Track: {mod.track}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleStatus(mod)}
                title={mod.status === "published" ? "Unpublish" : "Publish"}
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
                onClick={() => handleDelete(mod)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
