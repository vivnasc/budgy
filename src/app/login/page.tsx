"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/shared/auth-form";
import { createBrowserClient } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);
      router.push("/painel");
      router.refresh();
    },
    [router],
  );

  const handleRegister = useCallback(
    async (email: string, password: string, fullName: string, phone: string) => {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw new Error(error.message);
    },
    [],
  );

  const handleGoogleLogin = useCallback(async () => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const handleFacebookLogin = useCallback(async () => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const handleForgotPassword = useCallback(async (email: string) => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, []);

  return (
    <AuthForm
      appName="BUDGY"
      appColor="#10B981"
      appTagline="As tuas finanças, simplificadas"
      onLogin={handleLogin}
      onRegister={handleRegister}
      onGoogleLogin={handleGoogleLogin}
      onFacebookLogin={handleFacebookLogin}
      onForgotPassword={handleForgotPassword}
    />
  );
}
