import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthMerchant {
  id: string;
  name: string;
  apiKey: string;
}

export interface AuthData {
  user: AuthUser;
  merchant: AuthMerchant | null;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/pricing", "/docs"];

function isPublicRoute(path: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }
  // Check checkout routes
  if (path.startsWith("/checkout/")) {
    return true;
  }
  return false;
}

export function useAuth() {
  const [location, setLocation] = useLocation();
  
  // Check if current route is public - use window.location as fallback
  const currentPath = location || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const isPublic = isPublicRoute(currentPath);
  
  // Always call useQuery (React hooks rule), but disable it for public routes
  const { data, isLoading, error } = useQuery<AuthData>({
    queryKey: ["/api/auth/me"],
    retry: false,
    // Only run auth check on protected routes (not public pages)
    enabled: !isPublic && typeof window !== 'undefined',
    onError: () => {
      // Only redirect if we're on a protected route (not public pages)
      // Use window.location.pathname as the source of truth to avoid timing issues
      if (typeof window === 'undefined') return;
      
      const actualPath = window.location.pathname;
      const isPublicCheck = isPublicRoute(actualPath);
      
      // NEVER redirect from public routes
      if (!isPublicCheck && actualPath !== '/login') {
        requestAnimationFrame(() => {
          try {
            setLocation("/login");
          } catch (err) {
            // Fallback to window.location if wouter navigation fails
            if (err instanceof DOMException) {
              window.location.href = "/login";
            } else {
              // For any other error, still try window.location
              window.location.href = "/login";
            }
          }
        });
      }
    },
  });

  // For public routes, return early values without waiting for query
  if (isPublic) {
    return {
      user: undefined,
      merchant: undefined,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    };
  }

  return {
    user: data?.user,
    merchant: data?.merchant,
    isLoading,
    isAuthenticated: !!data,
    error,
  };
}

