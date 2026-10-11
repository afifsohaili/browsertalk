import { describe, expect, it } from 'vitest';
import type { OutboxItem } from './outbox';
import {
  deliveryReadySize,
  isQuotaExceeded,
  MAX_OUTBOX_BYTES,
  OUTBOX_METADATA_HEADROOM_BYTES,
  outboxSize,
  OutboxFullError,
  truncateJsonString,
} from './budgets';

function pageItem(comment: string): OutboxItem {
  return {
    id: 'ob_1',
    comment,
    capturedAt: '2026-10-10T09:00:00.000Z',
    status: 'queued',
    facts: { page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' } },
  };
}

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

describe('JSON string truncation', () => {
  it('keeps a value whose JSON form already fits', () => {
    expect(truncateJsonString('hello', 5)).toBe('hello');
    expect(truncateJsonString('漢', 3)).toBe('漢');
  });

  it('cuts ASCII to the byte budget', () => {
    expect(truncateJsonString('x'.repeat(100), 10)).toBe('x'.repeat(10));
  });

  it('cuts multibyte text without splitting a character', () => {
    const kept = truncateJsonString('漢'.repeat(10), 10);

    expect(kept).toBe('漢'.repeat(3));
    expect(JSON.stringify(kept).length - 2).toBeLessThanOrEqual(10);
  });

  it('counts JSON escape bytes, not raw characters', () => {
    const kept = truncateJsonString('\n'.repeat(10), 4);

    expect(kept).toBe('\n\n');
    expect(JSON.stringify(kept).length - 2).toBeLessThanOrEqual(4);
  });

  it('truncates to nothing under a zero budget', () => {
    expect(truncateJsonString('hello', 0)).toBe('');
  });
});

describe('delivery-ready budget accounting', () => {
  it('reserves the frozen admission input and receipt metadata on top of the stored bytes', () => {
    const empty = pageItem('');
    const one = pageItem('x');
    const eleven = pageItem('x'.repeat(11));

    expect(deliveryReadySize([empty])).toBeGreaterThanOrEqual(outboxSize([empty]) + OUTBOX_METADATA_HEADROOM_BYTES);
    expect(deliveryReadySize([eleven]) - deliveryReadySize([one])).toBe(2 * 10);
  });

  it('does not double-count an item that already carries its frozen admission input', () => {
    const frozen: OutboxItem = {
      ...pageItem('hello'),
      attempt: {
        requestID: 'req_1',
        sentAt: '2026-10-10T09:00:00.000Z',
        admissionInput: {
          sessionID: 'ses_1',
          sessionTitle: 'Browsertalk · example · 2026-10-10',
          text: 'hello',
          delivery: 'queue',
        },
      },
    };

    expect(deliveryReadySize([frozen])).toBe(outboxSize([frozen]) + OUTBOX_METADATA_HEADROOM_BYTES);
  });

  it('counts the screenshot attachment duplication when the pick carries one', () => {
    const plain = pageItem('');
    const withShot = pageItem('');
    withShot.facts.extras = {
      screenshot: { dataUrl: `data:image/png;base64,${'A'.repeat(100)}`, width: 10, height: 10 },
    };

    expect(deliveryReadySize([withShot]) - deliveryReadySize([plain])).toBeGreaterThan(100);
  });
});
