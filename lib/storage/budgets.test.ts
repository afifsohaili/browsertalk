import { describe, expect, it } from 'vitest';
import { isQuotaExceeded, MAX_OUTBOX_BYTES, outboxSize, OutboxFullError } from './budgets';

describe('outbox budget helpers', () => {
  it('measures the JSON size of the stored items in UTF-8 bytes', () => {
    expect(outboxSize([])).toBe(2);
    expect(outboxSize([{ a: 1 }])).toBe(Buffer.byteLength(JSON.stringify([{ a: 1 }]), 'utf8'));
  });

  it('counts multibyte characters as their UTF-8 bytes', () => {
    const items = [{ comment: '漢'.repeat(1_800_000) }];

    expect(JSON.stringify(items).length).toBeLessThan(MAX_OUTBOX_BYTES);
    expect(outboxSize(items)).toBeGreaterThan(MAX_OUTBOX_BYTES);
  });

  it('treats the outbox budget error as quota exceeded', () => {
    expect(isQuotaExceeded(new OutboxFullError())).toBe(true);
  });

  it('treats browser quota errors as quota exceeded', () => {
    expect(isQuotaExceeded(new Error('QUOTA_BYTES quota exceeded'))).toBe(true);

    const named = new Error('storage write failed');
    named.name = 'QuotaExceededError';
    expect(isQuotaExceeded(named)).toBe(true);
  });

  it('leaves other errors alone', () => {
    expect(isQuotaExceeded(new Error('permission denied'))).toBe(false);
    expect(isQuotaExceeded('quota')).toBe(false);
    expect(isQuotaExceeded(null)).toBe(false);
  });
});
