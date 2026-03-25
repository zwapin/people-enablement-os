import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Pencil, X, Sparkles, FileText, HelpCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface ProposalsListProps {
  modules: Module[];
  onEdit: (moduleId: string) => void;
  onRefresh: () => void;
}

export default function ProposalsList({ modules, onEdit, onRefresh }: ProposalsListProps) {
  const handleApprove = async (mod: Module) => {
    const { error } = await supabase
      .from("modules")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", mod.id);

    if (error) {
      toast.error("Approvazione fallita");
    } else {
      toast.success(`"${mod.title}" pubblicato`);
      onRefresh();
    }
  };

  const handleReject = async (mod: Module) => {
    // Delete questions first, then module
    await supabase.from("assessment_questions").delete().eq("module_id", mod.id);
    const { error } = await supabase.from("modules").delete().eq("id", mod.id);

    if (error) {
      toast.error("Eliminazione fallita");
    } else {
      toast.success("Proposta rimossa");
      onRefresh();
    }
  };

  const handleEditAsDraft = (mod: Module) => {
    // Set to draft then open editor
    supabase
      .from("modules")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", mod.id)
      .then(() => onEdit(mod.id));
  };

  return (
    <div className="space-y-3">
      {modules.map((mod) => {
        const sourceDocIds = Array.isArray(mod.source_document_ids) ? mod.source_document_ids : [];
        const sourceFaqIds = Array.isArray(mod.source_faq_ids) ? mod.source_faq_ids : [];

        return (
          <Card
            key={mod.id}
            className="p-4 border-dashed border-primary/30 bg-primary/[0.03] space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Proposto
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {mod.track}
                  </Badge>
                </div>
                <h3 className="font-medium text-foreground mt-2">{mod.title}</h3>
                {mod.summary && (
                  <p className="text-sm text-muted-foreground mt-1">{mod.summary}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleApprove(mod)}
                  title="Approva e pubblica"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditAsDraft(mod)}
                  title="Modifica come bozza"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleReject(mod)}
                  title="Rifiuta"
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* AI Rationale */}
            {mod.ai_rationale && (
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-2">
                <span className="font-medium">Motivazione AI:</span> {mod.ai_rationale}
              </div>
            )}

            {/* Sources */}
            {(sourceDocIds.length > 0 || sourceFaqIds.length > 0) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {sourceDocIds.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {sourceDocIds.length} doc
                  </span>
                )}
                {sourceFaqIds.length > 0 && (
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    {sourceFaqIds.length} FAQ
                  </span>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
