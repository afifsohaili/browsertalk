export const SERVER_URL_ERRORS = {
  empty: 'Enter a server URL',
  invalid: 'That server URL cannot be parsed — include http:// or https://',
  protocol: 'The server URL must start with http:// or https://',
  credentials: 'Remove the username and password from the server URL',
  remote: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1',
} as const;

export type LoopbackCheck = { ok: true; endpoint: string } | { ok: false; error: string };

export function parseLoopbackUrl(value: string): LoopbackCheck {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, error: SERVER_URL_ERRORS.empty };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: SERVER_URL_ERRORS.invalid };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: SERVER_URL_ERRORS.protocol };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return { ok: false, error: SERVER_URL_ERRORS.credentials };
  }
  if (!isLoopbackHost(url.hostname)) {
    return { ok: false, error: SERVER_URL_ERRORS.remote };
  }

  const path = url.pathname.replace(/\/+$/, '');
  return { ok: true, endpoint: `${url.origin}${path}` };
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost') return true;
  if (host.startsWith('[') || host.endsWith(']')) return host === '[::1]';

  const parts = host.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return false;
  return parts[0] === '127';
}
