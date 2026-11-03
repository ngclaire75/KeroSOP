import { NextResponse, type NextRequest } from "next/server";

/**
 * Two hosts, one Next.js app (like vanta.com and app.vanta.com):
 *  - kerosop.site: marketing pages. Login, sign-up and access requests move to
 *    the app host so the Firebase session lives where the dashboard is.
 *  - app.kerosop.site: the dashboard at the root ("/findings" serves the
 *    internal "/app/findings" route), plus login, sign-up and request access.
 * Any other host (localhost, Vercel previews) keeps the plain "/app/…" paths.
 */
const MAIN = new Set(["kerosop.site", "www.kerosop.site"]);
const APP = "app.kerosop.site";
const SHARED = ["/login", "/signup", "/request-access", "/privacy", "/terms", "/help"];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const { pathname, search } = req.nextUrl;

  if (MAIN.has(host)) {
    if (pathname === "/app" || pathname.startsWith("/app/")) {
      return NextResponse.redirect(new URL(`https://${APP}${pathname.slice(4) || "/"}${search}`), 308);
    }
    if (["/login", "/signup", "/request-access"].includes(pathname)) {
      return NextResponse.redirect(new URL(`https://${APP}${pathname}${search}`), 307);
    }
    return NextResponse.next();
  }

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
