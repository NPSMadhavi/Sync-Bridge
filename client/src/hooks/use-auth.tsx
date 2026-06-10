import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Login validation schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type AuthContextType = {
  user: Omit<User, "password"> | null;
  tenantId: number | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<User, "password">, Error, z.infer<typeof loginSchema>>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

type LoginData = z.infer<typeof loginSchema>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<Omit<User, "password"> | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Get tenant ID from user or localStorage
  const tenantId = user?.tenantId || (localStorage.getItem("tenantId") ? parseInt(localStorage.getItem("tenantId")!) : null);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const user = await res.json();
      
      // Store tenant ID in local storage if available
      if (user.tenantId) {
        localStorage.setItem("tenantId", user.tenantId.toString());
        console.log('Auth: Stored tenant ID in localStorage:', user.tenantId);
      } else if (user.isSuperAdmin || user.role === 'super_admin') {
        // Clear tenant ID for super admin (global access)
        localStorage.removeItem("tenantId");
        console.log('Auth: Cleared tenant ID for super admin');
      }
      
      console.log('Auth: Login successful for user:', user.name);
      console.log('Auth: User role:', user.role);
      console.log('Auth: User tenant ID:', user.tenantId);
      console.log('Auth: Is super admin:', user.isSuperAdmin);
      
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });
      return user;
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: "Incorrect credentials",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      // Clear tenant ID from local storage
      localStorage.removeItem("tenantId");
      console.log('Auth: Cleared tenant ID on logout');
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        tenantId,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
