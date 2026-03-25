import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Tables } from "@/integrations/supabase/types";

type AssessmentQuestion = Tables<"assessment_questions">;

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "content" | "assessment" | "score";

export default function ModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const assessmentRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("content");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<
    { question: AssessmentQuestion; optionMap: number[] }[]
  >([]);
  const [saving, setSaving] = useState(false);

  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ["module", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("id", moduleId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId,
  });

  const { data: questions } = useQuery({
    queryKey: ["assessment_questions", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("module_id", moduleId!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId,
  });

  const { data: nextModule } = useQuery({
    queryKey: ["next_module", module?.order_index],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("id")
        .eq("status", "published")
        .gt("order_index", module!.order_index)
        .order("order_index")
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!module,
  });

  const readingTime = module?.content_body
    ? Math.max(1, Math.ceil(module.content_body.length / 1000))
    : 1;

  const keyPoints = useMemo(() => {
    if (!module?.key_points) return [];
    if (Array.isArray(module.key_points)) return module.key_points as string[];
    return [];
  }, [module]);

  const prepareAssessment = useCallback(() => {
    if (!questions?.length) return;
    const shuffledQs = shuffle(questions);
    const mapped = shuffledQs.map((q) => {
      const opts = (q.options as string[]) || [];
      const indices = opts.map((_, i) => i);
      const shuffledIndices = shuffle(indices);
      return { question: q, optionMap: shuffledIndices };
    });
    setShuffledQuestions(mapped);
    setAnswers(new Array(mapped.length).fill(null));
    setCurrentQ(0);
    setSelectedIdx(null);
  }, [questions]);

  const handleStartAssessment = () => {
    prepareAssessment();
    setPhase("assessment");
    setTimeout(() => {
      assessmentRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSelectOption = (displayIdx: number) => {
    if (selectedIdx !== null) return; // already answered
    setSelectedIdx(displayIdx);
    const newAnswers = [...answers];
    newAnswers[currentQ] = displayIdx;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQ < shuffledQuestions.length - 1) {
      setCurrentQ((p) => p + 1);
      setSelectedIdx(null);
    } else {
      // Calculate score and go to score screen
      setPhase("score");
    }
  };

  const currentQuestion = shuffledQuestions[currentQ];
  const currentOptions = currentQuestion
    ? currentQuestion.optionMap.map(
        (origIdx) => ((currentQuestion.question.options as string[]) || [])[origIdx]
      )
    : [];
  const correctDisplayIdx = currentQuestion
    ? currentQuestion.optionMap.indexOf(currentQuestion.question.correct_index)
    : -1;

  // Score calculation
  const totalQuestions = shuffledQuestions.length;
  const correctCount = answers.reduce((acc, ans, idx) => {
    if (ans === null) return acc;
    const q = shuffledQuestions[idx];
    const correctDisplay = q.optionMap.indexOf(q.question.correct_index);
    return acc + (ans === correctDisplay ? 1 : 0);
  }, 0);
  const passed = totalQuestions > 0 && correctCount / totalQuestions >= 0.7;

  const scoreMessage = useMemo(() => {
    if (totalQuestions === 0) return "";
    if (correctCount === totalQuestions)
      return "Perfetto! Hai risposto correttamente a tutte le domande. 🎉";
    if (passed)
      return "Ottimo lavoro! Hai superato l'assessment. Puoi procedere al modulo successivo.";
    return "Non hai raggiunto il punteggio minimo. Rivedi il contenuto e riprova l'assessment.";
  }, [correctCount, totalQuestions, passed]);

  const handleSaveAndContinue = async () => {
    if (!user || !moduleId || saving) return;
    setSaving(true);
    try {
      await supabase.from("module_completions").insert({
        user_id: user.id,
        module_id: moduleId,
        score: correctCount,
        attempts: 1,
      });
    } catch {
      // ignore duplicate
    }
    setSaving(false);
    if (nextModule) {
      navigate(`/learn/${nextModule.id}`);
    } else {
      navigate("/learn");
    }
  };

  const handleRetry = () => {
    prepareAssessment();
    setPhase("assessment");
    setSelectedIdx(null);
    setTimeout(() => {
      assessmentRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  if (moduleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Caricamento modulo...</div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-muted-foreground">Modulo non trovato.</p>
        <Button variant="outline" onClick={() => navigate("/learn")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna al curriculum
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Back */}
      <button
        onClick={() => navigate("/learn")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna al curriculum
      </button>

      {/* ===== ATTO 1 — CONTENUTO ===== */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {module.track}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {readingTime} min lettura
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{module.title}</h1>
        {module.summary && (
          <p className="text-muted-foreground">{module.summary}</p>
        )}
      </header>

      {/* Markdown content */}
      {module.content_body && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-li:text-foreground/80">
          <ReactMarkdown>{module.content_body}</ReactMarkdown>
        </article>
      )}

      {/* Key points */}
      {keyPoints.length > 0 && (
        <Card className="p-6 bg-secondary/50 border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lightbulb className="h-4 w-4 text-primary" />
            Punti Chiave
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-foreground/80"
              >
                <span className="text-primary mt-0.5">•</span>
                {String(point)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Start assessment button */}
      {phase === "content" && questions && questions.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleStartAssessment}>
            Inizia Assessment
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ===== ATTO 2 — ASSESSMENT ===== */}
      {phase === "assessment" && currentQuestion && (
        <div ref={assessmentRef} className="space-y-6 pt-8 border-t border-border">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Domanda {currentQ + 1} di {totalQuestions}
              </span>
              <span className="font-mono">
                {Math.round(((currentQ + 1) / totalQuestions) * 100)}%
              </span>
            </div>
            <Progress
              value={((currentQ + 1) / totalQuestions) * 100}
              className="h-1.5"
            />
          </div>

          {/* Question */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {currentQuestion.question.question}
            </h3>

            <div className="space-y-2">
              {currentOptions.map((opt, displayIdx) => {
                const isSelected = selectedIdx === displayIdx;
                const isCorrect = displayIdx === correctDisplayIdx;
                const answered = selectedIdx !== null;

                let variant = "outline" as "outline" | "default" | "destructive";
                let extraClass = "justify-start text-left h-auto py-3 px-4 ";

                if (answered) {
                  if (isCorrect) {
                    extraClass +=
                      "border-green-500 bg-green-500/10 text-green-400 ";
                  } else if (isSelected && !isCorrect) {
                    extraClass +=
                      "border-destructive bg-destructive/10 text-destructive ";
                  } else {
                    extraClass += "opacity-50 ";
                  }
                } else {
                  extraClass +=
                    "hover:border-primary/50 hover:bg-secondary/50 ";
                }

                return (
                  <Button
                    key={displayIdx}
                    variant={variant}
                    className={extraClass + "w-full"}
                    onClick={() => handleSelectOption(displayIdx)}
                    disabled={answered}
                  >
                    <span className="font-mono text-xs mr-3 opacity-60">
                      {String.fromCharCode(65 + displayIdx)}
                    </span>
                    {opt}
                  </Button>
                );
              })}
            </div>

            {/* Feedback */}
            {selectedIdx !== null && (
              <div className="space-y-3">
                <Card
                  className={`p-4 text-sm ${
                    selectedIdx === correctDisplayIdx
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  {selectedIdx === correctDisplayIdx ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                      <span className="text-foreground/80">
                        {currentQuestion.question.feedback_correct ||
                          "Risposta corretta!"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <span className="text-foreground/80">
                        {currentQuestion.question.feedback_wrong ||
                          "Risposta sbagliata. La risposta corretta era: " +
                            currentOptions[correctDisplayIdx]}
                      </span>
                    </div>
                  )}
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleNextQuestion}>
                    {currentQ < totalQuestions - 1
                      ? "Prossima domanda"
                      : "Vedi risultato"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ATTO 3 — SCORE ===== */}
      {phase === "score" && (
        <div className="space-y-8 pt-8 border-t border-border">
          {/* Big score */}
          <div className="text-center space-y-3">
            <div className="text-6xl font-bold text-foreground">
              {correctCount}
              <span className="text-2xl text-muted-foreground">
                /{totalQuestions}
              </span>
            </div>
            <p
              className={`text-sm ${
                passed ? "text-green-400" : "text-destructive"
              }`}
            >
              {scoreMessage}
            </p>
          </div>

          {/* Question review */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Riepilogo
            </h4>
            {shuffledQuestions.map((sq, idx) => {
              const userAnswer = answers[idx];
              const correctDisplay = sq.optionMap.indexOf(
                sq.question.correct_index
              );
              const isCorrect = userAnswer === correctDisplay;
              const opts = sq.optionMap.map(
                (origIdx) =>
                  ((sq.question.options as string[]) || [])[origIdx]
              );

              return (
                <Card
                  key={idx}
                  className={`p-3 flex items-start gap-3 ${
                    isCorrect
                      ? "border-green-500/20"
                      : "border-destructive/20"
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {sq.question.question}
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Risposta corretta:{" "}
                        <span className="text-green-400">
                          {opts[correctDisplay]}
                        </span>
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            {passed ? (
              <Button size="lg" onClick={handleSaveAndContinue} disabled={saving}>
                {nextModule
                  ? "Continua al modulo successivo"
                  : "Torna al curriculum"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Riprova assessment
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
