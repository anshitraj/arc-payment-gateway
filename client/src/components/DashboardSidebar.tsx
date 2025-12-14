import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Webhook,
  Wallet,
  Settings,
  Zap,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const mainNavItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Payments", icon: CreditCard, href: "/dashboard/payments" },
  { title: "Invoices", icon: FileText, href: "/dashboard/invoices" },
  { title: "Webhooks", icon: Webhook, href: "/dashboard/webhooks" },
  { title: "Treasury", icon: Wallet, href: "/dashboard/treasury" },
];

const settingsNavItems = [
  { title: "Settings", icon: Settings, href: "/dashboard/settings" },
  { title: "Help", icon: HelpCircle, href: "/docs" },
];

function UserProfile() {
  const { user, merchant } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setLocation("/login");
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {getInitials(user?.name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {merchant?.name || user?.name || "User"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email || "No email"}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2"
        onClick={handleLogout}
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </Button>
    </>
  );
}

export function DashboardSidebar() {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location === "/dashboard";
    }
    return location.startsWith(href);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2" data-testid="sidebar-logo">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">ArcPayKit</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    data-testid={`sidebar-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    data-testid={`sidebar-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
