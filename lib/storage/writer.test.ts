import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { renderPrompt } from '@/lib/send/prompt';
import { deliveryReadySize, jsonByteSize, MAX_OUTBOX_BYTES, MAX_SENT_BYTES, outboxSize, OutboxFullError } from './budgets';
import { getStoredSession, type StoredSession } from './sessions';
import { readOutbox, type OutboxItem } from './outbox';
import { readSent, type SentItem } from './sent';
import {
  appendToOutbox,
  appendToSent,
  commitDeliveredItem,
  OutboxReservedError,
  removeFromOutbox,
  reserveOutboxItem,
  setOutboxAdmission,
  setOutboxAttempt,
  setOutboxItemError,
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

function maxAcceptedItem(): OutboxItem {
  const seed = pageItem('seed');
  const one = { ...seed, comment: 'x' };
  const base = deliveryReadySize([one]);
  const perChar = deliveryReadySize([{ ...seed, comment: 'xx' }]) - base;
  seed.comment = 'x'.repeat(1 + Math.floor((MAX_OUTBOX_BYTES - base) / perChar));
  return seed;
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

  it('reserves a queued item on the writer queue', async () => {
    await appendToOutbox(pageItem('first'));

    await expect(reserveOutboxItem('ob_first', new Date('2026-10-10T09:30:00.000Z'))).resolves.toBe(true);

    expect((await readOutbox())[0]?.reservedAt).toBe('2026-10-10T09:30:00.000Z');
    await expect(reserveOutboxItem('ob_missing')).resolves.toBe(false);
  });

  it('refuses a discard while the reservation is held, and releases it when the attempt fails', async () => {
    await appendToOutbox(pageItem('first'));
    await reserveOutboxItem('ob_first', new Date('2026-10-10T09:30:00.000Z'));

    await expect(removeFromOutbox('ob_first')).rejects.toBeInstanceOf(OutboxReservedError);
    expect((await readOutbox()).map((item) => item.id)).toEqual(['ob_first']);

    await setOutboxItemError('ob_first', 'Not paired');
    expect((await readOutbox())[0]?.reservedAt).toBeUndefined();

    await removeFromOutbox('ob_first');
    expect(await readOutbox()).toEqual([]);
  });

  it('loses a reservation race to a discard that reached the writer first', async () => {
    await appendToOutbox(pageItem('first'));

    const discard = removeFromOutbox('ob_first');
    const reservation = reserveOutboxItem('ob_first');

    await discard;
    await expect(reservation).resolves.toBe(false);
    expect(await readOutbox()).toEqual([]);
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

  it('rejects a comment that cannot fit its own frozen admission input', async () => {
    const huge = pageItem('huge');
    huge.comment = 'x'.repeat(2_600_000);

    expect(outboxSize([huge])).toBeLessThan(MAX_OUTBOX_BYTES);
    await expect(appendToOutbox(huge)).rejects.toBeInstanceOf(OutboxFullError);
    expect(await readOutbox()).toEqual([]);
  });

  it('rejects an append that would push the delivery-ready outbox past its byte budget', async () => {
    const seed = maxAcceptedItem();
    await appendToOutbox(seed);

    await expect(appendToOutbox(pageItem('overflow'))).rejects.toBeInstanceOf(OutboxFullError);
    expect((await readOutbox()).map((item) => item.id)).toEqual([seed.id]);
  });

  it('rejects an append whose multibyte text exceeds the budget in bytes', async () => {
    const huge = pageItem('cjk');
    huge.comment = '漢'.repeat(3_500_000);

    expect(JSON.stringify([huge]).length).toBeLessThan(MAX_OUTBOX_BYTES);
    expect(Buffer.byteLength(JSON.stringify([huge]), 'utf8')).toBeGreaterThan(MAX_OUTBOX_BYTES);

    await expect(appendToOutbox(huge)).rejects.toBeInstanceOf(OutboxFullError);
    expect(await readOutbox()).toEqual([]);
  });

  it('leaves room for the frozen input and receipt metadata of an item accepted at the limit', async () => {
    const seed = maxAcceptedItem();
    await appendToOutbox(seed);
    const attempt = {
      requestID: 'req_1',
      sentAt: '2026-10-10T09:00:00.000Z',
      admissionInput: {
        sessionID: 'ses_1',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        text: renderPrompt({ projectName: 'example', item: seed, sentAt: '2026-10-10T09:00:00.000Z' }),
        delivery: 'queue' as const,
      },
    };

    await expect(setOutboxAttempt(seed.id, attempt)).resolves.toBeUndefined();
    await expect(
      setOutboxAdmission(seed.id, {
        requestID: 'req_1',
        messageID: 'msg_1',
        sessionID: 'ses_1',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        admittedAt: '2026-10-10T09:00:01.000Z',
      }),
    ).resolves.toBeUndefined();
    await expect(setOutboxItemError(seed.id, 'The server rejected the prompt')).resolves.toBeUndefined();

    const stored = (await readOutbox())[0];
    expect(stored?.attempt).toEqual(attempt);
    expect(stored?.admission?.messageID).toBe('msg_1');
    expect(stored?.error).toBe('The server rejected the prompt');
    expect(jsonByteSize(stored === undefined ? [] : [stored])).toBeLessThanOrEqual(MAX_OUTBOX_BYTES);
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

  it('bounds retained sent history by bytes', async () => {
    const bulky = (id: string): SentItem => ({ ...sentItem(id), comment: '漢'.repeat(200_000) });

    await appendToSent(bulky('a'));
    await appendToSent(bulky('b'));
    await appendToSent(bulky('c'));

    const history = await readSent();
    expect(history.map((item) => item.id)).toEqual(['c']);
    expect(Buffer.byteLength(JSON.stringify(history), 'utf8')).toBeLessThanOrEqual(MAX_SENT_BYTES);
  });

  it('bounds the sent history by bytes when a delivery commits', async () => {
    await appendToSent({ ...sentItem('seeded'), comment: '漢'.repeat(300_000) });
    await appendToOutbox(pageItem('first'));

    await commitDeliveredItem({ itemId: 'ob_first', sent: { ...sentItem('ob_first'), comment: '漢'.repeat(100_000) } });

    const history = await readSent();
    expect(history.map((item) => item.id)).toEqual(['ob_first']);
    expect(Buffer.byteLength(JSON.stringify(history), 'utf8')).toBeLessThanOrEqual(MAX_SENT_BYTES);
  });

  it('records the attempt and the admission on one item without touching the others', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));
    const attempt = {
      requestID: 'req_1',
      sentAt: '2026-10-10T09:00:00.000Z',
      admissionInput: {
        sessionID: 'ses_1',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        text: '## Browser feedback — example',
        delivery: 'queue' as const,
      },
    };
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
