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

const ME_CACHE_KEY = "me-cache";

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await apiGet("/auth/me");
        const user = res.user as Me;
        localStorage.setItem(ME_CACHE_KEY, JSON.stringify(user));
        return user;
      } catch (err) {
        // A network failure (offline) falls back to the last known session so
        // downloaded music stays reachable; a real 401 clears it.
        if (err instanceof TypeError) {
          const cached = localStorage.getItem(ME_CACHE_KEY);
          if (cached) return JSON.parse(cached) as Me;
        } else {
          localStorage.removeItem(ME_CACHE_KEY);
        }
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
