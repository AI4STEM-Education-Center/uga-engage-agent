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

const TOKEN_STORAGE_KEY = "engage-sso-token";

export const useAuth = () => useContext(AuthCtx);

function readStoredSSOToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSSOToken(token: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures and fall back to query-param auth only.
  }
}

function clearStoredSSOToken() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function parseSSOFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const token = url.searchParams.get("sso_token");
  if (!token) {
    return null;
  }

  storeSSOToken(token);
  url.searchParams.delete("sso_token");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);

  return token;
}

function resolveSSOToken(): string | null {
  return parseSSOFromUrl() ?? readStoredSSOToken();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const token = resolveSSOToken();
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
        storeSSOToken(token);
        setState({ user: data.user as UserContext, loading: false, error: null });
      })
      .catch((err) => {
        clearStoredSSOToken();
        setState({
          user: null,
          loading: false,
          error: err instanceof Error ? err.message : "Authentication failed.",
        });
      });
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}
