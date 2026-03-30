import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ModuleCanvas from "./ModuleCanvas";
import ModulePreview from "./ModulePreview";
import { ArrowLeft, Loader2, Plus, Trash2, GripVertical, Save, Sparkles, ChevronDown, Lightbulb, HelpCircle, Eye } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface QuestionForm {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  feedback_correct: string;
  feedback_wrong: string;
}

interface Collection {
  id: string;
  title: string;
  status: string;
}

interface ModuleEditorProps {
  moduleId: string | null;
  onClose: () => void;
  collections?: Collection[];
}

export default function ModuleEditor({ moduleId, onClose, collections = [] }: ModuleEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceDocIds, setSourceDocIds] = useState<string[] | null>(null);
  const [sourceFaqIds, setSourceFaqIds] = useState<string[] | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [track, setTrack] = useState("Sales");
  const [contentBody, setContentBody] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  const [keyPointsOpen, setKeyPointsOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);

  const summaryRef = useRef<HTMLTextAreaElement>(null);

  // Cycling generation status messages
  const generationMessages = useMemo(() => [
    "Analisi documenti sorgente...",
    "Strutturazione del contenuto...",
    "Generazione contenuto...",
    "Creazione domande di valutazione...",
    "Quasi fatto...",
  ], []);

  useEffect(() => {
    if (!generating) {
      setGeneratingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setGeneratingStep((prev) => (prev + 1) % generationMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [generating, generationMessages]);

  // Auto-resize summary textarea
  useEffect(() => {
    if (summaryRef.current) {
      summaryRef.current.style.height = "auto";
      summaryRef.current.style.height = summaryRef.current.scrollHeight + "px";
    }
  }, [summary]);

  useEffect(() => {
    if (moduleId) loadModule();
  }, [moduleId]);

  const loadModule = async () => {
    if (!moduleId) return;
    setLoading(true);

    const [modResult, qResult] = await Promise.all([
      supabase.from("modules").select("*").eq("id", moduleId).single(),
      supabase.from("assessment_questions").select("*").eq("module_id", moduleId).order("order_index", { ascending: true }),
    ]);

    if (modResult.data) {
      const m = modResult.data;
      setTitle(m.title);
      setSummary(m.summary || "");
      setTrack(m.track);
      setContentBody(m.content_body || "");
      setKeyPoints(Array.isArray(m.key_points) ? (m.key_points as string[]) : []);
      setStatus(m.status);
      setCurriculumId(m.curriculum_id || null);
      setSourceDocIds(Array.isArray(m.source_document_ids) ? (m.source_document_ids as string[]) : null);
      setSourceFaqIds(Array.isArray(m.source_faq_ids) ? (m.source_faq_ids as string[]) : null);
    }

    if (qResult.data) {
      setQuestions(
        qResult.data.map((q) => ({
          id: q.id,
          question: q.question,
          options: Array.isArray(q.options) ? (q.options as string[]) : ["", "", "", ""],
          correct_index: q.correct_index,
          feedback_correct: q.feedback_correct || "",
          feedback_wrong: q.feedback_wrong || "",
        }))
      );
    }

    setLoading(false);
  };

  const handleSave = async (publishStatus?: string) => {
    if (!title.trim()) {
      toast.error("Il titolo è obbligatorio");
      return;
    }

    setSaving(true);
    const finalStatus = publishStatus || status;

    try {
      let modId = moduleId;

      if (moduleId) {
        const { error } = await supabase
          .from("modules")
          .update({
            title: title.trim(),
            summary: summary.trim() || null,
            track,
            content_body: contentBody.trim() || null,
            key_points: keyPoints as unknown as Json,
            status: finalStatus as any,
            curriculum_id: curriculumId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", moduleId);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from("modules")
          .select("order_index")
          .order("order_index", { ascending: false })
          .limit(1);

        const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

        const { data: newMod, error } = await supabase
          .from("modules")
          .insert({
            title: title.trim(),
            summary: summary.trim() || null,
            track,
            content_body: contentBody.trim() || null,
            key_points: keyPoints as unknown as Json,
            status: finalStatus as any,
            curriculum_id: curriculumId,
            order_index: nextOrder,
          })
          .select()
          .single();
        if (error) throw error;
        modId = newMod.id;
      }

      if (modId) {
        await supabase.from("assessment_questions").delete().eq("module_id", modId);

        if (questions.length > 0) {
          const qRows = questions.map((q, i) => ({
            module_id: modId!,
            question: q.question,
            options: q.options as unknown as Json,
            correct_index: q.correct_index,
            feedback_correct: q.feedback_correct || null,
            feedback_wrong: q.feedback_wrong || null,
            order_index: i,
          }));

          const { error: qError } = await supabase.from("assessment_questions").insert(qRows);
          if (qError) throw qError;
        }
      }

      toast.success(`Modulo ${finalStatus === "published" ? "pubblicato" : "salvato come bozza"}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Salvataggio fallito");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct_index: 0, feedback_correct: "", feedback_wrong: "" }]);
  };

  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const updateQuestion = (index: number, field: keyof QuestionForm, value: any) => {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions(questions.map((q, i) => i === qIndex ? { ...q, options: q.options.map((o, j) => (j === optIndex ? value : o)) } : q));
  };

  const addKeyPoint = () => setKeyPoints([...keyPoints, ""]);
  const removeKeyPoint = (i: number) => setKeyPoints(keyPoints.filter((_, j) => j !== i));
  const updateKeyPoint = (i: number, val: string) => setKeyPoints(keyPoints.map((kp, j) => (j === i ? val : kp)));

  const handleGenerate = async () => {
    if (!moduleId) {
      toast.error("Salva prima il modulo come bozza");
      return;
    }
    if (!title.trim()) {
      toast.error("Il titolo è obbligatorio per la generazione");
      return;
    }

    setGenerating(true);
    try {
      let docIds = sourceDocIds;
      let faqIds = sourceFaqIds;

      if (!docIds || docIds.length === 0) {
        const { data: allDocs } = await supabase.from("knowledge_documents").select("id");
        docIds = allDocs?.map(d => d.id) || [];
      }
      if (!faqIds || faqIds.length === 0) {
        const { data: allFaqs } = await supabase.from("knowledge_faqs").select("id");
        faqIds = allFaqs?.map(f => f.id) || [];
      }

      const { data: job, error: jobError } = await supabase
        .from("generation_jobs")
        .insert({
          job_type: "generate-module",
          status: "pending",
          input: {
            module_id: moduleId,
            module_title: title.trim(),
            source_document_ids: docIds,
            source_faq_ids: faqIds,
          },
        })
        .select()
        .single();

      if (jobError) throw jobError;

      const { error: fnError } = await supabase.functions.invoke("generate-module", {
        body: { job_id: job.id },
      });

      if (fnError) throw fnError;

      await loadModule();
      toast.success("Contenuto generato con successo!");
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Generazione fallita");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-28 px-4 sm:px-0">
      {/* Back link */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna alla collection
      </button>

      {/* Metadata badges inline */}
      <header className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={track} onValueChange={setTrack}>
            <SelectTrigger className="w-auto h-7 text-xs border-dashed gap-1 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sales">Vendite</SelectItem>
              <SelectItem value="CS">CS</SelectItem>
              <SelectItem value="Ops">Ops</SelectItem>
              <SelectItem value="General">Generale</SelectItem>
            </SelectContent>
          </Select>

          <Select value={curriculumId || "_none"} onValueChange={(v) => setCurriculumId(v === "_none" ? null : v)}>
            <SelectTrigger className="w-auto h-7 text-xs border-dashed gap-1 px-2">
              <SelectValue placeholder="Nessuna collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Nessuna collection</SelectItem>
              {collections.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-[10px] capitalize">
            {status}
          </Badge>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="text-xs gap-1.5"
          >
            <Eye className="h-3 w-3" />
            Vista New Klaaryan
          </Button>
        </div>

        {/* Inline title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo del modulo"
          className="w-full text-2xl sm:text-3xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
        />

        {/* Inline summary */}
        <textarea
          ref={summaryRef}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Aggiungi un sommario..."
          rows={1}
          className="w-full text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 text-sm leading-relaxed"
        />
      </header>

      {/* Separator */}
      <hr className="border-border" />

      {/* TipTap Canvas — the main content area */}
      <div className="space-y-2 relative">
        {moduleId && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || saving}
              className="text-xs gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {generating ? "Generazione..." : contentBody ? "Rigenera tutto" : "Genera con AI"}
            </Button>
          </div>
        )}

        {/* Generation progress overlay */}
        {generating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm rounded-lg">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-primary rounded-full animate-progress-indeterminate" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              {generationMessages[generatingStep]}
            </p>
          </div>
        )}

        <ModuleCanvas
          content={contentBody}
          onChange={setContentBody}
          disabled={generating}
          moduleTitle={title}
          moduleId={moduleId || undefined}
        />
      </div>

      {/* Separator */}
      <hr className="border-border" />

      {/* Key Points — collapsible */}
      <Collapsible open={keyPointsOpen} onOpenChange={setKeyPointsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full group">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${keyPointsOpen ? "" : "-rotate-90"}`} />
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Punti Chiave</span>
          {keyPoints.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{keyPoints.length}</Badge>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 text-xs"
            onClick={(e) => { e.stopPropagation(); addKeyPoint(); }}
          >
            <Plus className="h-3 w-3 mr-1" />Aggiungi
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2 pl-6">
          {keyPoints.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nessun punto chiave. Clicca "Aggiungi" per iniziare.</p>
          )}
          {keyPoints.map((kp, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-primary text-sm">•</span>
              <Input
                value={kp}
                onChange={(e) => updateKeyPoint(i, e.target.value)}
                placeholder={`Punto chiave ${i + 1}`}
                className="flex-1 h-8 text-sm border-transparent hover:border-input focus:border-input transition-colors bg-transparent"
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 hover:opacity-100 focus:opacity-100" onClick={() => removeKeyPoint(i)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Separator */}
      <hr className="border-border" />

      {/* Assessment Questions — collapsible */}
      <Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full group">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${questionsOpen ? "" : "-rotate-90"}`} />
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Domande di Valutazione</span>
          {questions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{questions.length}</Badge>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 text-xs"
            onClick={(e) => { e.stopPropagation(); addQuestion(); }}
          >
            <Plus className="h-3 w-3 mr-1" />Aggiungi
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 pl-6">
          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nessuna domanda. Clicca "Aggiungi" per iniziare.</p>
          )}
          {questions.map((q, qi) => (
            <div key={qi} className="border border-border/50 rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  <span className="font-mono">D{qi + 1}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(qi)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <Textarea
                value={q.question}
                onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                placeholder="Testo domanda"
                className="min-h-[40px] text-sm border-transparent hover:border-input focus:border-input bg-transparent resize-none"
              />

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Opzioni</Label>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_index === oi}
                      onChange={() => updateQuestion(qi, "correct_index", oi)}
                      className="accent-primary"
                    />
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Opzione ${oi + 1}`}
                      className="flex-1 h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Feedback corretto</Label>
                  <Input
                    value={q.feedback_correct}
                    onChange={(e) => updateQuestion(qi, "feedback_correct", e.target.value)}
                    placeholder="Perché è corretto"
                    className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Feedback errato</Label>
                  <Input
                    value={q.feedback_wrong}
                    onChange={(e) => updateQuestion(qi, "feedback_wrong", e.target.value)}
                    placeholder="Suggerimento verso la risposta"
                    className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
                  />
                </div>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-3 px-4 py-3">
          <Button variant="ghost" onClick={onClose} className="text-sm">
            Annulla
          </Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="text-sm gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Save className="h-3.5 w-3.5" />
            Salva bozza
          </Button>
          <Button onClick={() => handleSave("published")} disabled={saving} className="text-sm">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Pubblica
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Anteprima New Klaaryan</span>
            </div>
          </div>
          <ModulePreview
            title={title}
            summary={summary}
            track={track}
            contentBody={contentBody}
            keyPoints={keyPoints}
            questions={questions}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
