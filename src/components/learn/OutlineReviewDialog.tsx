import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GripVertical, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface OutlineReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  collectionId: string;
  onApproved: () => void;
}

interface EditableModule {
  id: string;
  title: string;
  summary: string | null;
  order_index: number;
  isNew?: boolean;
}

export default function OutlineReviewDialog({
  open,
  onOpenChange,
  modules,
  collectionId,
  onApproved,
}: OutlineReviewDialogProps) {
  const [items, setItems] = useState<EditableModule[]>(() =>
    modules
      .filter((m) => m.status === "proposed")
      .sort((a, b) => a.order_index - b.order_index)
      .map((m) => ({ id: m.id, title: m.title, summary: m.summary, order_index: m.order_index }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Sync when modules change
  const proposedModules = modules.filter((m) => m.status === "proposed");
  if (
    proposedModules.length > 0 &&
    items.length === 0 &&
    !saving
  ) {
    setItems(
      proposedModules
        .sort((a, b) => a.order_index - b.order_index)
        .map((m) => ({ id: m.id, title: m.title, summary: m.summary, order_index: m.order_index }))
    );
  }

  const startEdit = (item: EditableModule) => {
    setEditingId(item.id);
    setEditValue(item.title);
  };

  const confirmEdit = () => {
    if (!editingId || !editValue.trim()) return;
    setItems((prev) =>
      prev.map((it) => (it.id === editingId ? { ...it, title: editValue.trim() } : it))
    );
    setEditingId(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    const newId = `new-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      { id: newId, title: "Nuovo modulo", summary: null, order_index: prev.length, isNew: true },
    ]);
    setEditingId(newId);
    setEditValue("Nuovo modulo");
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      // Delete removed proposed modules
      const keptIds = items.filter((it) => !it.isNew).map((it) => it.id);
      const removedModules = proposedModules.filter((m) => !keptIds.includes(m.id));
      for (const rm of removedModules) {
        await supabase.from("assessment_questions").delete().eq("module_id", rm.id);
        await supabase.from("modules").delete().eq("id", rm.id);
      }

      // Update existing and create new
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.isNew) {
          await supabase.from("modules").insert({
            title: item.title,
            summary: null,
            status: "draft",
            order_index: i,
            curriculum_id: collectionId,
            track: "Generale",
            key_points: [],
          });
        } else {
          await supabase
            .from("modules")
            .update({
              title: item.title,
              status: "draft",
              order_index: i,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }

      toast.success(`${items.length} moduli approvati`);
      onApproved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Errore nell'approvazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisione Outline</DialogTitle>
          <DialogDescription>
            Rivedi i titoli proposti dall'AI. Puoi modificarli, riordinarli o rimuoverli prima di approvare.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2.5 rounded-md border border-border bg-card group transition-colors ${
                dragIdx === idx ? "opacity-50" : ""
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
              <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>

              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={confirmEdit}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-foreground truncate">{item.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi modulo
        </Button>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleApprove} disabled={saving || items.length === 0}>
            {saving ? "Salvataggio..." : `Approva ${items.length} moduli`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
