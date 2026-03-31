import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;
type Completion = Tables<"module_completions">;

interface RepRoadmapProps {
  modules: Module[];
  completions: Completion[];
}

export default function RepRoadmap({ modules, completions }: RepRoadmapProps) {
  const navigate = useNavigate();
  const completionMap = new Map(completions.map((c) => [c.module_id, c]));

  const completedCount = modules.filter((m) => completionMap.has(m.id)).length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress for this collection */}
      <Card className="p-4 bg-card border-border space-y-2">
        <div className="flex items-center justify-between text-sm flex-wrap gap-1">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-mono text-foreground">
            {completedCount}/{modules.length} moduli · {progressPct}%
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </Card>

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod, idx) => {
          const isCompleted = completionMap.has(mod.id);
          const completion = completionMap.get(mod.id);
          const readingTime = mod.content_body
            ? Math.max(1, Math.ceil(mod.content_body.length / 1000))
            : 1;

          return (
            <Card
              key={mod.id}
              className={`p-4 transition-all cursor-pointer border-l-4 ${
                isCompleted
                  ? "bg-secondary/5 border-l-secondary border-secondary/20 hover:shadow-md hover:shadow-secondary/5"
                  : "bg-card border-l-primary/30 border-border hover:border-l-primary hover:shadow-md hover:shadow-primary/5"
              }`}
              onClick={() => navigate(`/learn/${mod.id}/view`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-medium text-foreground truncate">{mod.title}</h3>
                    </div>
                    {mod.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{mod.summary}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <Badge variant="outline" className="text-[10px]">{mod.track}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readingTime} min
                      </span>
                      {isCompleted && completion && (
                        <span className="flex items-center gap-1 text-secondary">
                          <CheckCircle2 className="h-3 w-3" />
                          Punteggio: {completion.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!isCompleted && (
                  <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20 text-[10px]">
                    Disponibile
                  </Badge>
                )}
                {isCompleted && (
                  <Badge className="shrink-0 bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
                    Completato
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
