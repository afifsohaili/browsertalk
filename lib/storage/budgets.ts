export const MAX_OUTBOX_BYTES = 5_000_000;

export class OutboxFullError extends Error {
  constructor() {
    super('The outbox is at its size limit — discard some queued feedback and try again');
    this.name = 'OutboxFullError';
  }
}

export function outboxSize(items: readonly unknown[]): number {
  return JSON.stringify(items).length;
}

export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof OutboxFullError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'QuotaExceededError' || /quota/i.test(error.message);
}
