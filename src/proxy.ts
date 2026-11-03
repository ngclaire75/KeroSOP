import { NextResponse, type NextRequest } from "next/server";

/**
 * The main domain serves marketing, auth and /app dashboard routes directly.
 * Keep subdomain rewrites available if an app host is connected in the future.
 */
const SHARED = ["/login", "/signup", "/request-access", "/privacy", "/terms", "/help"];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const { pathname } = req.nextUrl;

  if (host.startsWith("app.")) {
    if (pathname === "/app" || pathname.startsWith("/app/")) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice(4) || "/";
      return NextResponse.redirect(url, 308);
    }
    if (SHARED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `/app${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // pages only: never static files, images or Next internals
  matcher: ["/((?!_next/|favicon|icon|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|mp4|webm|woff2?|txt|xml|json|map)$).*)"],
};
