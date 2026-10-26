import { NextRequest, NextResponse } from "next/server";
import { ApiError, callNestApiOrThrow } from "@/lib/api-server";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const data = (await callNestApiOrThrow("/auth/login", { method: "POST", body })) as
      | { accessToken: string; refreshToken: string }
      | { twoFactorRequired: true; challengeId: string };

    if ("twoFactorRequired" in data) {
      // No cookies yet — the password check passed, but the account still
      // needs a valid TOTP/backup code (see /api/auth/2fa-verify) before a
      // session is actually granted.
      return NextResponse.json({ twoFactorRequired: true, challengeId: data.challengeId });
    }

    await setAuthCookies(data.accessToken, data.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}
