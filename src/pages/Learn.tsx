import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import ModuleList from "@/components/learn/ModuleList";
import ModuleEditor from "@/components/learn/ModuleEditor";

export default function Learn() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const { data: modules, isLoading, refetch } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleCreateNew = () => {
    setEditingModuleId(null);
    setEditorOpen(true);
  };

  const handleEdit = (moduleId: string) => {
    setEditingModuleId(moduleId);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingModuleId(null);
    refetch();
  };

  if (editorOpen) {
    return (
      <ModuleEditor
        moduleId={editingModuleId}
        onClose={handleEditorClose}
      />
    );
  }

  const hasModules = modules && modules.length > 0;

  if (!hasModules && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No modules yet</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isAdmin
            ? "Create your first training module to get your team started."
            : "Your curriculum will appear here once your admin publishes modules."}
        </p>
        {isAdmin && (
          <Button className="mt-2" onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create module
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Manage training modules for your team." : "Your training curriculum."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create module
          </Button>
        )}
      </div>
      <ModuleList
        modules={modules ?? []}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onRefresh={() => refetch()}
      />
    </div>
  );
}
