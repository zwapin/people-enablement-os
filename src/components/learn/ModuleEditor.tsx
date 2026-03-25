import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, Trash2, GripVertical, Save, Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

type Module = Tables<"modules">;

interface QuestionForm {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  feedback_correct: string;
  feedback_wrong: string;
}

interface ModuleEditorProps {
  moduleId: string | null;
  onClose: () => void;
}

export default function ModuleEditor({ moduleId, onClose }: ModuleEditorProps) {
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
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Modifica Modulo</h1>
      </div>

      <Card className="p-4 border-border bg-card space-y-4">
        <h3 className="font-medium text-foreground">Dettagli Modulo</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo del modulo" />
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Vendite</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="Ops">Ops</SelectItem>
                <SelectItem value="General">Generale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sommario</Label>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Panoramica breve" className="min-h-[60px]" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Punti chiave</Label>
            <Button variant="ghost" size="sm" onClick={addKeyPoint}>
              <Plus className="h-3 w-3 mr-1" />Aggiungi
            </Button>
          </div>
          {keyPoints.map((kp, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={kp} onChange={(e) => updateKeyPoint(i, e.target.value)} placeholder={`Punto chiave ${i + 1}`} />
              <Button variant="ghost" size="icon" onClick={() => removeKeyPoint(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Contenuto (Markdown)</Label>
          <Textarea value={contentBody} onChange={(e) => setContentBody(e.target.value)} placeholder="Contenuto completo del modulo..." className="min-h-[200px] font-mono text-sm" />
        </div>
      </Card>

      <Card className="p-4 border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            Domande di Valutazione
            <Badge variant="secondary" className="ml-2 text-[10px]">{questions.length}</Badge>
          </h3>
          <Button variant="ghost" size="sm" onClick={addQuestion}>
            <Plus className="h-3 w-3 mr-1" />Aggiungi
          </Button>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="border border-border rounded-md p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GripVertical className="h-3 w-3" />
                <span>D{qi + 1}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(qi)} className="h-6 w-6 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <Textarea value={q.question} onChange={(e) => updateQuestion(qi, "question", e.target.value)} placeholder="Testo domanda" className="min-h-[50px]" />

            <div className="space-y-2">
              <Label className="text-xs">Opzioni (seleziona la corretta)</Label>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi} onChange={() => updateQuestion(qi, "correct_index", oi)} className="accent-primary" />
                  <Input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Opzione ${oi + 1}`} className="flex-1" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Feedback corretto</Label>
                <Input value={q.feedback_correct} onChange={(e) => updateQuestion(qi, "feedback_correct", e.target.value)} placeholder="Perché è corretto" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Feedback errato</Label>
                <Input value={q.feedback_wrong} onChange={(e) => updateQuestion(qi, "feedback_wrong", e.target.value)} placeholder="Suggerimento verso la risposta" />
              </div>
            </div>
          </div>
        ))}
      </Card>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />Salva bozza
        </Button>
        <Button onClick={() => handleSave("published")} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Pubblica
        </Button>
      </div>
    </div>
  );
}
