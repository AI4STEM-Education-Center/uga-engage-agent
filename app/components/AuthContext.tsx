"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserContext } from "@/lib/auth";

type AuthState = {
  user: UserContext | null;
  loading: boolean;
  error: string | null;
};

const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
});

export const useAuth = () => useContext(AuthCtx);

function parseSSOFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sso_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const token = parseSSOFromUrl();
    if (!token) {
      setState({ user: null, loading: false, error: "No SSO token provided." });
      return;
    }

    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ?? "Authentication failed.",
          );
        }
        return res.json();
      })
      .then((data) => {
        setState({ user: data.user as UserContext, loading: false, error: null });
      })
      .catch((err) => {
        setState({
          user: null,
          loading: false,
          error: err instanceof Error ? err.message : "Authentication failed.",
        });
      });
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}
