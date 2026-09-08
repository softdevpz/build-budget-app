import { NextResponse } from "next/server";
import { callNestApi } from "@/lib/api-server";
import { clearAuthCookies, getAccessToken } from "@/lib/cookies";

export async function POST() {
  const token = await getAccessToken();
  if (token) {
    // Best-effort: revoke the refresh token server-side. Cookies get cleared
    // either way, so a failure here shouldn't block the user from logging out.
    await callNestApi("/auth/logout", { method: "POST", token }).catch(() => {});
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
