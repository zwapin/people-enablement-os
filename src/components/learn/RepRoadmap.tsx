import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, Clock, BookOpen } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;
type Completion = Tables<"module_completions">;

interface RepRoadmapProps {
  modules: Module[];
  completions: Completion[];
}

type ModuleState = "completed" | "available" | "locked";

export default function RepRoadmap({ modules, completions }: RepRoadmapProps) {
  const navigate = useNavigate();

  const completionMap = new Map(completions.map((c) => [c.module_id, c]));

  const getState = (mod: Module): ModuleState => {
    if (completionMap.has(mod.id)) return "completed";
    return "available";
  };

  const completedCount = modules.filter((m) => completionMap.has(m.id)).length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header + global progress */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Il tuo percorso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completa i moduli in sequenza per avanzare nel curriculum.
          </p>
        </div>

        <Card className="p-4 bg-card border-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Progresso curriculum
            </span>
            <span className="font-mono text-foreground">
              {completedCount}/{modules.length} moduli · {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </Card>
      </div>

      {/* Roadmap */}
      <div className="relative">
        {modules.map((mod, idx) => {
          const state = getState(mod, idx);
          const completion = completionMap.get(mod.id);
          const readingTime = mod.content_body
            ? Math.max(1, Math.ceil(mod.content_body.length / 1000))
            : 1;
          const isLast = idx === modules.length - 1;

          return (
            <div key={mod.id} className="relative flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center shrink-0 w-8">
                {/* Node */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    state === "completed"
                      ? "bg-primary text-primary-foreground"
                      : state === "available"
                      ? "bg-primary/20 border-2 border-primary text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {state === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : state === "locked" ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                {/* Line */}
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[1rem] ${
                      state === "completed"
                        ? "bg-primary/40"
                        : "bg-border"
                    }`}
                  />
                )}
              </div>

              {/* Card */}
              <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
                <Card
                  className={`p-4 transition-all ${
                    state === "available"
                      ? "bg-card border-primary/30 cursor-pointer hover:border-primary/60 hover:shadow-md hover:shadow-primary/5"
                      : state === "completed"
                      ? "bg-card border-border"
                      : "bg-card/50 border-border opacity-50"
                  }`}
                  onClick={() => {
                    if (state === "available" || state === "completed") {
                      navigate(`/learn/${mod.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h3
                          className={`font-medium truncate ${
                            state === "locked"
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {mod.title}
                        </h3>
                      </div>

                      {mod.summary && (
                        <p className="text-sm text-muted-foreground truncate">
                          {mod.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {mod.track}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {readingTime} min
                        </span>
                        {state === "completed" && completion && (
                          <span className="flex items-center gap-1 text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Punteggio: {completion.score}
                          </span>
                        )}
                      </div>
                    </div>

                    {state === "available" && (
                      <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20 text-[10px]">
                        Disponibile
                      </Badge>
                    )}
                    {state === "completed" && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-primary/30 text-primary text-[10px]"
                      >
                        Completato
                      </Badge>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
