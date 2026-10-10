import { isAgentBackendId, isProject, type BackendStatus, type Project } from '@/lib/agent-backend/interface';
import { parseLoopbackUrl } from './endpoint';
import type { ConnectionIdentity } from './identity';

export type ConnectionRequest =
  | { type: 'connection/pair'; code: string }
  | { type: 'connection/status' }
  | { type: 'connection/onboarding' }
  | { type: 'connection/projects'; connection: ConnectionIdentity }
  | { type: 'connection/bind'; origin: string; projectDirectory: string; connection: ConnectionIdentity };

export interface ConnectionChangedEvent {
  type: 'connection/changed';
}

export type ConnectionMessage = ConnectionRequest | ConnectionChangedEvent;

export type ConnectionResult = { ok: true } | { ok: false; error: string };

export interface OnboardingView {
  instructions: string;
  command: string | null;
  credentialLabel: string;
}

export type OnboardingResult =
  | { ok: true; onboarding: OnboardingView | null }
  | { ok: false; error: string };

export type ProjectsResult =
  | { ok: true; supported: boolean; projects: Project[] }
  | { ok: false; error: string };

export function isConnectionRequest(value: unknown): value is ConnectionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as {
    type?: unknown;
    code?: unknown;
    origin?: unknown;
    projectDirectory?: unknown;
    connection?: unknown;
  };
  switch (candidate.type) {
    case 'connection/pair':
      return typeof candidate.code === 'string' && candidate.code.length > 0;
    case 'connection/bind':
      return (
        typeof candidate.origin === 'string' &&
        candidate.origin.length > 0 &&
        typeof candidate.projectDirectory === 'string' &&
        candidate.projectDirectory.length > 0 &&
        isConnectionIdentity(candidate.connection)
      );
    case 'connection/projects':
      return isConnectionIdentity(candidate.connection);
    case 'connection/status':
    case 'connection/onboarding':
      return true;
    default:
      return false;
  }
}

export function isConnectionIdentity(value: unknown): value is ConnectionIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { backendId?: unknown; endpoint?: unknown };
  if (!isAgentBackendId(candidate.backendId)) return false;
  if (typeof candidate.endpoint !== 'string') return false;

  const parsed = parseLoopbackUrl(candidate.endpoint);
  return parsed.ok && parsed.endpoint === candidate.endpoint;
}

export function isConnectionChanged(value: unknown): value is ConnectionChangedEvent {
  return (
    typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'connection/changed'
  );
}

export function isBackendStatus(value: unknown): value is BackendStatus {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; detail?: unknown };
  return typeof candidate.ok === 'boolean' && typeof candidate.detail === 'string';
}

export function isConnectionResult(value: unknown): value is ConnectionResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; error?: unknown };
  return candidate.ok === true || (candidate.ok === false && typeof candidate.error === 'string');
}

export function isOnboardingResult(value: unknown): value is OnboardingResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; onboarding?: unknown; error?: unknown };
  if (candidate.ok === true) return candidate.onboarding === null || isOnboardingView(candidate.onboarding);
  return candidate.ok === false && typeof candidate.error === 'string';
}

export function isProjectsResult(value: unknown): value is ProjectsResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; supported?: unknown; projects?: unknown; error?: unknown };
  return (
    (candidate.ok === true &&
      typeof candidate.supported === 'boolean' &&
      Array.isArray(candidate.projects) &&
      candidate.projects.every(isProject)) ||
    (candidate.ok === false && typeof candidate.error === 'string')
  );
}

function isOnboardingView(value: unknown): value is OnboardingView {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { instructions?: unknown; command?: unknown; credentialLabel?: unknown };
  return (
    typeof candidate.instructions === 'string' &&
    (candidate.command === null || typeof candidate.command === 'string') &&
    typeof candidate.credentialLabel === 'string'
  );
}
