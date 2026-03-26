import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, X } from "lucide-react";

interface KBDocument {
  id: string;
  title: string;
  content: string;
  context: string | null;
}

interface AIGeneratePopoverProps {
  onInsert: (markdown: string) => void;
  onClose: () => void;
  moduleTitle?: string;
  moduleId?: string;
}

export default function AIGeneratePopover({ onInsert, onClose, moduleTitle, moduleId }: AIGeneratePopoverProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>("_none");
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data } = await supabase
      .from("knowledge_documents")
      .select("id, title, content, context")
      .order("title");
    if (data) setDocuments(data);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci un prompt per la generazione");
      return;
    }

    setGenerating(true);
    try {
      const selectedDoc = selectedDocId !== "_none"
        ? documents.find(d => d.id === selectedDocId)
        : null;

      // Build the text field with the prompt + module context
      const textParts = [
        `ISTRUZIONI: ${prompt.trim()}`,
        moduleTitle ? `\nModulo: "${moduleTitle}"` : "",
        "\nGenera SOLO il contenuto richiesto in markdown italiano, senza titolo del modulo, senza key_points, senza domande. Solo il contenuto testuale.",
      ];

      // We need at least 50 chars for the edge function
      let text = textParts.join("");
      if (text.length < 50) text = text.padEnd(50, " ");

      const knowledge_context = selectedDoc ? {
        documents: [{
          title: selectedDoc.title,
          context: selectedDoc.context || "",
          content: selectedDoc.content.substring(0, 20000),
        }],
        faqs: [],
      } : undefined;

      const { data, error } = await supabase.functions.invoke("generate-module", {
        body: {
          text,
          title_hint: moduleTitle || undefined,
          knowledge_context,
        },
      });

      if (error) throw error;

      // The direct mode returns a full module structure, we just use content_body
      const content = data?.content_body || data?.summary || "";
      if (!content) throw new Error("Nessun contenuto generato");

      onInsert(content);
      toast.success("Contenuto generato e inserito!");
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error(err.message || "Generazione fallita");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="absolute z-50 top-12 left-4 right-4 max-w-md rounded-lg border border-border bg-popover shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Genera con AI
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Cosa vuoi generare?</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Es: Scrivi la sezione sulla Discovery Call con focus sulle domande da fare..."
          className="min-h-[80px] text-sm"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Documento di riferimento (opzionale)</Label>
        <Select value={selectedDocId} onValueChange={setSelectedDocId}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Nessun documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nessun documento</SelectItem>
            {documents.map(doc => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={generating}>
          Annulla
        </Button>
        <Button size="sm" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
          {generating ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {generating ? "Generazione..." : "Genera"}
        </Button>
      </div>
    </div>
  );
}
