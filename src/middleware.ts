import { createMiddleware } from "@/lib/auth/middleware";

export default createMiddleware();

export const config = {
  matcher: [
    "/((?!login|privacy|terms|api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.json|service-worker\\.js|icons).+)",
  ],
};
