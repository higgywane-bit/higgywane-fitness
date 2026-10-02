import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, passcodeToken } from "@/lib/admin-gate";

export async function middleware(req: NextRequest) {
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode) return NextResponse.next();
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && cookie === (await passcodeToken(passcode))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin-login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
