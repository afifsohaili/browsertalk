import { isLoopbackHost, parseServerUrl } from './endpoint';

export const PAIRING_LINK_ERRORS = {
  empty: 'Paste the pairing link or code',
  notPairingLink: 'That link is not a pairing link — copy the link opencode pair prints',
  prose: 'Paste the pairing link or the code on its own',
} as const;

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

export interface PairingCredential {
  /** Code to redeem at `/auth/connect/{code}`. */
  code: string;
  /** Canonical endpoint carried by the link; null for a bare code. */
  endpoint: string | null;
  /** Scheme + host + port shown to the user before a remote confirmation. */
  origin: string | null;
  /** True when the link points at a server other than loopback. */
  remote: boolean;
}

export type PairingCredentialCheck =
  | { ok: true; credential: PairingCredential }
  | { ok: false; error: string };

export function parsePairingCredential(value: string): PairingCredentialCheck {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, error: PAIRING_LINK_ERRORS.empty };

  const match = URL_PATTERN.exec(trimmed);
  if (match !== null) return parseLink(stripTrailingPunctuation(match[0]));

  if (/\s/.test(trimmed)) return { ok: false, error: PAIRING_LINK_ERRORS.prose };

  return { ok: true, credential: { code: trimmed, endpoint: null, origin: null, remote: false } };
}

function parseLink(raw: string): PairingCredentialCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: PAIRING_LINK_ERRORS.notPairingLink };
  }

  const codeMatch = /^\/auth\/connect\/([^/]+)\/?$/.exec(url.pathname);
  if (codeMatch === null) return { ok: false, error: PAIRING_LINK_ERRORS.notPairingLink };

  const parsed = parseServerUrl(raw, { allowRemote: true });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const endpoint = parseServerUrl(url.origin, { allowRemote: true });
  if (!endpoint.ok) return { ok: false, error: endpoint.error };

  const encoded = codeMatch[1];
  if (encoded === undefined) return { ok: false, error: PAIRING_LINK_ERRORS.notPairingLink };

  let code: string;
  try {
    code = decodeURIComponent(encoded);
  } catch {
    return { ok: false, error: PAIRING_LINK_ERRORS.notPairingLink };
  }
  if (code.length === 0) return { ok: false, error: PAIRING_LINK_ERRORS.notPairingLink };

  return {
    ok: true,
    credential: {
      code,
      endpoint: endpoint.endpoint,
      origin: url.origin,
      remote: !isLoopbackHost(url.hostname),
    },
  };
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:]+$/, '');
}
