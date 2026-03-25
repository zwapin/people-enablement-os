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
import { Plus, FileText, Trash2, Loader2, Upload, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function DocumentsList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reExtracting, setReExtracting] = useState<string | null>(null);

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
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

      // Call extract-document edge function
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { file_path: fileName, file_name: file.name },
      });

      if (error) throw error;

      // Insert into knowledge_documents
      const { error: insertError } = await supabase
        .from("knowledge_documents")
        .insert({
          title: title.trim() || file.name,
          context: context.trim() || null,
          content: data?.content || "",
          file_path: fileName,
        });

      if (insertError) throw insertError;

      toast.success("Document uploaded and processed");
      setDialogOpen(false);
      setTitle("");
      setContext("");
      setFile(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleReExtract = async (id: string, filePath: string | null, fileName: string) => {
    if (!filePath) {
      toast.error("No file associated with this document");
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

      toast.success("Document re-extracted successfully");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to re-extract");
    } finally {
      setReExtracting(null);
    }
  };

  const handleDelete = async (id: string, filePath: string | null) => {
    if (!confirm("Delete this document?")) return;

    if (filePath) {
      await supabase.storage.from("knowledge-files").remove([filePath]);
    }
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Document deleted");
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
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>File (PDF, DOCX, or TXT — max 10MB)</Label>
                <Input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Custom title (defaults to file name)"
                />
              </div>
              <div className="space-y-2">
                <Label>Context (optional)</Label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe what this document covers, e.g. 'Q1 pricing playbook for enterprise deals'"
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? "Processing..." : "Upload & Extract"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!documents || documents.length === 0) ? (
        <Card className="p-8 text-center bg-card border-border">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No documents yet. Upload PDFs, DOCX, or TXT files to build your knowledge base.
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
                  {doc.content && !hasFailedContent && ` · ${doc.content.length.toLocaleString()} chars extracted`}
                  {hasFailedContent && <span className="text-destructive"> · extraction failed</span>}
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
                  Re-extract
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
          })}
        </div>
      )}
    </div>
  );
}
