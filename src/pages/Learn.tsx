import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import ModuleList from "@/components/learn/ModuleList";
import ModuleEditor from "@/components/learn/ModuleEditor";
import KnowledgeBase from "@/components/learn/KnowledgeBase";

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

  // Non-admin view: just show modules
  if (!isAdmin) {
    if (!hasModules && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No modules yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your curriculum will appear here once your admin publishes modules.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">Your training curriculum.</p>
        </div>
        <ModuleList
          modules={modules ?? []}
          isAdmin={false}
          onEdit={() => {}}
          onRefresh={() => refetch()}
        />
      </div>
    );
  }

  // Admin view: tabs for Modules + Knowledge Base
  return (
    <Tabs defaultValue="modules" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="modules" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Learn</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage training modules for your team.
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create module
          </Button>
        </div>

        {!hasModules && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No modules yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first training module to get your team started.
            </p>
          </div>
        ) : (
          <ModuleList
            modules={modules ?? []}
            isAdmin={true}
            onEdit={handleEdit}
            onRefresh={() => refetch()}
          />
        )}
      </TabsContent>

      <TabsContent value="knowledge">
        <KnowledgeBase />
      </TabsContent>
    </Tabs>
  );
}
