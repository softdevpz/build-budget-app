import type { ProjectSummary } from "./types";

// Called only from Route Handlers and Server Components — never shipped to
// the browser. This is why the Nest API URL doesn't need a NEXT_PUBLIC_
// prefix: the browser only ever talks to our own Next.js origin (see
// api-client.ts), which then makes this server-to-server call.
const NEST_API_URL = process.env.WEB_PUBLIC_API_URL as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type CallOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  searchParams?: URLSearchParams;
};

export type ApiResult = { status: number; data: unknown };

export async function callNestApi(path: string, options: CallOptions = {}): Promise<ApiResult> {
  const { method = "GET", token, body, searchParams } = options;
  const query = searchParams?.toString();
  const url = `${NEST_API_URL}${path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  return { status: res.status, data };
}

/** Like callNestApi, but throws ApiError on non-2xx — convenient when a failure should just propagate. */
export async function callNestApiOrThrow(path: string, options: CallOptions = {}): Promise<unknown> {
  const { status, data } = await callNestApi(path, options);
  if (status >= 300) {
    const message = (data as { message?: string } | null)?.message ?? "Request failed";
    throw new ApiError(status, Array.isArray(message) ? message.join(", ") : message);
  }
  return data;
}

// A sub-resource fetch failing (a stale deploy missing a route, a transient
// 500) shouldn't crash a Server Component — degrade to an empty/default
// value instead of blindly trusting the response shape with `as`.
export function arrayOrEmpty<T>(res: ApiResult): T[] {
  return res.status === 200 ? (res.data as T[]) : [];
}

const EMPTY_SUMMARY: ProjectSummary = { targetBudget: null, totalSpent: 0, remaining: null, stages: [], unassignedSpent: 0 };

export function summaryOrDefault(res: ApiResult): ProjectSummary {
  return res.status === 200 ? (res.data as ProjectSummary) : EMPTY_SUMMARY;
}
