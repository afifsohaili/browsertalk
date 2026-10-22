import type { BackendStatus, ConnectionState } from '@/lib/agent-backend/interface';

export const OPENCODE_REQUIRED = 'Browsertalk needs opencode 2';
export const OPENCODE_UPGRADE_COMMAND = 'opencode upgrade';

/** Pairing rejection copy names both the requirement and the command. */
export const OPENCODE_UPGRADE_MESSAGE = `${OPENCODE_REQUIRED} — run ${OPENCODE_UPGRADE_COMMAND}`;

export const CONNECTION_ACTIONS: Record<ConnectionState, string> = {
  unreachable: 'Start opencode, then test again',
  unpaired: 'Pair with opencode',
  unauthorized: 'Pair again with a fresh link',
  incompatible: `Run ${OPENCODE_UPGRADE_COMMAND}`,
  connected: 'Pick a project',
};

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  unreachable: 'Cannot reach opencode',
  unpaired: 'Not paired',
  unauthorized: 'Pairing token rejected',
  incompatible: 'Wrong opencode version',
  connected: 'Connected',
};

export const REMOTE_PAIRING_WARNING =
  'This link points to a server on another machine. The pairing token and feedback will cross your network. Keep the path encrypted (Tailscale, SSH tunnel) or trusted.';

const SUPPORTED_OPENCODE_VERSION =
  /^2\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** The opencode 2 line, matching `2.0.32` and `2.1.0-beta` but not `3.0.0` or `20.1`.
 * Prerelease and build identifiers must be non-empty and dot-separated. */
export function isSupportedOpenCodeVersion(version: string): boolean {
  return SUPPORTED_OPENCODE_VERSION.test(version);
}

/** Older adapters omit `state`; treat an ok status as connected and a failure as unpaired. */
export function connectionState(status: BackendStatus): ConnectionState {
  return status.state ?? (status.ok ? 'connected' : 'unpaired');
}

/** `Connected: opencode 2.0.32 at 127.0.0.1:29422`, per the setup copy. */
export function connectedSummary(status: BackendStatus): string {
  const version = status.version ?? '';
  const host = hostFromEndpoint(status.endpoint);
  const parts = ['Connected:', 'opencode', version].filter((part) => part.length > 0);
  return host === null ? parts.join(' ') : `${parts.join(' ')} at ${host}`;
}

function hostFromEndpoint(endpoint: string | undefined): string | null {
  if (endpoint === undefined) return null;
  try {
    return new URL(endpoint).host;
  } catch {
    return null;
  }
}
