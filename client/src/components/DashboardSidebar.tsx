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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Wallet,
  Settings,
  LogOut,
  HelpCircle,
  Link2,
  Users,
  BarChart3,
  QrCode,
  Code2,
  Key,
  Webhook,
  FileText as FileTextIcon,
  Shield,
  ArrowLeftRight,
  Award,
  Repeat,
  ArrowDownToLine,
  Percent,
  Plug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import { useWalletProviderReady } from "@/lib/WalletProviderContext";
import { ConnectWalletButtonCustom } from "@/components/ConnectWalletButton";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Payment Links", icon: Link2, href: "/dashboard/payment-links" },
  { title: "QR Codes", icon: QrCode, href: "/dashboard/qr-codes" },
  { title: "Transactions", icon: CreditCard, href: "/dashboard/transactions" },
  { title: "Invoices", icon: FileText, href: "/dashboard/invoices" },
  { title: "Subscriptions", icon: Repeat, href: "/dashboard/subscriptions" },
  { title: "Payouts", icon: ArrowDownToLine, href: "/dashboard/payouts" },
  { title: "Customers", icon: Users, href: "/dashboard/customers" },
  { title: "Balances", icon: Wallet, href: "/dashboard/treasury" },
  { title: "Bridge (CCTP)", icon: ArrowLeftRight, href: "/dashboard/bridge" },
  { title: "Fees & Splits", icon: Percent, href: "/dashboard/fees" },
  { title: "Reports", icon: BarChart3, href: "/dashboard/reports" },
  { title: "Claim your badge", icon: Award, href: "/dashboard/settings#badge-claim" },
];

const developersNavItems = [
  { title: "API Keys", icon: Key, href: "/developers/api-keys" },
  { title: "Webhooks", icon: Webhook, href: "/developers/webhooks" },
  { title: "API Logs", icon: FileTextIcon, href: "/developers/api-logs" },
  { title: "Integrations", icon: Plug, href: "/dashboard/integrations" },
];

const settingsNavItems = [
  { title: "Settings", icon: Settings, href: "/dashboard/settings" },
  { title: "Help", icon: HelpCircle, href: "/docs" },
];

function UserProfile() {
  const { user, merchant } = useAuth();
  const { displayName, walletAddress, logoUrl } = useMerchantProfile();
  const [, setLocation] = useLocation();
  const { isReady: walletReady } = useWalletProviderReady();
  
  // Always call hooks unconditionally - they'll be safe once providers are ready
  // The WalletProviderContext ensures components only render when ready
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();

  // Check verification status
  const { data: verificationStatus } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/badges/verification"],
    refetchInterval: 30000, // Refetch every 30s
    staleTime: 0, // Always consider data stale to force fresh checks
    cacheTime: 0, // Don't cache the result
  });

  const isVerified = verificationStatus?.verified ?? false;

  const handleLogout = async () => {
    try {
      // Disconnect wallet first
      disconnect();
      
      // Clear all query cache to remove auth data
      queryClient.clear();
      
      // Call logout endpoint to destroy session
      await apiRequest("POST", "/api/auth/logout", {});
      
      // Set a flag in sessionStorage to prevent auto-login
      sessionStorage.setItem("logout", "true");
      
      // Redirect to login page
      setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, disconnect wallet and redirect
      disconnect();
      queryClient.clear();
      sessionStorage.setItem("logout", "true");
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
      <div className="flex items-center gap-2.5 mb-3">
        <Avatar className="w-8 h-8 rounded-md">
          <AvatarImage src={logoUrl || undefined} alt={displayName} />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium rounded-md">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {displayName}
            </p>
            {isVerified && (
              <Badge variant="outline" className="gap-1 h-4 px-1 text-xs border-sidebar-border/50">
                <Shield className="w-2.5 h-2.5" />
              </Badge>
            )}
          </div>
          {walletAddress && (
            <p className="text-xs text-sidebar-foreground/40 truncate font-mono">
              {walletAddress}
            </p>
          )}
        </div>
      </div>
      {/* Change Wallet Button */}
      <ConnectWalletButtonCustom>
        {({
          account,
          openConnectModal,
          mounted,
        }) => {
          if (!mounted) return null;
          
          const handleChangeWallet = async () => {
            try {
              // Disconnect current wallet first
              if (account) {
                disconnect();
              }
              
              // Clear session and query cache
              queryClient.clear();
              await apiRequest("POST", "/api/auth/logout", {});
              sessionStorage.setItem("logout", "true");
              
              // Small delay to ensure disconnect completes
              setTimeout(() => {
                // Redirect to login page where user can connect new wallet and sign in
                setLocation("/login");
              }, 200);
            } catch (error) {
              console.error("Change wallet error:", error);
              // Even on error, disconnect and redirect
              disconnect();
              queryClient.clear();
              sessionStorage.setItem("logout", "true");
              setLocation("/login");
            }
          };
          
          return (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 h-9 px-3 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-all duration-200"
              onClick={handleChangeWallet}
              data-testid="button-change-wallet"
            >
              <Wallet className="w-4 h-4" />
              <span className="font-medium">Change Wallet</span>
            </Button>
          );
        }}
      </ConnectWalletButtonCustom>

      <Button
        variant="ghost"
        className="w-full justify-start gap-2.5 h-9 px-3 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-all duration-200"
        onClick={handleLogout}
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4" />
        <span className="font-medium">Sign out</span>
      </Button>
    </>
  );
}

