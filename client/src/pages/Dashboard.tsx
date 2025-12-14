import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { KPICard } from "@/components/KPICard";
import { PaymentsTable } from "@/components/PaymentsTable";
import { CreatePaymentDialog } from "@/components/CreatePaymentDialog";
import { CreditCard, DollarSign, Clock, TrendingUp } from "lucide-react";
import type { Payment } from "@shared/schema";

export default function Dashboard() {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const totalVolume = payments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const pendingPayments = payments.filter((p) => p.status === "pending");

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="page-dashboard">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div>
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Overview of your payment activity</p>
              </div>
            </div>
            <CreatePaymentDialog />
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Total Volume"
                  value={`$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  change={12.5}
                  changeLabel="vs last month"
                  icon={DollarSign}
                  loading={isLoading}
                />
                <KPICard
                  title="Transactions"
                  value={payments.length.toString()}
                  change={8.2}
                  changeLabel="vs last month"
                  icon={CreditCard}
                  loading={isLoading}
                />
                <KPICard
                  title="Avg Settlement"
                  value="<1s"
                  icon={Clock}
                  loading={isLoading}
                />
                <KPICard
                  title="Success Rate"
                  value={payments.length > 0 ? `${((confirmedPayments.length / payments.length) * 100).toFixed(1)}%` : "0%"}
                  change={2.1}
                  changeLabel="vs last month"
                  icon={TrendingUp}
                  loading={isLoading}
                />
              </div>

              <PaymentsTable payments={payments} loading={isLoading} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
