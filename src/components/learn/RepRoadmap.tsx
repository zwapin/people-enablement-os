import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, Clock, BookOpen } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"modules">;
type Completion = Tables<"module_completions">;

interface Curriculum {
  id: string;
  title: string;
  description: string | null;
}

interface RepRoadmapProps {
  modules: Module[];
  completions: Completion[];
  curricula?: Curriculum[];
}

type ModuleState = "completed" | "available";

export default function RepRoadmap({ modules, completions, curricula = [] }: RepRoadmapProps) {
  const navigate = useNavigate();
  const completionMap = new Map(completions.map((c) => [c.module_id, c]));

  const getState = (mod: Module): ModuleState => {
    if (completionMap.has(mod.id)) return "completed";
    return "available";
  };

  const completedCount = modules.filter((m) => completionMap.has(m.id)).length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  // Group modules by curriculum
  const curriculaMap = new Map(curricula.map(c => [c.id, c]));
  const grouped: { curriculum: Curriculum | null; modules: Module[] }[] = [];

  // Curricula with their modules (in order)
  for (const c of curricula) {
    const cModules = modules.filter(m => m.curriculum_id === c.id);
    if (cModules.length > 0) grouped.push({ curriculum: c, modules: cModules });
  }

  // Orphan modules
  const orphans = modules.filter(m => !m.curriculum_id);
  if (orphans.length > 0) grouped.push({ curriculum: null, modules: orphans });

  // If no curricula at all, just show flat
  const sections = grouped.length > 0 ? grouped : [{ curriculum: null, modules }];

  const renderModule = (mod: Module, idx: number, isLast: boolean) => {
    const state = getState(mod);
    const completion = completionMap.get(mod.id);
    const readingTime = mod.content_body
      ? Math.max(1, Math.ceil(mod.content_body.length / 1000))
      : 1;

    return (
      <div key={mod.id} className="relative flex gap-4">
        <div className="flex flex-col items-center shrink-0 w-8">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
              state === "completed"
                ? "bg-primary text-primary-foreground"
                : "bg-primary/20 border-2 border-primary text-primary"
            }`}
          >
            {state === "completed" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <span className="text-xs font-bold">{idx + 1}</span>
            )}
          </div>
          {!isLast && (
            <div
              className={`w-0.5 flex-1 min-h-[1rem] ${
                state === "completed" ? "bg-primary/40" : "bg-border"
              }`}
            />
          )}
        </div>

        <div className={`flex-1 pb-6`}>
          <Card
            className={`p-4 transition-all ${
              state === "available"
                ? "bg-card border-primary/30 cursor-pointer hover:border-primary/60 hover:shadow-md hover:shadow-primary/5"
                : "bg-card border-border cursor-pointer"
            }`}
            onClick={() => navigate(`/learn/${mod.id}/view`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-medium text-foreground truncate">{mod.title}</h3>
                </div>
                {mod.summary && (
                  <p className="text-sm text-muted-foreground truncate">{mod.summary}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <Badge variant="outline" className="text-[10px]">{mod.track}</Badge>
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
                <Badge variant="outline" className="shrink-0 border-primary/30 text-primary text-[10px]">
                  Completato
                </Badge>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header + global progress */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Il tuo percorso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completa i moduli per avanzare nel curriculum.
          </p>
        </div>
        <Card className="p-4 bg-card border-border space-y-2">
          <div className="flex items-center justify-between text-sm flex-wrap gap-1">
            <span className="text-muted-foreground">Progresso curriculum</span>
            <span className="font-mono text-foreground">
              {completedCount}/{modules.length} moduli · {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </Card>
      </div>

      {/* Sections */}
      {sections.map((section, sIdx) => {
        const sectionCompleted = section.modules.filter(m => completionMap.has(m.id)).length;
        const sectionPct = section.modules.length > 0
          ? Math.round((sectionCompleted / section.modules.length) * 100)
          : 0;

        return (
          <div key={section.curriculum?.id ?? "orphan"} className="space-y-4">
            {section.curriculum && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {section.curriculum.title}
                  </h2>
                </div>
                {section.curriculum.description && (
                  <p className="text-sm text-muted-foreground">
                    {section.curriculum.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{sectionCompleted}/{section.modules.length} completati</span>
                  <Progress value={sectionPct} className="h-1.5 w-24" />
                  <span>{sectionPct}%</span>
                </div>
              </div>
            )}

            <div className="relative">
              {section.modules.map((mod, idx) =>
                renderModule(mod, idx, idx === section.modules.length - 1)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
