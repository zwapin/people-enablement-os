import { BookOpen, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function Learn() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

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
        <Button className="mt-2">
          <Plus className="h-4 w-4 mr-2" />
          Create module
        </Button>
      )}
    </div>
  );
}
