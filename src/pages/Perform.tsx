import { BarChart3, Lock } from "lucide-react";

export default function Perform() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center relative">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <Lock className="h-3 w-3 text-muted-foreground absolute -bottom-0.5 -right-0.5" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Prossimamente</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Il monitoraggio delle performance e il coaching sulle chiamate saranno disponibili in un prossimo aggiornamento.
      </p>
    </div>
  );
}
