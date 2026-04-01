import { Home, BookOpen, TrendingUp, BarChart3, Users, LogOut, Settings, Eye, Layers, Building2, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation, AdminViewMode } from "@/contexts/ImpersonationContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import klaaryoLogo from "@/assets/klaaryo_logo_black.png";

const navItems = [
  { title: "Home", url: "/home", icon: Home, comingSoon: false },
  { title: "Formazione", url: "/learn", icon: BookOpen, comingSoon: false },
];

const adminItems = [
  { title: "Crescita", url: "/grow", icon: TrendingUp, comingSoon: false },
  { title: "Performance", url: "/perform", icon: BarChart3, comingSoon: true },
  { title: "Team", url: "/people", icon: Users, comingSoon: false },
  { title: "Impostazioni", url: "/settings", icon: Settings, comingSoon: false },
];

const viewModeItems: { mode: AdminViewMode; title: string; icon: typeof Layers }[] = [
  { mode: "all", title: "All Teams", icon: Layers },
  { mode: "myteam", title: "My View", icon: Building2 },
  { mode: "member", title: "Member View", icon: Eye },
];

function AppSidebarContent() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isAdmin = profile?.role === "admin";
  const {
    impersonating,
    isImpersonating,
    startImpersonating,
    stopImpersonating,
    repProfiles,
    adminViewMode,
    setAdminViewMode,
  } = useImpersonation();

  const allNavItems = isAdmin
    ? [...navItems, ...adminItems]
    : navItems;

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
              {allNavItems.map((item) => (
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

        {/* Admin View Mode selector */}
        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40">View Mode</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {viewModeItems.map((vm) => (
                  <SidebarMenuItem key={vm.mode}>
                    <SidebarMenuButton
                      onClick={() => setAdminViewMode(vm.mode)}
                      className={`flex items-center gap-3 px-3 py-2 rounded transition-colors duration-150 cursor-pointer ${
                        adminViewMode === vm.mode
                          ? "!text-sidebar-primary-foreground bg-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      <vm.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{vm.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Member selector dropdown */}
                {adminViewMode === "member" && !collapsed && (
                  <div className="px-3 pt-1">
                    <Select
                      value={impersonating?.user_id ?? ""}
                      onValueChange={(userId) => {
                        const p = repProfiles.find((r) => r.user_id === userId);
                        if (p) startImpersonating(p);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                        <SelectValue placeholder="Seleziona membro" />
                      </SelectTrigger>
                      <SelectContent>
                        {repProfiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
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
