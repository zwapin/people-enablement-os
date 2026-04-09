import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FlowType = "recovery" | "invite" | null;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(false);
  const [flowType, setFlowType] = useState<FlowType>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValid(true);
      setFlowType("recovery");
    } else if (hash.includes("type=invite") || hash.includes("type=signup")) {
      setValid(true);
      setFlowType("invite");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    if (password.length < 6) {
      setError("La password deve essere di almeno 6 caratteri");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate(flowType === "invite" ? "/home" : "/learn", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Link non valido</h1>
          <p className="text-sm text-muted-foreground">
            Questo link non è valido o è scaduto.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Torna al login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {flowType === "invite" ? "Account attivato!" : "Password aggiornata"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Verrai reindirizzato automaticamente...
          </p>
        </div>
      </div>
    );
  }

  const isInvite = flowType === "invite";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isInvite ? "Benvenuto in Klaaryo Academy" : "Nuova password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isInvite ? "Imposta la tua password per accedere" : "Inserisci la tua nuova password"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{isInvite ? "Password" : "Nuova password"}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Conferma password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Aggiornamento..." : isInvite ? "Attiva account" : "Aggiorna password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
