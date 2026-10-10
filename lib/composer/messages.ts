import { browser } from 'wxt/browser';
import { captureQueuedDestination } from '@/lib/connection/destinations';
import { CONSENT_REQUIRED_ERROR, hasConsent } from '@/lib/consent/consent';
import { requestSend } from '@/lib/send/trigger';
import { isQuotaExceeded } from '@/lib/storage/budgets';
import { clearPendingFeedback, getPendingFeedback } from '@/lib/storage/pending';
import { countOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { appendToOutbox } from '@/lib/storage/writer';
import { buildElementOutboxItem, buildPageOutboxItem, withoutScreenshot } from './assemble';
import { broadcastOutboxChanged } from './broadcast';
import { NO_PICKED_ELEMENT_ERROR } from './element-submission';
import {
  isComposerOpenResult,
  isComposerQueueResult,
  isComposerRequest,
  isOutboxChanged,
  isOutboxCountResult,
  type ComposerMode,
  type ComposerOpenResult,
  type ComposerPageRequest,
  type ComposerQueueRequest,
  type ComposerQueueResult,
  type ComposerRequest,
  type OutboxCountResult,
} from './protocol';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';
const NO_ACTIVE_PAGE = 'No active page to comment on';
const NO_CONTENT_SCRIPT = "Can't comment on this page";
const NO_PAGE_URL = "Can't read this page's URL";

export type ComposerResponse = ComposerOpenResult | ComposerQueueResult | OutboxCountResult;

export interface ComposerRequestContext {
  tabId?: number;
}

export async function respondToComposerRequest(
  request: ComposerRequest,
  context: ComposerRequestContext = {},
): Promise<ComposerResponse> {
  switch (request.type) {
    case 'composer/open':
      return openComposerOnActiveTab();
    case 'composer/queue':
      return queueComment(request, context);
    case 'outbox/url-only':
      return queueUrlOnly();
    case 'outbox/count':
      return { ok: true, count: await countOutbox() };
  }
}

export function registerComposerHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isComposerRequest(message)) return undefined;

    respondToComposerRequest(message, { tabId: sender.tab?.id }).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies ComposerOpenResult);
    });
    return true;
  });
}

async function queueComment(request: ComposerQueueRequest, context: ComposerRequestContext): Promise<ComposerQueueResult> {
  if (!(await hasConsent())) return { ok: false, error: CONSENT_REQUIRED_ERROR };

  const meta = { id: crypto.randomUUID(), now: new Date().toISOString() };
  let item: OutboxItem;
  let consumed: { tabId: number; captureID: string } | null = null;

  if (request.mode === 'element') {
    const tabId = context.tabId;
    if (tabId === undefined || request.captureID === undefined) return { ok: false, error: NO_PICKED_ELEMENT_ERROR };

    const pending = await getPendingFeedback(tabId);
    if (pending === null || pending.id !== request.captureID) return { ok: false, error: NO_PICKED_ELEMENT_ERROR };

    const destination = await captureQueuedDestination(pending.page.url);
    item = buildElementOutboxItem(pending, request.comment, {
      ...meta,
      ...(destination === null ? {} : { destination }),
    });
    consumed = { tabId, captureID: request.captureID };
  } else {
    const destination = await captureQueuedDestination(request.page.url);
    item = buildPageOutboxItem(request.page, request.comment, {
      ...meta,
      ...(destination === null ? {} : { destination }),
    });
  }

  let appended: { item: OutboxItem; screenshotDropped: boolean };
  try {
    appended = await appendItem(item);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' };
  }

  if (consumed === null) {
    if (context.tabId !== undefined) await clearPendingFeedback(context.tabId);
  } else {
    await clearPendingFeedback(consumed.tabId, consumed.captureID);
  }

  broadcastOutboxChanged();
  requestSend(appended.item.id);
  return {
    ok: true,
    outboxCount: await countOutbox(),
    ...(appended.screenshotDropped ? { screenshotDropped: true } : {}),
  };
}

async function appendItem(item: OutboxItem): Promise<{ item: OutboxItem; screenshotDropped: boolean }> {
  try {
    await appendToOutbox(item);
    return { item, screenshotDropped: false };
  } catch (error) {
    if (!isQuotaExceeded(error) || item.facts.extras?.screenshot === undefined) throw error;

    const stripped = withoutScreenshot(item);
    await appendToOutbox(stripped);
    return { item: stripped, screenshotDropped: true };
  }
}

async function queueUrlOnly(): Promise<ComposerQueueResult> {
  if (!(await hasConsent())) return { ok: false, error: CONSENT_REQUIRED_ERROR };

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab === undefined) return { ok: false, error: NO_ACTIVE_PAGE };

  const url = typeof tab.url === 'string' && tab.url.length > 0 ? tab.url : null;
  if (url === null) return { ok: false, error: NO_PAGE_URL };

  const destination = await captureQueuedDestination(url);
  const item = buildPageOutboxItem({ url, title: typeof tab.title === 'string' ? tab.title : '' }, '', {
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
    ...(destination === null ? {} : { destination }),
  });

  try {
    await appendToOutbox(item);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' };
  }

  broadcastOutboxChanged();
  requestSend(item.id);
  return { ok: true, outboxCount: await countOutbox() };
}

export async function openComposerOnActiveTab(): Promise<ComposerOpenResult> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (tabId === undefined) return { ok: false, error: NO_ACTIVE_PAGE };
  return openComposerOnTab(tabId);
}

export async function openComposerOnTab(tabId: number): Promise<ComposerOpenResult> {
  try {
    const response = await browser.tabs.sendMessage(tabId, { type: 'composer/open' } satisfies ComposerRequest);
    return isComposerOpenResult(response) ? response : { ok: false, error: NO_CONTENT_SCRIPT };
  } catch {
    return { ok: false, error: NO_CONTENT_SCRIPT };
  }
}

export { broadcastOutboxChanged } from './broadcast';

export async function requestOpenComposer(): Promise<ComposerOpenResult> {
  const response = await sendSafely({ type: 'composer/open' });
  return isComposerOpenResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestQueueComment(
  comment: string,
  mode: ComposerMode,
  page: ComposerPageRequest,
  captureID?: string,
): Promise<ComposerQueueResult> {
  const request: ComposerRequest = {
    type: 'composer/queue',
    comment,
    mode,
    page,
    ...(captureID === undefined ? {} : { captureID }),
  };
  const response = await sendSafely(request);
  return isComposerQueueResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestQueueUrlOnly(): Promise<ComposerQueueResult> {
  const response = await sendSafely({ type: 'outbox/url-only' });
  return isComposerQueueResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestOutboxCount(): Promise<OutboxCountResult> {
  const response = await sendSafely({ type: 'outbox/count' });
  return isOutboxCountResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export function onOutboxChanged(listener: () => void): () => void {
  const handler = (message: unknown): undefined => {
    if (isOutboxChanged(message)) listener();
    return undefined;
  };
  browser.runtime.onMessage.addListener(handler);
  return () => browser.runtime.onMessage.removeListener(handler);
}

async function sendSafely(message: ComposerRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}
