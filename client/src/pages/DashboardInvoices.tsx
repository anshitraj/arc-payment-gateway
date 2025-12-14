import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, FileText } from "lucide-react";
import type { Invoice } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const invoiceSchema = z.object({
  amount: z.string().min(1).refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  description: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  sent: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  paid: "bg-green-500/20 text-green-500 border-green-500/30",
  overdue: "bg-red-500/20 text-red-500 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function DashboardInvoices() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { amount: "", customerEmail: "", customerName: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Backend expects amount as string, not number
      return await apiRequest("POST", "/api/invoices", { 
        ...data, 
        amount: data.amount, // Keep as string
        currency: "USDC", // Add currency explicitly
      });
    },
    onSuccess: () => {
      toast({ title: "Invoice Created", description: "Invoice has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create invoice", 
        variant: "destructive" 
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/invoices/${id}/mark-paid`, {});
    },
    onSuccess: () => {
      toast({ title: "Invoice Paid", description: "Invoice marked as paid." });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const style = { "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="page-dashboard-invoices">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold">Invoices</h1>
                <p className="text-sm text-muted-foreground">Create and manage invoices</p>
              </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-invoice">
                  <Plus className="w-4 h-4" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invoice</DialogTitle>
                  <DialogDescription>Create a new invoice for your customer.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (USDC)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-invoice-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="customer@example.com" {...field} data-testid="input-invoice-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-invoice-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Invoice details..." {...field} data-testid="input-invoice-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-invoice">
                        {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Invoice
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>All Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No invoices yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                            <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              <div>{invoice.customerName || "-"}</div>
                              <div className="text-sm text-muted-foreground">{invoice.customerEmail}</div>
                            </TableCell>
                            <TableCell className="font-medium">
                              ${parseFloat(invoice.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {invoice.currency}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${statusColors[invoice.status]} capitalize`}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(invoice.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markPaidMutation.mutate(invoice.id)}
                                  disabled={markPaidMutation.isPending}
                                  data-testid={`mark-paid-${invoice.id}`}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
