import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/cookies";

// The Socket.io client connects directly to the Nest API (a different
// origin than this Next.js app), so it can't rely on our httpOnly cookies —
// browsers never send one origin's cookies to another. This endpoint is the
// deliberate, narrow exception: an authenticated (same-origin, cookie-gated)
// route that hands the current access token to client JS, solely so it can
// be placed in the Socket.io handshake's `auth` payload. It's never written
// to localStorage or a JS-readable cookie, and it's still just the normal
// short-lived (15m) access token — not an elevated credential.
export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
