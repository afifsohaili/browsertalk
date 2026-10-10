export const MAX_OUTBOX_BYTES = 5_000_000;
export const MAX_SENT_BYTES = 1_000_000;

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

export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof OutboxFullError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'QuotaExceededError' || /quota/i.test(error.message);
}
