import { browser } from 'wxt/browser';
import { broadcastOutboxChanged } from '@/lib/composer/broadcast';
import type { ConnectionIdentity } from '@/lib/connection/identity';
import { sendQueuedItem } from '@/lib/send/send';
import { sessionLockKey, withSessionLock } from '@/lib/session-strategy/lock';
import { resolveActiveSessionStrategy, resolveSessionStrategyFor } from '@/lib/session-strategy/selection';
import { getBoundProject } from '@/lib/storage/projects';
import { removeFromOutbox } from '@/lib/storage/writer';
import {
  isPanelDiscardResult,
  isPanelRequest,
  isPanelRetryResult,
  isSessionRolloverResult,
  isTargetReadResult,
  type PanelDiscardResult,
  type PanelRequest,
  type PanelRetryResult,
  type SessionRolloverResult,
  type TargetReadResult,
} from './protocol';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';
const NO_PROJECT_BINDING = 'This site has no project binding';

export type PanelResponse = TargetReadResult | PanelRetryResult | PanelDiscardResult | SessionRolloverResult;

export async function respondToPanelRequest(request: PanelRequest): Promise<PanelResponse> {
  switch (request.type) {
    case 'target/read':
      return readTarget(request.origin);
    case 'outbox/retry':
      return retryOutboxItem(request.itemId);
    case 'outbox/discard':
      return discardOutboxItem(request.itemId);
    case 'session/rollover':
      return rolloverSession(request.origin, request.connection);
  }
}

export function registerPanelHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isPanelRequest(message)) return undefined;

    respondToPanelRequest(message).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies PanelRetryResult);
    });
    return true;
  });
}

export async function requestTargetRead(origin: string): Promise<TargetReadResult> {
  const response = await sendSafely({ type: 'target/read', origin });
  return isTargetReadResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestOutboxRetry(itemId: string): Promise<PanelRetryResult> {
  const response = await sendSafely({ type: 'outbox/retry', itemId });
  return isPanelRetryResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestOutboxDiscard(itemId: string): Promise<PanelDiscardResult> {
  const response = await sendSafely({ type: 'outbox/discard', itemId });
  return isPanelDiscardResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestSessionRollover(
  origin: string,
  connection: ConnectionIdentity,
): Promise<SessionRolloverResult> {
  const response = await sendSafely({ type: 'session/rollover', origin, connection });
  return isSessionRolloverResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

async function readTarget(origin: string): Promise<TargetReadResult> {
  try {
    const { backend, strategy, connectionKey, connection } = await resolveActiveSessionStrategy();
    const identity = connectionIdentity(connection);
    const project = await getBoundProject(connectionKey, origin);
    if (project === null) return { ok: true, target: { project: null, session: null }, connection: identity };

    const session = await strategy.peekSession({ backend, connectionKey, directory: project });
    return { ok: true, target: { project, session }, connection: identity };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

async function retryOutboxItem(itemId: string): Promise<PanelRetryResult> {
  try {
    const outcome = await sendQueuedItem(itemId);
    return outcome.ok ? { ok: true } : { ok: false, error: outcome.error ?? 'Something went wrong' };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

async function discardOutboxItem(itemId: string): Promise<PanelDiscardResult> {
  try {
    await removeFromOutbox(itemId);
    broadcastOutboxChanged();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

async function rolloverSession(origin: string, connection: ConnectionIdentity): Promise<SessionRolloverResult> {
  try {
    const { backend, strategy, connectionKey } = await resolveSessionStrategyFor(connection);
    const project = await getBoundProject(connectionKey, origin);
    if (project === null) return { ok: false, error: NO_PROJECT_BINDING };

    const session = await withSessionLock(sessionLockKey(connectionKey, project), () =>
      strategy.rolloverSession({ backend, connectionKey, directory: project }),
    );
    return { ok: true, session };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

function connectionIdentity(connection: ConnectionIdentity): ConnectionIdentity {
  return { backendId: connection.backendId, endpoint: connection.endpoint };
}

async function sendSafely(message: PanelRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
