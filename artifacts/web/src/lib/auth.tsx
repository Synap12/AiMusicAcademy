import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, type Me } from "./api";

interface AuthState {
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await apiGet("/auth/me");
        return res.user as Me;
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        refresh: () => qc.invalidateQueries({ queryKey: ["me"] }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Landing route for a logged-in user's role. */
export function homeFor(user: Me | null): string {
  if (!user) return "/login";
  if (user.isAdmin) return "/admin";
  if (!user.hasOnboarded) return "/subscription_select";
  return user.userType === "ARTIST" ? "/artist" : "/browse";
}
