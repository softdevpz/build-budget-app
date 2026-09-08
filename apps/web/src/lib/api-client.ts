// For use in Client Components. Always calls our own /api/proxy/* (same
// origin as the browser), never the Nest API directly — see api-server.ts
// for why, and app/api/proxy/[...path]/route.ts for the forwarding logic.
export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message ?? res.statusText;
    throw new ClientApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }
  return data as T;
}
