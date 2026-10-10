import { browser } from 'wxt/browser';
import { requestSend } from '@/lib/send/trigger';
import { clearPendingFeedback, getPendingFeedback } from '@/lib/storage/pending';
import { appendToOutbox, countOutbox } from '@/lib/storage/outbox';
import { buildElementOutboxItem, buildPageOutboxItem } from './assemble';
import { broadcastOutboxChanged } from './broadcast';
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
const NO_PICKED_ELEMENT = 'No picked element to comment on';
const NO_PAGE_URL = "Can't read this page's URL";

export type ComposerResponse = ComposerOpenResult | ComposerQueueResult | OutboxCountResult;

export async function respondToComposerRequest(request: ComposerRequest): Promise<ComposerResponse> {
  switch (request.type) {
    case 'composer/open':
      return openComposerOnActiveTab();
    case 'composer/queue':
      return queueComment(request);
    case 'outbox/url-only':
      return queueUrlOnly();
    case 'outbox/count':
      return { ok: true, count: await countOutbox() };
  }
}

export function registerComposerHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isComposerRequest(message)) return undefined;

    respondToComposerRequest(message).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies ComposerOpenResult);
    });
    return true;
  });
}

async function queueComment(request: ComposerQueueRequest): Promise<ComposerQueueResult> {
  const meta = { id: crypto.randomUUID(), now: new Date().toISOString() };

  let item;
  if (request.mode === 'element') {
    const pending = await getPendingFeedback();
    if (pending === null) return { ok: false, error: NO_PICKED_ELEMENT };
    item = buildElementOutboxItem(pending, request.comment, meta);
  } else {
    item = buildPageOutboxItem(request.page, request.comment, meta);
  }

  await appendToOutbox(item);
  await clearPendingFeedback();
  broadcastOutboxChanged();
  requestSend(item.id);
  return { ok: true, outboxCount: await countOutbox() };
}

async function queueUrlOnly(): Promise<ComposerQueueResult> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab === undefined) return { ok: false, error: NO_ACTIVE_PAGE };

  const url = typeof tab.url === 'string' && tab.url.length > 0 ? tab.url : null;
  if (url === null) return { ok: false, error: NO_PAGE_URL };

  const item = buildPageOutboxItem({ url, title: typeof tab.title === 'string' ? tab.title : '' }, '', {
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  await appendToOutbox(item);
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
): Promise<ComposerQueueResult> {
  const response = await sendSafely({ type: 'composer/queue', comment, mode, page });
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
