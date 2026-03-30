import { TrendingUp, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Grow() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center relative">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
        <Lock className="h-3 w-3 text-muted-foreground absolute -bottom-0.5 -right-0.5" />
      </div>
      <Badge variant="outline" className="text-xs">Coming Soon</Badge>
      <h2 className="text-lg font-semibold text-foreground">Onboarding 30-60-90</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        I piani di onboarding personalizzati per ogni membro del team saranno disponibili in un prossimo aggiornamento.
      </p>
    </div>
  );
}
