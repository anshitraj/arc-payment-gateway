import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import type { Payment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getExplorerLink } from "@/lib/arc";

interface PaymentsTableProps {
  payments: Payment[];
  loading?: boolean;
  onRefund?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  created: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  confirmed: "bg-green-500/20 text-green-500 border-green-500/30",
  failed: "bg-red-500/20 text-red-500 border-red-500/30",
  refunded: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  expired: "bg-red-500/20 text-red-500 border-red-500/30",
};

export function PaymentsTable({ payments, loading, onRefund }: PaymentsTableProps) {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const filteredPayments = payments.filter((payment) =>
    payment.id.toLowerCase().includes(search.toLowerCase()) ||
    payment.description?.toLowerCase().includes(search.toLowerCase()) ||
    payment.customerEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const formatAmount = (amount: string, currency: string) => {
    return `${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>Recent Payments</CardTitle>
          <div className="w-64 h-9 rounded-md bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-24 h-4 rounded bg-muted animate-pulse" />
                <div className="flex-1 h-4 rounded bg-muted animate-pulse" />
                <div className="w-20 h-6 rounded-full bg-muted animate-pulse" />
                <div className="w-24 h-4 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm" data-testid="payments-table">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle>Recent Payments</CardTitle>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-payments"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Settlement</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    data-testid={`payment-row-${payment.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/dashboard/payments/${payment.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(payment.id, "Payment ID");
                        }}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                        data-testid={`copy-id-${payment.id}`}
                      >
                        {payment.id.slice(0, 8)}...
                        <Copy className="w-3 h-3 opacity-50" />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusColors[payment.status]} capitalize`}
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.customerEmail || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell>
                      {payment.status === "confirmed" && payment.updatedAt ? (
                        <span className="text-green-500 text-sm">
                          {new Date(payment.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : payment.settlementTime ? (
                        <span className="text-green-500 text-sm">{payment.settlementTime}s</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`menu-${payment.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(payment.id, "Payment ID")}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy ID
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/dashboard/payments/${payment.id}`);
                            }}
                          >
                            View Details
                          </DropdownMenuItem>
                          {payment.txHash && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(getExplorerLink(payment.txHash!), "_blank");
                              }}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View on Explorer
                            </DropdownMenuItem>
                          )}
                          {payment.status === "confirmed" && onRefund && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onRefund(payment.id);
                              }}
                              className="text-destructive"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Refund
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
