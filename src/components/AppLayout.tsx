import { BookOpen, TrendingUp, BarChart3, Users, LogOut, Database } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
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

const navItems = [
  { title: "Learn", url: "/learn", icon: BookOpen },
  { title: "Grow", url: "/grow", icon: TrendingUp },
  { title: "Perform", url: "/perform", icon: BarChart3 },
];

const adminItems = [
  { title: "People", url: "/people", icon: Users },
  { title: "Knowledge Base", url: "/knowledge", icon: Database },
];

function AppSidebarContent() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isAdmin = profile?.role === "admin";
  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="px-4 py-5 flex items-center gap-2">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-foreground">
            Klaaryo
          </span>
        )}
        {collapsed && (
          <span className="text-lg font-bold text-foreground">K</span>
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
                      className="flex items-center gap-3 px-3 py-2 rounded text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-accent"
                      activeClassName="!text-primary bg-accent"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 space-y-1">
            <p className="text-sm font-medium text-foreground truncate">
              {profile.full_name || profile.email}
            </p>
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase tracking-wider border-border text-muted-foreground"
            >
              {profile.role}
            </Badge>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
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
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
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
