import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Sparkles, Plus, Trash2, GripVertical, Save, FileText, HelpCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

type Module = Tables<"modules">;
type Question = Tables<"assessment_questions">;

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
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Module fields
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [track, setTrack] = useState("Sales");
  const [contentBody, setContentBody] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  // Questions
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  // Source text for AI generation
  const [sourceText, setSourceText] = useState("");

  // KB selection
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedFaqIds, setSelectedFaqIds] = useState<string[]>([]);

  const { data: kbDocs } = useQuery({
    queryKey: ["kb-docs-for-editor"],
    queryFn: async () => {
      const { data } = await supabase.from("knowledge_documents").select("id, title, context, content").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: kbFaqs } = useQuery({
    queryKey: ["kb-faqs-for-editor"],
    queryFn: async () => {
      const { data } = await supabase.from("knowledge_faqs").select("id, question, answer, category").order("created_at", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (moduleId) {
      loadModule();
    }
  }, [moduleId]);

  const loadModule = async () => {
    if (!moduleId) return;
    setLoading(true);

    const [modResult, qResult] = await Promise.all([
      supabase.from("modules").select("*").eq("id", moduleId).single(),
      supabase
        .from("assessment_questions")
        .select("*")
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true }),
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

  const handleGenerate = async () => {
    if (sourceText.trim().length < 50) {
      toast.error("Please provide at least 50 characters of source text.");
      return;
    }

    setGenerating(true);
    try {
      // Build KB context
      const knowledge_context: any = {};
      if (selectedDocIds.length > 0 && kbDocs) {
        knowledge_context.documents = kbDocs
          .filter((d) => selectedDocIds.includes(d.id))
          .map((d) => ({ title: d.title, context: d.context, content: d.content }));
      }
      if (selectedFaqIds.length > 0 && kbFaqs) {
        knowledge_context.faqs = kbFaqs
          .filter((f) => selectedFaqIds.includes(f.id))
          .map((f) => ({ question: f.question, answer: f.answer }));
      }

      const { data, error } = await supabase.functions.invoke("generate-module", {
        body: {
          text: sourceText,
          title_hint: title || undefined,
          knowledge_context: (knowledge_context.documents || knowledge_context.faqs) ? knowledge_context : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTitle(data.title || title);
      setSummary(data.summary || "");
      setKeyPoints(data.key_points || []);
      setContentBody(data.content_body || "");
      setQuestions(
        (data.questions || []).map((q: any) => ({
          question: q.question,
          options: q.options || ["", "", "", ""],
          correct_index: q.correct_index ?? 0,
          feedback_correct: q.feedback_correct || "",
          feedback_wrong: q.feedback_wrong || "",
        }))
      );

      toast.success("Module generated! Review and edit before saving.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate module");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (publishStatus?: "draft" | "published") => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    const finalStatus = publishStatus || status;

    try {
      let modId = moduleId;

      if (moduleId) {
        // Update existing
        const { error } = await supabase
          .from("modules")
          .update({
            title: title.trim(),
            summary: summary.trim() || null,
            track,
            content_body: contentBody.trim() || null,
            key_points: keyPoints as unknown as Json,
            status: finalStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", moduleId);
        if (error) throw error;
      } else {
        // Get next order_index
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
            status: finalStatus,
            order_index: nextOrder,
          })
          .select()
          .single();
        if (error) throw error;
        modId = newMod.id;
      }

      // Save questions — delete all existing, re-insert
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

          const { error: qError } = await supabase
            .from("assessment_questions")
            .insert(qRows);
          if (qError) throw qError;
        }
      }

      toast.success(`Module ${finalStatus === "published" ? "published" : "saved as draft"}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save module");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: "",
        options: ["", "", "", ""],
        correct_index: 0,
        feedback_correct: "",
        feedback_wrong: "",
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof QuestionForm, value: any) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === optIndex ? value : o)) }
          : q
      )
    );
  };

  const addKeyPoint = () => setKeyPoints([...keyPoints, ""]);
  const removeKeyPoint = (i: number) => setKeyPoints(keyPoints.filter((_, j) => j !== i));
  const updateKeyPoint = (i: number, val: string) =>
    setKeyPoints(keyPoints.map((kp, j) => (j === i ? val : kp)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          {moduleId ? "Edit Module" : "Create Module"}
        </h1>
      </div>

      {/* AI Generation Section */}
      {!moduleId && (
        <Card className="p-4 border-border bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">AI Generation</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste your source material (playbook, notes, PDF text) and AI will generate the module content and assessment questions.
          </p>
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your source material here (at least 50 characters)..."
            className="min-h-[120px]"
          />
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Generating..." : "Generate with AI"}
          </Button>
        </Card>
      )}

      {/* Module Details */}
      <Card className="p-4 border-border bg-card space-y-4">
        <h3 className="font-medium text-foreground">Module Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Module title" />
          </div>
          <div className="space-y-2">
            <Label>Track</Label>
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="Ops">Ops</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Summary</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief module overview"
            className="min-h-[60px]"
          />
        </div>

        {/* Key Points */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Key Points</Label>
            <Button variant="ghost" size="sm" onClick={addKeyPoint}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          {keyPoints.map((kp, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={kp}
                onChange={(e) => updateKeyPoint(i, e.target.value)}
                placeholder={`Key point ${i + 1}`}
              />
              <Button variant="ghost" size="icon" onClick={() => removeKeyPoint(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Content (Markdown)</Label>
          <Textarea
            value={contentBody}
            onChange={(e) => setContentBody(e.target.value)}
            placeholder="Full module content in markdown..."
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
      </Card>

      {/* Assessment Questions */}
      <Card className="p-4 border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            Assessment Questions
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {questions.length}
            </Badge>
          </h3>
          <Button variant="ghost" size="sm" onClick={addQuestion}>
            <Plus className="h-3 w-3 mr-1" />
            Add question
          </Button>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="border border-border rounded-md p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GripVertical className="h-3 w-3" />
                <span>Q{qi + 1}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(qi)}
                className="h-6 w-6 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <Textarea
              value={q.question}
              onChange={(e) => updateQuestion(qi, "question", e.target.value)}
              placeholder="Question text"
              className="min-h-[50px]"
            />

            <div className="space-y-2">
              <Label className="text-xs">Options (select the correct one)</Label>
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
                    placeholder={`Option ${oi + 1}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Correct feedback</Label>
                <Input
                  value={q.feedback_correct}
                  onChange={(e) => updateQuestion(qi, "feedback_correct", e.target.value)}
                  placeholder="Why this is correct"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wrong feedback</Label>
                <Input
                  value={q.feedback_wrong}
                  onChange={(e) => updateQuestion(qi, "feedback_wrong", e.target.value)}
                  placeholder="Hint toward correct answer"
                />
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save draft
        </Button>
        <Button onClick={() => handleSave("published")} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
