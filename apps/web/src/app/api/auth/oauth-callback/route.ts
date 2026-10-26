import { NextRequest, NextResponse } from "next/server";
import { ApiError, callNestApiOrThrow } from "@/lib/api-server";
import { setAuthCookies } from "@/lib/cookies";

// Landed on after Google redirects back through our API's /auth/google/callback.
// The API hands us a short-lived one-time code (never the real tokens — see
// AuthService.issueOAuthCode) instead of putting them directly in this URL,
// which browsers keep in history and servers tend to log.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  try {
    const data = (await callNestApiOrThrow("/auth/oauth-exchange", { method: "POST", body: { code } })) as {
      accessToken: string;
      refreshToken: string;
    };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.redirect(new URL(`/login?error=oauth_failed&status=${status}`, req.url));
  }
}
