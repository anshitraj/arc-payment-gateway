import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { CodeBlock } from "@/components/CodeBlock";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ArrowRight, Clock, Shield, Zap, BarChart3, Wallet, CheckCircle2 } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useRef } from "react";

const stats = [
  { value: "<1s", label: "Settlement Time", icon: Clock },
  { value: "99.99%", label: "Uptime", icon: Shield },
  { value: "$0", label: "Gas in ETH", icon: Zap },
  { value: "100+", label: "API Endpoints", icon: BarChart3 },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const hasRedirected = useRef(false);

  // Safe redirect to dashboard after wallet connection (only on landing page)
  useEffect(() => {
    // Only redirect if:
    // 1. We're on the landing page (already true since we're in Landing component)
    // 2. Wallet is connected
    // 3. We haven't already redirected (prevent loops)
    // 4. We have an address
    if (isConnected && address && !hasRedirected.current) {
      hasRedirected.current = true;
      // Small delay to ensure wallet state is stable
      const timer = setTimeout(() => {
        setLocation("/dashboard");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, setLocation]);

  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      <Navbar />
      <Hero />
      <FeatureGrid />
      
      <section className="py-24 relative" data-testid="section-stats">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="bg-card/50 backdrop-blur-sm text-center">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight mb-1 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <CodeBlock />

      {/* RainbowKit Wallet Demo Section */}
      <section className="py-24 relative" data-testid="section-wallet-demo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Try it yourself
              <span className="block bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Connect your wallet
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience seamless wallet connection powered by RainbowKit. 
              Connect in seconds, pay with USDC on Arc Network.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardContent className="p-8">
                <WalletDemo />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <section className="py-24 relative" data-testid="section-dashboard-preview">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Powerful dashboard for
              <span className="block bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                complete visibility
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track payments, manage invoices, and monitor your treasury in real-time.
              Everything you need in one place.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-card rounded-2xl border border-border p-4 shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="bg-background/50">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Volume</div>
                    <div className="text-2xl font-bold">$124,523.00</div>
                    <div className="text-xs text-green-500 mt-1">+12.5% from last month</div>
                  </CardContent>
                </Card>
                <Card className="bg-background/50">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Transactions</div>
                    <div className="text-2xl font-bold">1,234</div>
                    <div className="text-xs text-green-500 mt-1">+8.2% from last month</div>
                  </CardContent>
                </Card>
                <Card className="bg-background/50">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Avg Settlement</div>
                    <div className="text-2xl font-bold">&lt;1s</div>
                    <div className="text-xs text-muted-foreground mt-1">Deterministic finality</div>
                  </CardContent>
                </Card>
              </div>
              <div className="h-48 bg-background/30 rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">Payment analytics chart</span>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </section>

      <section className="py-24 relative" data-testid="section-cta">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative bg-gradient-to-br from-primary/20 via-card to-card rounded-3xl border border-border p-8 sm:p-12 lg:p-16 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                Ready to accept
                <span className="block bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  stablecoin payments?
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Join forward-thinking businesses using ArcPayKit to accept USDC payments 
                with sub-second finality. No gas headaches. No volatility.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2" data-testid="cta-get-started">
                    Start Building
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button size="lg" variant="outline" data-testid="cta-contact">
                    View Documentation
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * Wallet Demo Component - Interactive RainbowKit demo
 * 
 * NOTE: This is for DEMO purposes only on the landing page.
 * It does NOT handle authentication or redirects.
 * Actual wallet connection for payments happens on /checkout/:id
 */
function WalletDemo() {
  const { address, isConnected, chain } = useAccount();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <ConnectButton.Custom>
          {({
            account,
            chain: connectedChain,
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
              connectedChain &&
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
                        size="lg"
                        className="w-full h-14 text-base"
                        data-testid="button-connect-wallet-demo"
                      >
                        <Wallet className="w-5 h-5 mr-2" />
                        Connect Wallet to Try
                      </Button>
                    );
                  }

                  if (connectedChain.unsupported) {
                    return (
                      <Button
                        onClick={openChainModal}
                        type="button"
                        variant="destructive"
                        size="lg"
                        className="w-full h-14 text-base"
                      >
                        Wrong network - Switch to ARC Testnet
                      </Button>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">Wallet Connected</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {account.displayName || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={openAccountModal}
                          variant="outline"
                          size="sm"
                        >
                          Manage
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-muted-foreground mb-1">Network</div>
                          <div className="font-medium">{connectedChain.name}</div>
                        </div>
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-muted-foreground mb-1">Chain ID</div>
                          <div className="font-medium font-mono">{connectedChain.id}</div>
                        </div>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-sm text-center text-muted-foreground">
                          🎉 Great! Your wallet is connected. Ready to make payments on Arc Network.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {isConnected && address && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-background/50 rounded-lg border border-border"
        >
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="font-medium mb-1">Ready to accept payments?</div>
              <p className="text-sm text-muted-foreground mb-3">
                Create a payment link and let customers pay with their wallets.
              </p>
              <Link href="/dashboard">
                <Button size="sm" variant="outline" className="gap-2">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
