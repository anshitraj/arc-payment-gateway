import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Merchant } from "@shared/schema";

export default function DashboardSettings() {
  const [copied, setCopied] = useState<string | null>(null);
  const { data: merchant, isLoading } = useQuery<Merchant>({
    queryKey: ["/api/merchants"],
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your merchant account settings</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={merchant?.apiKey || ""}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => merchant?.apiKey && copyToClipboard(merchant.apiKey, "apiKey")}
                      >
                        {copied === "apiKey" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use this API key to authenticate API requests
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wallet Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Merchant Wallet Address</Label>
                    <Input
                      value={merchant?.walletAddress || ""}
                      placeholder="0x..."
                      className="font-mono text-sm mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Your wallet address for receiving payments
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

