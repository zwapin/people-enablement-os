import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, HelpCircle, Trash2, Pencil, Loader2, X, Check } from "lucide-react";

interface FaqForm {
  question: string;
  answer: string;
  category: string;
}

const emptyForm: FaqForm = { question: "", answer: "", category: "" };

interface FaqListProps {
  collectionId?: string;
}

export default function FaqList({ collectionId }: FaqListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: faqs, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-faqs", collectionId],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_faqs")
        .select("*")
        .order("created_at", { ascending: false });
      if (collectionId) {
        query = query.eq("collection_id", collectionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Domanda e risposta sono obbligatorie");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category.trim() || null,
      };
      if (collectionId) payload.collection_id = collectionId;

      if (editingId) {
        const { error } = await supabase
          .from("knowledge_faqs")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("FAQ aggiornata");
      } else {
        const { error } = await supabase
          .from("knowledge_faqs")
          .insert(payload);
        if (error) throw error;
        toast.success("FAQ creata");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Errore nel salvataggio della FAQ");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (faq: any) => {
    setEditingId(faq.id);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category || "" });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa FAQ?")) return;
    const { error } = await supabase.from("knowledge_faqs").delete().eq("id", id);
    if (error) {
      toast.error("Errore nell'eliminazione");
    } else {
      toast.success("FAQ eliminata");
      refetch();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi FAQ
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 bg-card border-border space-y-3">
          <h3 className="font-medium text-foreground">
            {editingId ? "Modifica FAQ" : "Nuova FAQ"}
          </h3>
          <div className="space-y-2">
            <Label>Domanda</Label>
            <Input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="Es. Qual è la nostra politica di reso?"
            />
          </div>
          <div className="space-y-2">
            <Label>Risposta</Label>
            <Textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="La risposta dettagliata..."
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria (opzionale)</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Es. Pricing, Prodotto, Processo"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel} size="sm">
              <X className="h-3 w-3 mr-1" />
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              {editingId ? "Aggiorna" : "Salva"}
            </Button>
          </div>
        </Card>
      )}

      {(!faqs || faqs.length === 0) && !showForm ? (
        <Card className="p-8 text-center bg-card border-border">
          <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nessuna FAQ presente. Crea coppie domanda/risposta per arricchire i moduli generati dall'AI.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(faqs || []).map((faq) => (
            <Card key={faq.id} className="p-4 bg-card border-border space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{faq.question}</h3>
                    {faq.category && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {faq.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(faq)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(faq.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
