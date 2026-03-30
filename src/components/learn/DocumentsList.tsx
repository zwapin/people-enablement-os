import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Trash2, Loader2, Upload, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";

interface DocumentsListProps {
  collectionId?: string;
  onUploadComplete?: () => void;
}

export default function DocumentsList({ collectionId, onUploadComplete }: DocumentsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reExtracting, setReExtracting] = useState<string | null>(null);

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-documents", collectionId],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_documents")
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

  const handleUpload = async () => {
    if (!file) {
      toast.error("Seleziona un file");
      return;
    }

    setUploading(true);
    try {
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${sanitized}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { file_path: fileName, file_name: file.name },
      });

      if (error) throw error;

      const insertPayload: any = {
        title: title.trim() || file.name,
        context: context.trim() || null,
        content: data?.content || "",
        file_path: fileName,
      };
      if (collectionId) insertPayload.collection_id = collectionId;

      const { error: insertError } = await supabase
        .from("knowledge_documents")
        .insert(insertPayload);

      if (insertError) throw insertError;

      toast.success("Documento caricato ed elaborato");
      setDialogOpen(false);
      setTitle("");
      setContext("");
      setFile(null);
      refetch();
      onUploadComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Errore nel caricamento del documento");
    } finally {
      setUploading(false);
    }
  };

  const handleReExtract = async (id: string, filePath: string | null, fileName: string) => {
    if (!filePath) {
      toast.error("Nessun file associato a questo documento");
      return;
    }
    setReExtracting(id);
    try {
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { file_path: filePath, file_name: fileName },
      });
      if (error) throw error;

      const { error: updateError } = await supabase
        .from("knowledge_documents")
        .update({ content: data?.content || "" })
        .eq("id", id);
      if (updateError) throw updateError;

      toast.success("Documento ri-estratto con successo");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Errore nella ri-estrazione");
    } finally {
      setReExtracting(null);
    }
  };

  const handleView = async (filePath: string | null) => {
    if (!filePath) {
      toast.error("Nessun file associato");
      return;
    }
    const { data, error } = await supabase.storage
      .from("knowledge-files")
      .createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast.error("Impossibile generare il link");
      return;
    }
    // Use anchor element to avoid popup blockers in iframes
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (id: string, filePath: string | null) => {
    if (!confirm("Eliminare questo documento?")) return;

    if (filePath) {
      await supabase.storage.from("knowledge-files").remove([filePath]);
    }
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) {
      toast.error("Errore nell'eliminazione");
    } else {
      toast.success("Documento eliminato");
      refetch();
    }
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Carica documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carica Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>File (PDF, DOCX o TXT — max 10MB)</Label>
                <Input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Titolo (opzionale)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titolo personalizzato (default: nome file)"
                />
              </div>
              <div className="space-y-2">
                <Label>Contesto (opzionale)</Label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Descrivi il contenuto del documento, es. 'Playbook pricing Q1 per deal enterprise'"
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? "Elaborazione..." : "Carica ed Estrai"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!documents || documents.length === 0) ? (
        <Card className="p-8 text-center bg-card border-border">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nessun documento caricato. Carica PDF, DOCX o TXT per alimentare la generazione AI.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const hasFailedContent = !doc.content || doc.content.startsWith("[");
            return (
            <Card key={doc.id} className="flex items-center gap-4 p-4 bg-card border-border">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{doc.title}</h3>
                {doc.context && (
                  <p className="text-sm text-muted-foreground truncate">{doc.context}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(doc.created_at), "MMM d, yyyy")}
                  {doc.content && !hasFailedContent && ` · ${doc.content.length.toLocaleString()} caratteri estratti`}
                  {hasFailedContent && <span className="text-destructive"> · estrazione fallita</span>}
                </p>
              </div>
              {hasFailedContent && doc.file_path && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReExtract(doc.id, doc.file_path, doc.title)}
                  disabled={reExtracting === doc.id}
                  className="shrink-0"
                >
                  {reExtracting === doc.id ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Ri-estrai
                </Button>
              )}
              {doc.file_path && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleView(doc.file_path)}
                  title="Visualizza documento"
                  className="shrink-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(doc.id, doc.file_path)}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
