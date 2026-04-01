import { createMiddleware } from "@/lib/auth/middleware";

export default createMiddleware();

export const config = {
  matcher: [
    // Only run middleware on protected app routes - skip all public/static content
    "/((?!login|privacy|terms|api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|favicon-32\\.png|manifest\\.json|service-worker\\.js|icons|budgy-logo|apple-touch-icon|icon-).+)",
  ],
};
