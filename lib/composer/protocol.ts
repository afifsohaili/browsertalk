import { isRecord } from '@/lib/picker/facts';

export type ComposerMode = 'element' | 'page';

export interface ComposerPageRequest {
  url: string;
  title: string;
}

export interface ComposerQueueRequest {
  type: 'composer/queue';
  mode: ComposerMode;
  comment: string;
  page: ComposerPageRequest;
  captureID?: string;
}

export type ComposerRequest =
  | { type: 'composer/open' }
  | ComposerQueueRequest
  | { type: 'outbox/url-only' }
  | { type: 'outbox/count' };

export interface OutboxChangedEvent {
  type: 'outbox/changed';
}

export type ComposerMessage = ComposerRequest | OutboxChangedEvent;

export type ComposerOpenResult = { ok: true } | { ok: false; error: string };

export type ComposerQueueResult =
  | { ok: true; outboxCount: number; screenshotDropped?: boolean }
  | { ok: false; error: string };

export type OutboxCountResult = { ok: true; count: number } | { ok: false; error: string };

export function isComposerRequest(value: unknown): value is ComposerRequest {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'composer/open':
    case 'outbox/url-only':
    case 'outbox/count':
      return true;
    case 'composer/queue':
      if (!isComposerMode(value.mode) || typeof value.comment !== 'string' || !isComposerPageRequest(value.page)) {
        return false;
      }
      if (value.mode === 'element') return isCaptureID(value.captureID);
      return value.captureID === undefined || isCaptureID(value.captureID);
    default:
      return false;
  }
}

export function isOutboxChanged(value: unknown): value is OutboxChangedEvent {
  return isRecord(value) && value.type === 'outbox/changed';
}

export function isComposerOpenResult(value: unknown): value is ComposerOpenResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return value.error === undefined;
  return value.ok === false && typeof value.error === 'string';
}

export function isComposerQueueResult(value: unknown): value is ComposerQueueResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) {
    if (!isFiniteNumber(value.outboxCount)) return false;
    return value.screenshotDropped === undefined || typeof value.screenshotDropped === 'boolean';
  }
  return value.ok === false && typeof value.error === 'string';
}

export function isOutboxCountResult(value: unknown): value is OutboxCountResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return isFiniteNumber(value.count);
  return value.ok === false && typeof value.error === 'string';
}

function isComposerMode(value: unknown): value is ComposerMode {
  return value === 'element' || value === 'page';
}

function isCaptureID(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isComposerPageRequest(value: unknown): value is ComposerPageRequest {
  return isRecord(value) && typeof value.url === 'string' && typeof value.title === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
