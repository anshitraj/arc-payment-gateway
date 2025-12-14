import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { PaymentsTable } from "@/components/PaymentsTable";
import { CreatePaymentDialog } from "@/components/CreatePaymentDialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLocation } from "wouter";
import type { Payment } from "@shared/schema";
import { exportPaymentsToCSV } from "@/lib/csvExport";

export default function DashboardPayments() {
  const [, setLocation] = useLocation();
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const handleExportCSV = () => {
    exportPaymentsToCSV(payments);
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="page-dashboard-payments">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div>
                <h1 className="text-xl font-semibold">Payments</h1>
                <p className="text-sm text-muted-foreground">Manage all your payment transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <CreatePaymentDialog />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <PaymentsTable payments={payments} loading={isLoading} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
