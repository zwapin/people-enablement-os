import { TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Grow() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Nessun piano di onboarding</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {isAdmin
          ? "Crea un piano di onboarding 30-60-90 giorni per i membri del tuo team."
          : "Il tuo piano di onboarding apparirà qui quando il tuo admin lo configurerà."}
      </p>
    </div>
  );
}