export function DashboardSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location === "/dashboard";
    }
    return location.startsWith(href);
  };

  return (
    <Sidebar 
      className="relative border-r border-white/5 group-data-[collapsible=offcanvas]:border-0" 
      collapsible="offcanvas"
      style={{
        background: `
          /* Arc-inspired gradient background matching dashboard */
          radial-gradient(ellipse at top left, rgba(15, 42, 68, 0.4) 0%, transparent 60%),
          linear-gradient(180deg, #0a1a2a 0%, #081726 50%, #050b14 100%)
        `
      }}
    >
      {/* Subtle Arc curve decoration - top-left sweep */}
      <svg 
        className="absolute top-0 left-0 w-full h-40 pointer-events-none opacity-[0.06] z-0"
        viewBox="0 0 260 160"
        preserveAspectRatio="none"
        style={{ mixBlendMode: 'screen' }}
      >
        <path 
          d="M 0 0 Q 130 50 260 0" 
          stroke="rgba(59, 130, 246, 0.4)" 
          fill="none" 
          strokeWidth="2"
        />
      </svg>
      
      {/* Subtle radial glow at top-left */}
      <div 
        className="absolute top-0 left-0 w-64 h-64 pointer-events-none opacity-[0.05] z-0"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
          mixBlendMode: 'screen'
        }}
      />
      
      {/* Subtle inner shadow for depth */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.03)'
        }}
      />
      
      <div className="relative z-10 flex flex-col h-full">
        <SidebarHeader 
          className="!flex !flex-row !items-center !justify-center px-0 py-0 !gap-0 border-b border-white/5"
          style={{ height: 'var(--app-header-height)' }}
        >
          <Link 
            href="/" 
            className="flex items-center justify-center w-full h-full transition-all duration-200 ease-in-out" 
            data-testid="sidebar-logo"
          >
            <img 
              src="/arcpay.webp" 
              alt="ArcPayKit" 
              className="h-7 w-auto block align-middle transition-all duration-200 ease-in-out" 
              style={{ verticalAlign: 'middle' }}
            />
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4 flex-1 overflow-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 mb-2 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            MENU
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`sidebar-${item.title.toLowerCase()}`}
                      className={cn(
                        "h-9 px-3 rounded-lg font-medium transition-all duration-200 relative group",
                        active
                          ? "text-sidebar-foreground bg-sidebar-accent/30 backdrop-blur-sm"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 hover:backdrop-blur-sm"
                      )}
                    >
                      <Link href={item.href} className="flex items-center gap-2.5 w-full">
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 transition-colors flex-shrink-0 stroke-[1.5]",
                            active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                          )}
                        />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 mb-2 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            DEVELOPERS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {developersNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`sidebar-${item.title.toLowerCase()}`}
                      className={cn(
                        "h-9 px-3 rounded-lg font-medium transition-all duration-200 relative group",
                        active
                          ? "text-sidebar-foreground bg-sidebar-accent/30 backdrop-blur-sm"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 hover:backdrop-blur-sm"
                      )}
                    >
                      <Link href={item.href} className="flex items-center gap-2.5 w-full">
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 transition-colors flex-shrink-0 stroke-[1.5]",
                            active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                          )}
                        />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 mb-2 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            SETTINGS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {settingsNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`sidebar-${item.title.toLowerCase()}`}
                      className={cn(
                        "h-9 px-3 rounded-lg font-medium transition-all duration-200 relative group",
                        active
                          ? "text-sidebar-foreground bg-sidebar-accent/30 backdrop-blur-sm"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 hover:backdrop-blur-sm"
                      )}
                    >
                      <Link href={item.href} className="flex items-center gap-2.5 w-full">
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "w-4 h-4 transition-colors flex-shrink-0 stroke-[1.5]",
                            active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                          )}
                        />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

        <SidebarFooter className="px-3 py-4 border-t border-white/5">
          <UserProfile />
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
