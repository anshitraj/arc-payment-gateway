import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getExplorerLink } from "@/lib/arc";
import type { Payment, Refund } from "@shared/schema";

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    created: { variant: "outline", label: "Created" },
    pending: { variant: "secondary", label: "Pending" },
    confirmed: { variant: "default", label: "Confirmed" },
    failed: { variant: "destructive", label: "Failed" },
    refunded: { variant: "outline", label: "Refunded" },
    expired: { variant: "destructive", label: "Expired" },
  };

  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function DashboardPaymentDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: payment, isLoading, refetch } = useQuery<Payment>({
    queryKey: [`/api/payments/${id}`],
    enabled: !!id,
  });

  const { data: refunds = [] } = useQuery<Refund[]>({
    queryKey: [`/api/payments/${id}/refunds`],
    enabled: !!id,
  });

  const refundMutation = useMutation({
    mutationFn: async (data: { amount: string; reason?: string }) => {
      return await apiRequest("POST", `/api/payments/${id}/refund`, data);
    },
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SidebarProvider>
    );
  }

  if (!payment) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Payment Not Found</h2>
              <Button onClick={() => setLocation("/dashboard/payments")} variant="outline">
                Back to Payments
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarProvider>
    );
  }

  const canRefund = payment.status === "confirmed" && !payment.isDemo;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard/payments")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Payment Details</h1>
                <p className="text-sm text-muted-foreground">Payment ID: {payment.id}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Payment Information</CardTitle>
                    {getStatusBadge(payment.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-lg font-semibold">
                        {parseFloat(payment.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {payment.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="text-lg">{payment.status}</p>
                    </div>
                    {payment.payerWallet && (
                      <div>
                        <p className="text-sm text-muted-foreground">Payer Wallet</p>
                        <p className="text-sm font-mono">{payment.payerWallet}</p>
                      </div>
                    )}
                    {payment.merchantWallet && (
                      <div>
                        <p className="text-sm text-muted-foreground">Merchant Wallet</p>
                        <p className="text-sm font-mono">{payment.merchantWallet}</p>
                      </div>
                    )}
                    {payment.txHash && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground mb-2">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono">{payment.txHash}</p>
                          <a
                            href={getExplorerLink(payment.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}
                    {payment.description && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="text-sm">{payment.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-sm">
                        {new Date(payment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {payment.settlementTime && (
                      <div>
                        <p className="text-sm text-muted-foreground">Settlement Time</p>
                        <p className="text-sm">{payment.settlementTime}s</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {canRefund && (
                <Card>
                  <CardHeader>
                    <CardTitle>Refund</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        refundMutation.mutate({
                          amount: formData.get("amount") as string,
                          reason: formData.get("reason") as string,
                        });
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="text-sm font-medium">Refund Amount</label>
                        <input
                          type="text"
                          name="amount"
                          defaultValue={payment.amount}
                          className="w-full mt-1 px-3 py-2 border rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Reason (optional)</label>
                        <textarea
                          name="reason"
                          className="w-full mt-1 px-3 py-2 border rounded-md"
                          rows={3}
                        />
                      </div>
                      <Button type="submit" disabled={refundMutation.isPending}>
                        {refundMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Create Refund"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {refunds.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Refunds</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {refunds.map((refund) => (
                        <div key={refund.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">
                              {parseFloat(refund.amount).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              {refund.currency}
                            </span>
                            <Badge>{refund.status}</Badge>
                          </div>
                          {refund.txHash && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm text-muted-foreground">Tx:</span>
                              <span className="text-sm font-mono">{refund.txHash}</span>
                              <a
                                href={getExplorerLink(refund.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                          {refund.reason && (
                            <p className="text-sm text-muted-foreground mt-2">{refund.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

