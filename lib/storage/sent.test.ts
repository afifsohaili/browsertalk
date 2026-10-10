import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { appendToSent, countSent, isSentItem, readSent, SENT_LIMIT, type SentItem } from './sent';

function sentItem(n: number): SentItem {
  return {
    id: `ob_${n}`,
    comment: `comment ${n}`,
    sentAt: `2026-10-10T09:${String(n).padStart(2, '0')}:00.000Z`,
    session: { id: `ses_${n}`, title: 'Browsertalk · example · 2026-10-10' },
    page: { title: 'Cart', url: `https://example.com/cart?n=${n}` },
  };
}

describe('sent storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty before anything is sent', async () => {
    expect(await readSent()).toEqual([]);
    expect(await countSent()).toBe(0);
  });

  it('stores summaries under the sent key, newest first', async () => {
    await appendToSent(sentItem(1));
    await appendToSent(sentItem(2));

    expect(await browser.storage.local.get('sent')).toEqual({ sent: [sentItem(2), sentItem(1)] });
    expect((await readSent()).map((item) => item.id)).toEqual(['ob_2', 'ob_1']);
    expect(await countSent()).toBe(2);
  });

  it('caps the log, dropping the oldest summaries', async () => {
    for (let n = 1; n <= SENT_LIMIT + 3; n += 1) await appendToSent(sentItem(n));

    const items = await readSent();
    expect(items).toHaveLength(SENT_LIMIT);
    expect(items[0]?.id).toBe(`ob_${SENT_LIMIT + 3}`);
    expect(items.at(-1)?.id).toBe('ob_4');
  });

  it('treats a junk store as empty', async () => {
    await browser.storage.local.set({ sent: 42 });
    expect(await readSent()).toEqual([]);

    await browser.storage.local.set({ sent: { nope: true } });
    expect(await readSent()).toEqual([]);
  });

  it('drops malformed summaries instead of throwing', async () => {
    const valid = sentItem(1);
    await browser.storage.local.set({
      sent: [valid, { id: 'broken' }, null, { ...sentItem(2), session: {} }, { ...sentItem(3), sentAt: 7 }],
    });

    expect(await readSent()).toEqual([valid]);
  });
});

describe('sent item guard', () => {
  it('accepts a well-formed summary', () => {
    expect(isSentItem(sentItem(1))).toBe(true);
  });

  it('rejects broken shapes', () => {
    expect(isSentItem(null)).toBe(false);
    expect(isSentItem({ ...sentItem(1), id: '' })).toBe(false);
    expect(isSentItem({ ...sentItem(1), comment: 7 })).toBe(false);
    expect(isSentItem({ ...sentItem(1), sentAt: null })).toBe(false);
    expect(isSentItem({ ...sentItem(1), session: { id: 'ses_1' } })).toBe(false);
    expect(isSentItem({ ...sentItem(1), page: { url: 'https://example.com/' } })).toBe(false);
  });
});
