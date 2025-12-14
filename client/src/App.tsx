import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './lib/rainbowkit';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import '@rainbow-me/rainbowkit/styles.css';
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import DashboardPayments from "@/pages/DashboardPayments";
import DashboardInvoices from "@/pages/DashboardInvoices";
import DashboardWebhooks from "@/pages/DashboardWebhooks";
import DashboardTreasury from "@/pages/DashboardTreasury";
import DashboardPaymentDetails from "@/pages/DashboardPaymentDetails";
import DashboardSettings from "@/pages/DashboardSettings";
import Checkout from "@/pages/Checkout";
import Pricing from "@/pages/Pricing";
import Docs from "@/pages/Docs";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/checkout/:id" component={Checkout} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/docs" component={Docs} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/payments">
        <ProtectedRoute>
          <DashboardPayments />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/payments/:id">
        <ProtectedRoute>
          <DashboardPaymentDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/invoices">
        <ProtectedRoute>
          <DashboardInvoices />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/webhooks">
        <ProtectedRoute>
          <DashboardWebhooks />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/treasury">
        <ProtectedRoute>
          <DashboardTreasury />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/settings">
        <ProtectedRoute>
          <DashboardSettings />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Only initialize RainbowKit in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
