import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Shield, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { lazy, Suspense } from "react";

const ConnectButton = lazy(async () => {
  const mod = await import("@rainbow-me/rainbowkit");
  return { default: mod.ConnectButton };
});
import { useAccount } from "wagmi";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const hasRedirected = useRef(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData | { address: string }) => {
      const response = await apiRequest("POST", "/api/admin/login", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "Welcome to the admin portal",
      });
      setLocation("/admin/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const walletLoginMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      return await apiRequest("POST", "/api/admin/login", { address: walletAddress });
    },
    onSuccess: () => {
      toast({
        title: "Wallet connected!",
        description: "You've been signed in successfully.",
      });
      setLocation("/admin/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Could not authenticate with wallet",
        variant: "destructive",
      });
    },
  });

  // Auto-authenticate when wallet connects
  useEffect(() => {
    const justLoggedOut = sessionStorage.getItem("admin_logout");
    if (justLoggedOut) {
      sessionStorage.removeItem("admin_logout");
      return;
    }
    
    if (isConnected && address && !hasRedirected.current) {
      hasRedirected.current = true;
      walletLoginMutation.mutate(address);
    }
  }, [isConnected, address]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Admin Portal</CardTitle>
          <CardDescription className="text-center">
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="wallet" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallet">
                <Wallet className="w-4 h-4 mr-2" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="email">
                <Shield className="w-4 h-4 mr-2" />
                Email
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="wallet" className="space-y-4 mt-4">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your admin wallet to sign in
                  </p>
                  <Suspense fallback={<div className="h-10 w-32 bg-muted animate-pulse rounded" />}>
                    <ConnectButton />
                  </Suspense>
                </div>
                {isConnected && address && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Connected: {address.slice(0, 6)}...{address.slice(-4)}</p>
                    {walletLoginMutation.isPending && (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Authenticating...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="email" className="space-y-4 mt-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="admin@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

