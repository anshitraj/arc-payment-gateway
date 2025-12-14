import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { WebhookSubscription, WebhookEvent } from "@shared/schema";

export default function DashboardWebhooks() {
  const { data: subscriptions = [], isLoading, refetch } = useQuery<WebhookSubscription[]>({
    queryKey: ["/api/webhooks/subscriptions"],
  });

  const { data: events = [] } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/webhooks/events"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/webhooks/subscriptions/${id}`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold">Webhooks</h1>
                <p className="text-sm text-muted-foreground">Manage webhook subscriptions and view events</p>
              </div>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Subscription
            </Button>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : subscriptions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No webhook subscriptions</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead>Events</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-mono text-sm">{sub.url}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {sub.events.map((event) => (
                                  <Badge key={event} variant="outline" className="text-xs">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={sub.active ? "default" : "secondary"}>
                                {sub.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(sub.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Events</CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No webhook events</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Attempts</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.slice(0, 50).map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <Badge variant="outline">{event.eventType}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  event.status === "delivered"
                                    ? "default"
                                    : event.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {event.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{event.attempts}</TableCell>
                            <TableCell>
                              {new Date(event.createdAt).toLocaleString()}
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
