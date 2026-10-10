import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { MAX_OUTBOX_BYTES, outboxSize, OutboxFullError } from './budgets';
import { getStoredSession, type StoredSession } from './sessions';
import { readOutbox, type OutboxItem } from './outbox';
import { readSent, type SentItem } from './sent';
import {
  appendToOutbox,
  commitDeliveredItem,
  removeFromOutbox,
  setOutboxAdmission,
  setOutboxAttempt,
  writeStoredSession,
} from './writer';

function pageItem(comment: string): OutboxItem {
  return {
    id: `ob_${comment}`,
    comment,
    capturedAt: '2026-10-10T09:00:00.000Z',
    status: 'queued',
    facts: {
      page: {
        url: 'https://example.com/cart?step=2',
        path: '/cart',
        query: [{ name: 'step', value: '2' }],
        title: 'Cart',
      },
    },
  };
}

function sentItem(id: string): SentItem {
  return {
    id,
    comment: id,
    sentAt: '2026-10-10T09:00:00.000Z',
    session: { id: 'ses_1', title: 'Browsertalk · example · 2026-10-10' },
    page: { title: 'Cart', url: 'https://example.com/cart' },
  };
}

describe('serialized storage writer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('keeps every append when appends interleave', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(pageItem);

    await Promise.all(items.map((item) => appendToOutbox(item)));

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps every item when appends and removals interleave', async () => {
    for (const comment of ['a', 'b', 'c', 'd', 'e']) await appendToOutbox(pageItem(comment));

    await Promise.all([
      removeFromOutbox('ob_a'),
      removeFromOutbox('ob_e'),
      appendToOutbox(pageItem('f')),
      appendToOutbox(pageItem('g')),
    ]);

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['b', 'c', 'd', 'f', 'g']);
  });

  it('commits the outbox removal and the sent append in one write', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));

    await commitDeliveredItem({ itemId: 'ob_first', sent: sentItem('ob_first') });

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['second']);
    expect((await readSent()).map((item) => item.id)).toEqual(['ob_first']);
  });

  it('leaves both keys untouched when the commit write rejects', async () => {
    await appendToOutbox(pageItem('first'));
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(
      commitDeliveredItem({ itemId: 'ob_first', sent: sentItem('ob_first') }),
    ).rejects.toThrow('quota exceeded');

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['first']);
    expect(await readSent()).toEqual([]);
    setSpy.mockRestore();
  });

  it('keeps running later writes when one write rejects', async () => {
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(appendToOutbox(pageItem('rejected'))).rejects.toThrow('quota exceeded');
    setSpy.mockRestore();

    await appendToOutbox(pageItem('after'));

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['after']);
  });

  it('rejects an append that would push the outbox past its byte budget', async () => {
    const seed = pageItem('seed');
    const overhead = outboxSize([{ ...seed, comment: '' }]);
    seed.comment = 'x'.repeat(MAX_OUTBOX_BYTES - overhead - 10);
    await appendToOutbox(seed);

    await expect(appendToOutbox(pageItem('overflow'))).rejects.toBeInstanceOf(OutboxFullError);
    expect((await readOutbox()).map((item) => item.comment)).toEqual([seed.comment]);
  });

  it('keeps every session ref when session writes interleave', async () => {
    const refA: StoredSession = { sessionID: 'ses_a', title: 'A', generation: 0 };
    const refB: StoredSession = { sessionID: 'ses_b', title: 'B', generation: 1 };
    const refC: StoredSession = { sessionID: 'ses_c', title: 'C', generation: 0 };

    await Promise.all([
      writeStoredSession('fake@http://127.0.0.1:15001', 'per-day', 'day-a', refA),
      writeStoredSession('fake@http://127.0.0.1:15001', 'per-day', 'day-b', refB),
      writeStoredSession('fake@http://127.0.0.1:4096', 'sticky', 'dir', refC),
    ]);

    expect(await getStoredSession('fake@http://127.0.0.1:15001', 'per-day', 'day-a')).toEqual(refA);
    expect(await getStoredSession('fake@http://127.0.0.1:15001', 'per-day', 'day-b')).toEqual(refB);
    expect(await getStoredSession('fake@http://127.0.0.1:4096', 'sticky', 'dir')).toEqual(refC);
  });

  it('records the attempt and the admission on one item without touching the others', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));
    const attempt = { requestID: 'req_1', sentAt: '2026-10-10T09:00:00.000Z' };
    const admission = {
      requestID: 'req_1',
      messageID: 'msg_1',
      sessionID: 'ses_1',
      sessionTitle: 'Browsertalk · example · 2026-10-10',
      admittedAt: '2026-10-10T09:00:01.000Z',
    };

    await setOutboxAttempt('ob_second', attempt);
    await setOutboxAdmission('ob_second', admission);

    expect(await readOutbox()).toEqual([
      pageItem('first'),
      { ...pageItem('second'), attempt, admission },
    ]);
  });
});
