import { createServerClient } from "@/lib/auth/server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Auth callback handler.
 * Handles both OAuth code exchange and email confirmation token exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/painel";

  const supabase = await createServerClient();

  // Handle PKCE code exchange (OAuth, email confirmation with PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Handle token hash verification (email confirmation, magic link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email" | "recovery" | "invite",
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
