import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold text-foreground">Klaaryo Academy</h1>
        {profile ? (
          <>
            <p className="text-muted-foreground">
              Bentornato, <span className="font-medium text-foreground">{profile.full_name || profile.email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Ruolo: <span className="capitalize font-medium text-foreground">{profile.role}</span>
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Caricamento profilo...</p>
        )}
        <Button variant="outline" onClick={signOut}>Esci</Button>
      </div>
    </div>
  );
}
