"use client";

/**
 * React hooks for authentication in BUDGY.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { createBrowserClient } from "./client";

export function useUser(): {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase.auth.getUser().then(({ data: { user: currentUser }, error: authError }) => {
      setUser(currentUser);
      setError(authError);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setError(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
}

export function useSession(): {
  session: Session | null;
  loading: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export interface AuthMethods {
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signup: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  loginWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  loginWithOAuth: (provider: "google" | "apple" | "facebook") => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  loading: boolean;
}

export function useAuth(): AuthMethods {
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signOut();
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithMagicLink = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email });
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithOAuth = useCallback(async (provider: "google" | "apple" | "facebook") => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  return { login, signup, logout, loginWithMagicLink, loginWithOAuth, resetPassword, loading };
}
