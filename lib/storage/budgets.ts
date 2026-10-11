import { elementAttachment } from '@/lib/send/attachments';
import { renderPrompt } from '@/lib/send/prompt';
import type { OutboxItem } from './outbox';

export const MAX_OUTBOX_BYTES = 5_000_000;
export const MAX_SENT_BYTES = 1_000_000;
export const OUTBOX_METADATA_HEADROOM_BYTES = 4_096;

export class OutboxFullError extends Error {
  constructor() {
    super('The outbox is at its size limit — discard some queued feedback and try again');
    this.name = 'OutboxFullError';
  }
}

const encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

export function jsonByteSize(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value));
}

export function outboxSize(items: readonly unknown[]): number {
  return jsonByteSize(items);
}

/** Cut a string so that its JSON string form fits `maxBytes`, never splitting a code point. */
export function truncateJsonString(value: string, maxBytes: number): string {
  if (jsonByteSize(value) - 2 <= maxBytes) return value;

  let length = Math.min(value.length, Math.max(maxBytes, 0));
  while (length > 0) {
    const last = value.charCodeAt(length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      length -= 1;
      continue;
    }
    const candidate = value.slice(0, length);
    const size = jsonByteSize(candidate) - 2;
    if (size <= maxBytes) return candidate;
    length = Math.min(length - 1, Math.floor((length * maxBytes) / size));
  }
  return '';
}

const ESTIMATE_SENT_AT = '1970-01-01T00:00:00.000Z';
const ESTIMATE_PROJECT_NAME = 'x'.repeat(255);

export function deliveryReadySize(items: readonly OutboxItem[]): number {
  const overhead = items.reduce((total, item) => total + itemDeliveryOverhead(item), 0);
  return jsonByteSize(items) + overhead;
}

function itemDeliveryOverhead(item: OutboxItem): number {
  let bytes = OUTBOX_METADATA_HEADROOM_BYTES;
  if (item.attempt?.admissionInput !== undefined) return bytes;

  const text = renderPrompt({ projectName: ESTIMATE_PROJECT_NAME, item, sentAt: ESTIMATE_SENT_AT });
  bytes += utf8ByteLength(JSON.stringify(text));

  const attachment = elementAttachment(item.facts.extras);
  if (attachment !== null) bytes += utf8ByteLength(JSON.stringify([attachment]));
  return bytes;
}

export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof OutboxFullError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'QuotaExceededError' || /quota/i.test(error.message);
}
