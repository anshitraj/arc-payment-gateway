import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute - Session-based auth ONLY
 * 
 * RULE: NO wallet logic here. Wallet is ONLY for checkout payments.
 * This protects merchant dashboard routes using session cookies.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated (session-based, NOT wallet)
  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}

