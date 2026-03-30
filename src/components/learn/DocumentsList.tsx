import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Trash2, Loader2, Upload, RefreshCw, Eye, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [files, setFiles] = useState<File[]>([]);
  const [reExtracting, setReExtracting] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerContent, setViewerContent] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>("");
  const [viewerType, setViewerType] = useState<"pdf" | "text">("pdf");
  const [viewerOpen, setViewerOpen] = useState(false);

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
    if (files.length === 0) {
      toast.error("Seleziona almeno un file");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of files) {
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
            title: files.length === 1 && title.trim() ? title.trim() : file.name,
            context: context.trim() || null,
            content: data?.content || "",
            file_path: fileName,
          };
          if (collectionId) insertPayload.collection_id = collectionId;

          const { error: insertError } = await supabase
            .from("knowledge_documents")
            .insert(insertPayload);

          if (insertError) throw insertError;
          successCount++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success(`${successCount} documento/i caricato/i ed elaborato/i`);
      } else {
        toast.warning(`${successCount} caricati, ${failCount} falliti`);
      }

      setDialogOpen(false);
      setTitle("");
      setContext("");
      setFiles([]);
      refetch();
      onUploadComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Errore nel caricamento");
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

  const handleView = async (filePath: string | null, docTitle: string, docContent: string | null) => {
    if (!filePath) {
      toast.error("Nessun file associato");
      return;
    }
    const isPdf = filePath.toLowerCase().endsWith(".pdf") || filePath.includes(".pdf");
    setViewerTitle(docTitle);

    if (isPdf) {
      const { data, error } = await supabase.storage
        .from("knowledge-files")
        .createSignedUrl(filePath, 300);
      if (error || !data?.signedUrl) {
        toast.error("Impossibile generare il link");
        return;
      }
      setViewerUrl(data.signedUrl);
      setViewerContent(null);
      setViewerType("pdf");
    } else {
      // For DOCX/TXT, show the extracted text content
      setViewerUrl(null);
      setViewerContent(docContent || "Nessun contenuto estratto disponibile.");
      setViewerType("text");
    }
    setViewerOpen(true);
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
                  onClick={() => handleView(doc.file_path, doc.title, doc.content)}
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

      {/* Document viewer dialog */}
      <Dialog open={viewerOpen} onOpenChange={(open) => { setViewerOpen(open); if (!open) { setViewerUrl(null); setViewerContent(null); } }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{viewerTitle || "Visualizza documento"}</DialogTitle>
            <DialogDescription>Anteprima del documento caricato</DialogDescription>
          </DialogHeader>
          {viewerType === "pdf" && viewerUrl && (
            <iframe
              src={viewerUrl}
              className="w-full flex-1 border-0"
              title="Document viewer"
            />
          )}
          {viewerType === "text" && viewerContent && (
            <ScrollArea className="flex-1 px-6 pb-6">
              <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-mono">
                {viewerContent}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
