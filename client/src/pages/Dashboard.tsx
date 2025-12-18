import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { KPICard } from "@/components/KPICard";
import { PaymentsTable } from "@/components/PaymentsTable";
import { CreatePaymentDialog } from "@/components/CreatePaymentDialog";
import { TestModeToggle } from "@/components/TestModeToggle";
import { GasPriceDisplay } from "@/components/GasPriceDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, DollarSign, Clock, TrendingUp, AlertCircle, Link2, Plus, Shield, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import type { Payment } from "@shared/schema";
import { useTestMode } from "@/hooks/useTestMode";
import { AlertTriangle } from "lucide-react";
import { Footer } from "@/components/Footer";

export default function Dashboard() {
  const { testMode } = useTestMode();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  // Filter payments by test mode
  const filteredPayments = payments.filter((p) => 
    p.isTest === testMode || p.isTest === undefined // Support legacy payments
  );

  // Calculate metrics
  const confirmedPayments = filteredPayments.filter((p) => p.status === "confirmed");
  const totalVolume = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  // Calculate average settlement time (from confirmed payments with settlementTime)
  const settlementTimes = confirmedPayments
    .filter((p) => p.settlementTime !== null && p.settlementTime !== undefined)
    .map((p) => p.settlementTime!);
  const avgSettlementTime = settlementTimes.length > 0
    ? Math.round(settlementTimes.reduce((sum, t) => sum + t, 0) / settlementTimes.length)
    : 0;
  
  // Format average settlement time - show <1s for Arc
  const formatAvgSettlement = () => {
    if (avgSettlementTime === 0) return "<1s";
    if (avgSettlementTime < 1) return "<1s";
    if (avgSettlementTime < 60) return `${avgSettlementTime}s`;
    if (avgSettlementTime < 3600) return `${Math.round(avgSettlementTime / 60)}m`;
    return `${Math.round(avgSettlementTime / 3600)}h`;
  };

  // Calculate month-over-month changes (mock for now, can be enhanced with date filtering)
  const lastMonthVolume = totalVolume * 0.875; // Mock: assume 12.5% increase
  const volumeChange = lastMonthVolume > 0 ? ((totalVolume - lastMonthVolume) / lastMonthVolume) * 100 : 0;
  
  const lastMonthCount = Math.round(filteredPayments.length * 0.918); // Mock: assume 8.2% increase
  const countChange = lastMonthCount > 0 ? ((filteredPayments.length - lastMonthCount) / lastMonthCount) * 100 : 0;
  
  const lastMonthSuccessRate = 95.0; // Mock baseline
  const currentSuccessRate = filteredPayments.length > 0 ? (confirmedPayments.length / filteredPayments.length) * 100 : 0;
  const successRateChange = lastMonthSuccessRate > 0 ? ((currentSuccessRate - lastMonthSuccessRate) / lastMonthSuccessRate) * 100 : 0;

  // Check verification status
  const { data: verificationStatus } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/badges/verification"],
    refetchInterval: 30000, // Refetch every 30s
    staleTime: 0, // Always consider data stale to force fresh checks
    cacheTime: 0, // Don't cache the result
  });

  const isVerified = verificationStatus?.verified ?? false;
  const hasPayments = filteredPayments.length > 0;

  // Check activation status
  const { data: activationStatus } = useQuery<{ activated: boolean }>({
    queryKey: ["/api/business/activation-status"],
    retry: false,
  });

  const style = {
    "--sidebar-width": "260px",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="page-dashboard">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-6 py-2.5 border-b border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0 h-12">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-6 w-6" />
              <div>
                <h1 className="text-base font-semibold leading-tight">Home</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GasPriceDisplay />
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs rounded-lg border-border/50 bg-background/50"
                  data-testid="input-search-payments"
                />
              </div>
              <TestModeToggle />
              <CreatePaymentDialog />
            </div>
          </header>

          {activationStatus && !activationStatus.activated && (
            <div className="bg-orange-500/10 border-b border-orange-500/20 text-orange-600 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  You're using test data. To accept payments, complete your business profile.
                </span>
              </div>
              <Link href="/activate">
                <Button variant="outline" size="sm" className="ml-4 h-7 text-xs border-orange-500/30">
                  Complete profile →
                </Button>
              </Link>
            </div>
          )}

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6 pb-8">
              {!isVerified && (
                <Alert variant="destructive" className="rounded-lg border-border/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold">Verification Required</AlertTitle>
                  <AlertDescription className="text-sm">
                    You must own a Verified Merchant Badge to create payments.{" "}
                    <Link href="/dashboard/settings" className="underline hover:no-underline">
                      Claim your badge in Settings
                    </Link>
                    {" "}to start accepting payments.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Total Volume"
                  value={`$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  change={volumeChange}
                  changeLabel="vs last month"
                  icon={DollarSign}
                  loading={isLoading}
                  isLast={false}
                />
                <KPICard
                  title="Transactions"
                  value={filteredPayments.length.toString()}
                  change={countChange}
                  changeLabel="vs last month"
                  icon={CreditCard}
                  loading={isLoading}
                  isLast={false}
                />
                <KPICard
                  title="Avg Settlement"
                  value={formatAvgSettlement()}
                  icon={Clock}
                  loading={isLoading}
                  isLast={false}
                />
                <KPICard
                  title="Success Rate"
                  value={filteredPayments.length > 0 ? `${currentSuccessRate.toFixed(1)}%` : "0%"}
                  change={successRateChange}
                  changeLabel="vs last month"
                  icon={TrendingUp}
                  loading={isLoading}
                  isLast={true}
                />
              </div>

              {!hasPayments && !isLoading ? (
                <div className="border border-border rounded-lg bg-card/30">
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-3">
                      <CreditCard className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold mb-1.5">Start collecting payments</h3>
                    <p className="text-muted-foreground text-center mb-5 max-w-md text-sm">
                      Create your first payment link or invoice to start accepting USDC payments on Arc Network.
                    </p>
                    <div className="flex gap-2.5">
                      <Button size="sm" onClick={() => setLocation("/dashboard/payment-links")} className="h-8">
                        <Link2 className="w-3.5 h-3.5 mr-1.5" />
                        Create payment link
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard/invoices")} className="h-8">
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Create invoice
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <PaymentsTable payments={filteredPayments.slice(0, 10)} loading={isLoading} search={search} />
              )}
              <Footer />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
