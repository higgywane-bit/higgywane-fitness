import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, adminAuthConfig, verifySession } from "@/lib/admin-auth";

export async function middleware(req: NextRequest) {
  const cfg = adminAuthConfig();
  // No account configured (local laptop): admin stays open.
  if (!cfg) return NextResponse.next();
  if (await verifySession(cfg, req.cookies.get(ADMIN_SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin-login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
