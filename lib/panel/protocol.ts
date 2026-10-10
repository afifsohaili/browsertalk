import type { SessionRef } from '@/lib/agent-backend/interface';
import type { ConnectionIdentity } from '@/lib/connection/identity';
import { isConnectionIdentity } from '@/lib/connection/protocol';
import { isRecord } from '@/lib/picker/facts';

export type PanelRequest =
  | { type: 'target/read'; origin: string }
  | { type: 'outbox/retry'; itemId: string }
  | { type: 'outbox/discard'; itemId: string }
  | { type: 'session/rollover'; origin: string; connection: ConnectionIdentity };

export interface TargetSnapshot {
  project: string | null;
  session: SessionRef | null;
}

export type TargetReadResult =
  | { ok: true; target: TargetSnapshot; connection: ConnectionIdentity }
  | { ok: false; error: string };

export type PanelRetryResult = { ok: true } | { ok: false; error: string };

export type PanelDiscardResult = { ok: true } | { ok: false; error: string };

export type SessionRolloverResult = { ok: true; session: SessionRef } | { ok: false; error: string };

export function isPanelRequest(value: unknown): value is PanelRequest {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'target/read':
      return typeof value.origin === 'string' && value.origin.length > 0;
    case 'session/rollover':
      return (
        typeof value.origin === 'string' && value.origin.length > 0 && isConnectionIdentity(value.connection)
      );
    case 'outbox/retry':
    case 'outbox/discard':
      return typeof value.itemId === 'string' && value.itemId.length > 0;
    default:
      return false;
  }
}

export function isTargetReadResult(value: unknown): value is TargetReadResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return isTargetSnapshot(value.target) && isConnectionIdentity(value.connection);
  return value.ok === false && typeof value.error === 'string';
}

export function isPanelRetryResult(value: unknown): value is PanelRetryResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return value.error === undefined;
  return value.ok === false && typeof value.error === 'string';
}

export function isPanelDiscardResult(value: unknown): value is PanelDiscardResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return value.error === undefined;
  return value.ok === false && typeof value.error === 'string';
}

export function isSessionRolloverResult(value: unknown): value is SessionRolloverResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return isSessionRef(value.session);
  return value.ok === false && typeof value.error === 'string';
}

function isTargetSnapshot(value: unknown): value is TargetSnapshot {
  if (!isRecord(value)) return false;
  if (!(value.project === null || typeof value.project === 'string')) return false;
  if (!(value.session === null || isSessionRef(value.session))) return false;
  return true;
}

function isSessionRef(value: unknown): value is SessionRef {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && typeof value.title === 'string';
}
