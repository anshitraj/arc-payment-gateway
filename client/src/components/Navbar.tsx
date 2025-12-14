import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X, Zap, CreditCard, Shield, Code2, BookOpen, Webhook, BarChart3, Wallet } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';

const productItems = [
  { title: "Payments", description: "Accept stablecoin payments instantly", icon: CreditCard, href: "/dashboard" },
  { title: "Invoicing", description: "Create and send invoices in USDC", icon: BarChart3, href: "/dashboard" },
  { title: "Webhooks", description: "Real-time payment notifications", icon: Webhook, href: "/dashboard" },
];

const developerItems = [
  { title: "Documentation", description: "Integration guides and API reference", icon: BookOpen, href: "/docs" },
  { title: "API Reference", description: "RESTful API documentation", icon: Code2, href: "/docs" },
  { title: "SDKs", description: "Client libraries for popular languages", icon: Zap, href: "/docs" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isLanding = location === "/";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "py-3 bg-background/80 backdrop-blur-xl border-b border-border"
          : "py-5 bg-transparent"
      }`}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">ArcPayKit</span>
          </Link>

          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent" data-testid="nav-product">
                  Product
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4">
                    {productItems.map((item) => (
                      <li key={item.title}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className="flex items-start gap-3 p-3 rounded-lg hover-elevate"
                            data-testid={`link-${item.title.toLowerCase()}`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{item.title}</div>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent" data-testid="nav-developers">
                  Developers
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4">
                    {developerItems.map((item) => (
                      <li key={item.title}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className="flex items-start gap-3 p-3 rounded-lg hover-elevate"
                            data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{item.title}</div>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">
                    Pricing
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="hidden lg:flex items-center gap-3">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated');

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <Button
                            onClick={openConnectModal}
                            type="button"
                            variant="outline"
                            className="gap-2"
                            data-testid="button-connect-wallet-nav"
                          >
                            <Wallet className="w-4 h-4" />
                            Connect Wallet
                          </Button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <Button
                            onClick={openChainModal}
                            type="button"
                            variant="destructive"
                            size="sm"
                            data-testid="button-wrong-network"
                          >
                            Wrong Network
                          </Button>
                        );
                      }

                      return (
                        <Button
                          onClick={openAccountModal}
                          type="button"
                          variant="outline"
                          className="gap-2"
                          data-testid="button-wallet-connected"
                        >
                          <Wallet className="w-4 h-4" />
                          {account.displayName || `${account.address.slice(0, 4)}...${account.address.slice(-4)}`}
                        </Button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
            <Button asChild data-testid="button-dashboard">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">ArcPayKit</span>
                  </div>
                </div>
                <nav className="flex-1 p-6 space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product</h3>
                    <div className="space-y-2">
                      {productItems.map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                          data-testid={`mobile-link-${item.title.toLowerCase()}`}
                        >
                          <item.icon className="w-5 h-5 text-primary" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Developers</h3>
                    <div className="space-y-2">
                      {developerItems.map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                          data-testid={`mobile-link-${item.title.toLowerCase().replace(" ", "-")}`}
                        >
                          <item.icon className="w-5 h-5 text-primary" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/pricing"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                    data-testid="mobile-link-pricing"
                  >
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium">Pricing</span>
                  </Link>
                </nav>
                <div className="p-6 border-t border-border space-y-3">
                  <ConnectButton.Custom>
                    {({
                      account,
                      chain,
                      openAccountModal,
                      openChainModal,
                      openConnectModal,
                      authenticationStatus,
                      mounted,
                    }) => {
                      const ready = mounted && authenticationStatus !== 'loading';
                      const connected =
                        ready &&
                        account &&
                        chain &&
                        (!authenticationStatus ||
                          authenticationStatus === 'authenticated');

                      return (
                        <div
                          {...(!ready && {
                            'aria-hidden': true,
                            'style': {
                              opacity: 0,
                              pointerEvents: 'none',
                              userSelect: 'none',
                            },
                          })}
                          className="w-full"
                        >
                          {(() => {
                            if (!connected) {
                              return (
                                <Button
                                  onClick={openConnectModal}
                                  type="button"
                                  variant="outline"
                                  className="w-full gap-2"
                                  data-testid="mobile-button-connect-wallet"
                                >
                                  <Wallet className="w-4 h-4" />
                                  Connect Wallet
                                </Button>
                              );
                            }

                            if (chain.unsupported) {
                              return (
                                <Button
                                  onClick={openChainModal}
                                  type="button"
                                  variant="destructive"
                                  className="w-full"
                                  data-testid="mobile-button-wrong-network"
                                >
                                  Wrong Network
                                </Button>
                              );
                            }

                            return (
                              <Button
                                onClick={openAccountModal}
                                type="button"
                                variant="outline"
                                className="w-full gap-2"
                                data-testid="mobile-button-wallet-connected"
                              >
                                <Wallet className="w-4 h-4" />
                                {account.displayName || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                              </Button>
                            );
                          })()}
                        </div>
                      );
                    }}
                  </ConnectButton.Custom>
                  <Button className="w-full" asChild data-testid="mobile-button-dashboard">
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
