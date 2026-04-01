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
    supabase
      .from("modules")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", mod.id)
      .then(() => onEdit(mod.id));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {modules.map((mod) => {
        const sourceDocIds = Array.isArray(mod.source_document_ids) ? mod.source_document_ids : [];
        const sourceFaqIds = Array.isArray(mod.source_faq_ids) ? mod.source_faq_ids : [];

        return (
          <Card
            key={mod.id}
            className="flex flex-col h-full border-dashed border-primary/30 bg-primary/[0.03] overflow-hidden"
          >
            <div className="flex-1 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground leading-tight">
                      {mod.title}
                    </h3>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => handleApprove(mod)}
                        title="Approva e pubblica"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditAsDraft(mod)}
                        title="Modifica come bozza"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleReject(mod)}
                        title="Rifiuta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {mod.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2">{mod.summary}</p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Proposto
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {mod.track}
                </Badge>
              </div>

              {mod.ai_rationale && (
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-2">
                  <span className="font-medium">Motivazione AI:</span> {mod.ai_rationale}
                </div>
              )}
            </div>

            {(sourceDocIds.length > 0 || sourceFaqIds.length > 0) && (
              <div className="px-5 pb-4 flex items-center gap-3 text-xs text-muted-foreground">
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
