import { NextRequest, NextResponse } from "next/server";
import { callNestApi } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Nest already replies with the same message whether the email exists or
  // not — nothing here needs to branch on the result.
  const { data } = await callNestApi("/auth/resend-verification", { method: "POST", body });
  return NextResponse.json(data);
}
