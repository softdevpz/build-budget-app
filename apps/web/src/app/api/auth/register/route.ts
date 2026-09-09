import { NextRequest, NextResponse } from "next/server";
import { ApiError, callNestApiOrThrow } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    // Unlike /auth/login, /auth/register does not return tokens — the
    // account isn't allowed to log in until its email is verified — so
    // there's nothing to put in a cookie here.
    const data = await callNestApiOrThrow("/auth/register", { method: "POST", body });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}
