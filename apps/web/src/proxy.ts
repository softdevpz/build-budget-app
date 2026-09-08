import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

// A presence check only — it doesn't verify the token's signature/expiry.
// Real authorization is still enforced server-side on every request (the
// proxy forwards to Nest, which rejects an invalid/expired token with 401).
// This just avoids flashing a protected page before that round-trip fails.
export function proxy(req: NextRequest) {
  const hasToken = req.cookies.has(ACCESS_TOKEN_COOKIE);
  if (!hasToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
