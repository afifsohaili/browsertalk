import { isRecord } from '@/lib/picker/facts';

export interface ComposerPageRequest {
  url: string;
  title: string;
}

export interface ComposerQueueRequest {
  type: 'composer/queue';
  comment: string;
  page: ComposerPageRequest;
  captureID: string;
  elementCount: number;
}

export interface ComposerRemoveRequest {
  type: 'composer/remove';
  captureID: string;
  index: number;
}

export type ComposerRequest =
  | ComposerQueueRequest
  | ComposerRemoveRequest
  | { type: 'outbox/page-comment'; comment: string }
  | { type: 'outbox/count' };

export interface OutboxChangedEvent {
  type: 'outbox/changed';
}

export type ComposerMessage = ComposerRequest | OutboxChangedEvent;

export type ComposerQueueResult =
  | { ok: true; outboxCount: number; screenshotDropped?: boolean }
  | { ok: false; error: string };

export type ComposerRemoveResult = { ok: true; elementCount: number } | { ok: false; error: string };

export type OutboxCountResult = { ok: true; count: number } | { ok: false; error: string };

export function isComposerRequest(value: unknown): value is ComposerRequest {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'outbox/count':
      return true;
    case 'outbox/page-comment':
      return typeof value.comment === 'string';
    case 'composer/queue':
      return (
        typeof value.comment === 'string' &&
        isComposerPageRequest(value.page) &&
        isCaptureID(value.captureID) &&
        isElementCount(value.elementCount)
      );
    case 'composer/remove':
      return isCaptureID(value.captureID) && isPickIndex(value.index);
    default:
      return false;
  }
}

export function isOutboxChanged(value: unknown): value is OutboxChangedEvent {
  return isRecord(value) && value.type === 'outbox/changed';
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

export function isComposerRemoveResult(value: unknown): value is ComposerRemoveResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) {
    return typeof value.elementCount === 'number' && Number.isInteger(value.elementCount) && value.elementCount >= 0;
  }
  return value.ok === false && typeof value.error === 'string';
}

function isCaptureID(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isElementCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isPickIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isComposerPageRequest(value: unknown): value is ComposerPageRequest {
  return isRecord(value) && typeof value.url === 'string' && typeof value.title === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
