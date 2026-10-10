import { browser } from 'wxt/browser';
import { sendQueuedItem } from '@/lib/send/send';
import { resolveActiveSessionStrategy } from '@/lib/session-strategy/selection';
import { getBoundProject } from '@/lib/storage/projects';
import {
  isPanelRequest,
  isPanelRetryResult,
  isSessionRolloverResult,
  isTargetReadResult,
  type PanelRequest,
  type PanelRetryResult,
  type SessionRolloverResult,
  type TargetReadResult,
} from './protocol';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';
const NO_PROJECT_BINDING = 'This site has no project binding';

export type PanelResponse = TargetReadResult | PanelRetryResult | SessionRolloverResult;

export async function respondToPanelRequest(request: PanelRequest): Promise<PanelResponse> {
  switch (request.type) {
    case 'target/read':
      return readTarget(request.origin);
    case 'outbox/retry':
      return retryOutboxItem(request.itemId);
    case 'session/rollover':
      return rolloverSession(request.origin);
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

export async function requestSessionRollover(origin: string): Promise<SessionRolloverResult> {
  const response = await sendSafely({ type: 'session/rollover', origin });
  return isSessionRolloverResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

async function readTarget(origin: string): Promise<TargetReadResult> {
  try {
    const project = await getBoundProject(origin);
    if (project === null) return { ok: true, target: { project: null, session: null } };

    const { backend, strategy } = await resolveActiveSessionStrategy();
    const session = await strategy.peekSession({ backend, directory: project });
    return { ok: true, target: { project, session } };
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

async function rolloverSession(origin: string): Promise<SessionRolloverResult> {
  try {
    const project = await getBoundProject(origin);
    if (project === null) return { ok: false, error: NO_PROJECT_BINDING };

    const { backend, strategy } = await resolveActiveSessionStrategy();
    const session = await strategy.rolloverSession({ backend, directory: project });
    return { ok: true, session };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
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
