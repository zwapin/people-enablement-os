import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PeopleTable from "@/components/people/PeopleTable";
import InviteDialog from "@/components/people/InviteDialog";
import { Loader2 } from "lucide-react";

export default function People() {
  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">People</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members and invite new reps.
          </p>
        </div>
        <InviteDialog onInvited={() => refetch()} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PeopleTable profiles={profiles ?? []} onRefresh={() => refetch()} />
      )}
    </div>
  );
}
