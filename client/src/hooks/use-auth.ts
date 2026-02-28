import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

function clearToken() {
  localStorage.removeItem("auth_token");
}

function isGuestMode(): boolean {
  return localStorage.getItem("guest_mode") === "true";
}

function setGuestMode(val: boolean) {
  if (val) {
    localStorage.setItem("guest_mode", "true");
  } else {
    localStorage.removeItem("guest_mode");
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      if (isGuestMode()) return null;
      const token = getToken();
      if (!token) return null;
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearToken();
          return null;
        }
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao fazer login");
      }
      const data = await res.json();
      setGuestMode(false);
      setToken(data.token);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const enterAsGuestMutation = useMutation({
    mutationFn: async () => {
      clearToken();
      setGuestMode(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = getToken();
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      clearToken();
      setGuestMode(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const guest = isGuestMode();

  return {
    user: user ?? null,
    isLoading: guest ? false : isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    isGuest: guest,
    login: loginMutation,
    enterAsGuest: enterAsGuestMutation,
    logout: logoutMutation,
  };
}
