import { NextRequest, NextResponse } from "next/server";
import { ApiResult, callNestApi } from "@/lib/api-server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/cookies";

type RouteParams = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const targetPath = "/" + path.join("/");
  const method = req.method;
  const body = method === "GET" || method === "DELETE" ? undefined : await req.json().catch(() => undefined);

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let result = await callNestApi(targetPath, {
    method,
    token: accessToken,
    body,
    searchParams: req.nextUrl.searchParams,
  });

  if (result.status === 401) {
    const refreshedToken = await tryRefresh();
    if (refreshedToken) {
      result = await callNestApi(targetPath, {
        method,
        token: refreshedToken,
        body,
        searchParams: req.nextUrl.searchParams,
      });
    } else {
      await clearAuthCookies();
    }
  }

  return toResponse(result);
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  // /auth/refresh expects the *refresh* token as the Bearer token (verified
  // by JwtRefreshGuard), not the access token.
  const { status, data } = await callNestApi("/auth/refresh", { method: "POST", token: refreshToken });
  if (status !== 200) return null;

  const { accessToken, refreshToken: newRefreshToken } = data as { accessToken: string; refreshToken: string };
  await setAuthCookies(accessToken, newRefreshToken);
  return accessToken;
}

function toResponse({ status, data }: ApiResult) {
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data, { status });
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
