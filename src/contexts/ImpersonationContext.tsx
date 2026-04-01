import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles"> & { departments?: string[]; member_type?: string };

export type AdminViewMode = "all" | "myteam" | "member";

interface ImpersonationContextType {
  impersonating: Profile | null;
  isImpersonating: boolean;
  startImpersonating: (profile: Profile) => void;
  stopImpersonating: () => void;
  repProfiles: Profile[];
  isLoadingProfiles: boolean;
  adminViewMode: AdminViewMode;
  setAdminViewMode: (mode: AdminViewMode) => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonating: null,
  isImpersonating: false,
  startImpersonating: () => {},
  stopImpersonating: () => {},
  repProfiles: [],
  isLoadingProfiles: false,
  adminViewMode: "all",
  setAdminViewMode: () => {},
});

export function useImpersonation() {
  return useContext(ImpersonationContext);
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [impersonating, setImpersonating] = useState<Profile | null>(() => {
    try {
      const stored = sessionStorage.getItem("impersonating");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [adminViewMode, setAdminViewModeState] = useState<AdminViewMode>(() => {
    try {
      const stored = sessionStorage.getItem("adminViewMode");
      return (stored as AdminViewMode) || "all";
    } catch {
      return "all";
    }
  });

  const setAdminViewMode = (mode: AdminViewMode) => {
    setAdminViewModeState(mode);
    sessionStorage.setItem("adminViewMode", mode);
    if (mode !== "member") {
      setImpersonating(null);
      sessionStorage.removeItem("impersonating");
    }
  };

  // Fetch rep profiles for the selector (admin only)
  const { data: repProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["impersonation-rep-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "rep")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  const startImpersonating = (p: Profile) => {
    setImpersonating(p);
    sessionStorage.setItem("impersonating", JSON.stringify(p));
    if (adminViewMode !== "member") {
      setAdminViewMode("member");
    }
  };

  const stopImpersonating = () => {
    setImpersonating(null);
    sessionStorage.removeItem("impersonating");
  };

  // Clear impersonation if user is not admin
  useEffect(() => {
    if (!isAdmin && impersonating) {
      stopImpersonating();
    }
  }, [isAdmin]);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonating,
        isImpersonating: adminViewMode === "member" && !!impersonating,
        startImpersonating,
        stopImpersonating,
        repProfiles,
        isLoadingProfiles,
        adminViewMode,
        setAdminViewMode,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}
