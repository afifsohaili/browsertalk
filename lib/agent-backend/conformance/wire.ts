export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function readJsonBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(init.body);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function redirectOf(init: RequestInit | undefined): string | undefined {
  return typeof init?.redirect === 'string' ? init.redirect : undefined;
}

export function headersOf(init: RequestInit | undefined): Record<string, string> {
  return typeof init?.headers === 'object' && init.headers !== null
    ? (init.headers as Record<string, string>)
    : {};
}
