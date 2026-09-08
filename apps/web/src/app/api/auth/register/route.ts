import { NextRequest, NextResponse } from "next/server";
import { ApiError, callNestApiOrThrow } from "@/lib/api-server";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const data = (await callNestApiOrThrow("/auth/register", { method: "POST", body })) as {
      accessToken: string;
      refreshToken: string;
    };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}
