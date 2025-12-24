import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { WalletRoute } from "@/components/WalletRoute";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TestModeProvider } from "@/hooks/useTestMode";
import { LazyRainbowKitProvider } from "@/lib/LazyRainbowKitProvider";
import { Loader2 } from "lucide-react";

// Lazy load pages for code splitting and faster initial load
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Docs = lazy(() => import("@/pages/Docs"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardPayments = lazy(() => import("@/pages/DashboardPayments"));
const DashboardInvoices = lazy(() => import("@/pages/DashboardInvoices"));
const DashboardTreasury = lazy(() => import("@/pages/DashboardTreasury"));
const DashboardPaymentDetails = lazy(() => import("@/pages/DashboardPaymentDetails"));
const DashboardSettings = lazy(() => import("@/pages/DashboardSettings"));
const DashboardPaymentLinks = lazy(() => import("@/pages/DashboardPaymentLinks"));
const DashboardQRCodes = lazy(() => import("@/pages/DashboardQRCodes"));
const DashboardCustomers = lazy(() => import("@/pages/DashboardCustomers"));
const DashboardReports = lazy(() => import("@/pages/DashboardReports"));
const DashboardBridge = lazy(() => import("@/pages/DashboardBridge"));
const DashboardSubscriptions = lazy(() => import("@/pages/DashboardSubscriptions"));
const DashboardPayouts = lazy(() => import("@/pages/DashboardPayouts"));
const DashboardFees = lazy(() => import("@/pages/DashboardFees"));
const DashboardIntegrations = lazy(() => import("@/pages/DashboardIntegrations"));
const DevelopersAPIKeys = lazy(() => import("@/pages/DevelopersAPIKeys"));
const DashboardWebhooks = lazy(() => import("@/pages/DashboardWebhooks"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const QRPayment = lazy(() => import("@/pages/QRPayment"));
const PublicMerchant = lazy(() => import("@/pages/PublicMerchant"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ActivateBusiness = lazy(() => import("@/pages/ActivateBusiness"));

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/">
          <Suspense fallback={<PageLoader />}>
            <Landing />
          </Suspense>
        </Route>
        <Route path="/login">
          <WalletRoute>
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          </WalletRoute>
        </Route>
        <Route path="/pricing">
          <Suspense fallback={<PageLoader />}>
            <Pricing />
          </Suspense>
        </Route>
        <Route path="/docs">
          <Suspense fallback={<PageLoader />}>
            <Docs />
          </Suspense>
        </Route>
        <Route path="/dashboard">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/payment-links">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardPaymentLinks />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/qr-codes">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardQRCodes />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/transactions">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardPayments />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/payments">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardPayments />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/payments/:id">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardPaymentDetails />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/invoices">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardInvoices />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/subscriptions">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardSubscriptions />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/payouts">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardPayouts />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/fees">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardFees />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/integrations">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardIntegrations />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/customers">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardCustomers />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/treasury">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardTreasury />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/bridge">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardBridge />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/reports">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardReports />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/dashboard/settings">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardSettings />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/developers/api-keys">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DevelopersAPIKeys />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/developers/webhooks">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardWebhooks />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/developers/api-logs">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DashboardWebhooks />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route path="/pay/:id">
          <Suspense fallback={<PageLoader />}>
            <Checkout />
          </Suspense>
        </Route>
        <Route path="/checkout/:id">
          <Suspense fallback={<PageLoader />}>
            <Checkout />
          </Suspense>
        </Route>
        <Route path="/qr/:merchantId">
          <Suspense fallback={<PageLoader />}>
            <QRPayment />
          </Suspense>
        </Route>
        <Route path="/m/:wallet">
          <Suspense fallback={<PageLoader />}>
            <PublicMerchant />
          </Suspense>
        </Route>
        <Route path="/admin/login">
          <Suspense fallback={<PageLoader />}>
            <AdminLogin />
          </Suspense>
        </Route>
        <Route path="/admin/dashboard">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/merchants">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/payments">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/change-requests">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/config">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/blocklist">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/admin/logs">
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        </Route>
        <Route path="/activate">
          <WalletRoute>
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ActivateBusiness />
              </Suspense>
            </ProtectedRoute>
          </WalletRoute>
        </Route>
        <Route>
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  // Only initialize in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <LazyRainbowKitProvider>
      <TestModeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </TestModeProvider>
    </LazyRainbowKitProvider>
  );
}

export default App;
