import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function People() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">No team members yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Invite your first rep to get started with onboarding.
      </p>
      <Button className="mt-2">
        <Plus className="h-4 w-4 mr-2" />
        Invite a rep
      </Button>
    </div>
  );
}
