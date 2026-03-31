import { BookOpen, TrendingUp, BarChart3, Users, LogOut, UserCheck, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import klaaryoLogo from "@/assets/klaaryo_logo_black.png";

const navItems = [
  { title: "Formazione", url: "/learn", icon: BookOpen, comingSoon: false },
  { title: "Crescita", url: "/grow", icon: TrendingUp, comingSoon: false },
  { title: "Performance", url: "/perform", icon: BarChart3, comingSoon: true },
];

const adminItems = [
  { title: "Team", url: "/people", icon: Users, comingSoon: false },
];

function AppSidebarContent() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isAdmin = profile?.role === "admin";
  const { impersonating, isImpersonating, startImpersonating, stopImpersonating, repProfiles } = useImpersonation();
  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="px-4 py-5 flex items-center gap-2">
        {!collapsed ? (
          <img src={klaaryoLogo} alt="Klaaryo" className="h-6 w-auto brightness-0 invert" />
        ) : (
          <img src={klaaryoLogo} alt="Klaaryo" className="h-5 w-5 object-contain object-left brightness-0 invert" />
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      activeClassName="!text-sidebar-primary-foreground bg-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          {item.comingSoon && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 leading-tight opacity-60">Soon</Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        {isAdmin && !collapsed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="impersonation-toggle"
                checked={isImpersonating}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    stopImpersonating();
                  } else if (repProfiles.length > 0) {
                    startImpersonating(repProfiles[0]);
                  }
                }}
              />
              <Label htmlFor="impersonation-toggle" className="text-xs text-sidebar-foreground/70 cursor-pointer">
                New Klaaryan
              </Label>
            </div>
            {isImpersonating && (
              <Select
                value={impersonating?.user_id ?? ""}
                onValueChange={(userId) => {
                  const p = repProfiles.find((r) => r.user_id === userId);
                  if (p) startImpersonating(p);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                  <SelectValue placeholder="Seleziona utente" />
                </SelectTrigger>
                <SelectContent>
                  {repProfiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {isAdmin && collapsed && (
          <button
            onClick={() => {
              if (isImpersonating) stopImpersonating();
              else if (repProfiles.length > 0) startImpersonating(repProfiles[0]);
            }}
            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
              isImpersonating
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            }`}
            title="New Klaaryan"
          >
            <UserCheck className="h-4 w-4" />
          </button>
        )}
        {!collapsed && profile && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.full_name || profile.email}
            </p>
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase tracking-wider border-sidebar-border text-sidebar-muted"
            >
              {profile.role}
            </Badge>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors duration-150 w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Esci</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebarContent />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 shrink-0 bg-card">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
