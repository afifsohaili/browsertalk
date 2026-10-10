import type { BackendStatus, Project } from '@/lib/agent-backend/interface';

export type ConnectionRequest =
  | { type: 'connection/pair'; code: string }
  | { type: 'connection/status' }
  | { type: 'connection/projects' }
  | { type: 'connection/bind'; origin: string; projectDirectory: string };

export interface ConnectionChangedEvent {
  type: 'connection/changed';
}

export type ConnectionMessage = ConnectionRequest | ConnectionChangedEvent;

export type ConnectionResult = { ok: true } | { ok: false; error: string };

export type ProjectsResult = { ok: true; projects: Project[] } | { ok: false; error: string };

export function isConnectionRequest(value: unknown): value is ConnectionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === 'connection/pair' ||
    type === 'connection/status' ||
    type === 'connection/projects' ||
    type === 'connection/bind'
  );
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

export function isProjectsResult(value: unknown): value is ProjectsResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; projects?: unknown; error?: unknown };
  return (
    (candidate.ok === true && Array.isArray(candidate.projects)) ||
    (candidate.ok === false && typeof candidate.error === 'string')
  );
}
