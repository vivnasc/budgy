/**
 * Next.js middleware for Supabase auth in BUDGY.
 * Refreshes sessions and protects routes.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

async function createSupabaseMiddlewareClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabaseResponse };
}

export function createMiddleware() {
  return async function middleware(request: NextRequest): Promise<NextResponse> {
    const { user, supabaseResponse } =
      await createSupabaseMiddlewareClient(request);

    const pathname = request.nextUrl.pathname;

    const isPublicRoute =
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/auth");

    // Authenticated user on login → redirect to dashboard
    if (user && pathname.startsWith("/login")) {
      const redirectTo = request.nextUrl.searchParams.get("redirect") || "/painel";
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }

    // Unauthenticated user on protected route → redirect to login
    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      if (pathname !== "/") {
        url.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  };
}
