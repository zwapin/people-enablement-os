import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profile && !profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3 p-8">
          <h2 className="text-xl font-semibold text-foreground">Account Deactivated</h2>
          <p className="text-muted-foreground">
            Your account has been deactivated. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
