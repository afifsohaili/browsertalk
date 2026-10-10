import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PickerFeedback } from '@/lib/picker/facts';
import { countOutbox, isOutboxItem, readOutbox, type OutboxItem } from './outbox';
import { appendToOutbox, removeFromOutbox, setOutboxDestination, setOutboxItemError } from './writer';

const DESTINATION = {
  backendId: 'opencode',
  endpoint: 'http://127.0.0.1:15001',
  directory: '/home/afif/example',
} as const;

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

function elementItem(): OutboxItem {
  return {
    id: 'ob_element',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: { url: 'https://example.com/cart', path: '/cart', query: [], title: 'Cart' },
      element: {
        tag: 'button',
        id: 'checkout',
        classes: ['btn'],
        selector: 'button#checkout',
        text: 'Checkout',
        attributes: { role: 'button' },
        box: { x: 10, y: 20, width: 120, height: 32 },
        viewport: { width: 1280, height: 800 },
        scroll: { x: 0, y: 0 },
      },
      extras: { component: 'CheckoutButton', aria: { role: 'button', name: 'Checkout' } },
    },
  };
}

describe('outbox storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty before anything is queued', async () => {
    expect(await readOutbox()).toEqual([]);
    expect(await countOutbox()).toBe(0);
  });

  it('queues items in storage.local, not storage.session', async () => {
    const item = pageItem('first');
    await appendToOutbox(item);

    expect(await browser.storage.local.get('outbox')).toEqual({ outbox: [item] });
    expect(await browser.storage.session.get('outbox')).toEqual({});
    expect(await readOutbox()).toEqual([item]);
  });

  it('keeps queue order across appends', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['first', 'second']);
    expect(await countOutbox()).toBe(2);
  });

  it('treats a junk store as empty', async () => {
    await browser.storage.local.set({ outbox: 42 });
    expect(await readOutbox()).toEqual([]);

    await browser.storage.local.set({ outbox: { nope: true } });
    expect(await readOutbox()).toEqual([]);
  });

  it('drops malformed items instead of throwing', async () => {
    const valid = pageItem('valid');
    await browser.storage.local.set({
      outbox: [valid, { id: 'broken' }, null, 'nope', { ...pageItem('bad status'), status: 'sent' }],
    });

    expect(await readOutbox()).toEqual([valid]);
  });
});

describe('outbox item guard', () => {
  it('accepts page-only and element items', () => {
    expect(isOutboxItem(pageItem('hi'))).toBe(true);
    expect(isOutboxItem(elementItem())).toBe(true);
  });

  it('accepts element facts without extras', () => {
    const item = elementItem();
    const { extras: _extras, ...facts } = item.facts;
    expect(isOutboxItem({ ...item, facts })).toBe(true);
  });

  it('rejects broken shapes', () => {
    expect(isOutboxItem(null)).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), id: '' })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), comment: 7 })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), capturedAt: null })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), status: 'sent' })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), facts: {} })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), facts: { page: { url: 1 } } })).toBe(false);
  });

  it('rejects broken element facts and extras', () => {
    const item = elementItem();
    expect(isOutboxItem({ ...item, facts: { ...item.facts, element: { tag: 'button' } } })).toBe(false);
    expect(isOutboxItem({ ...item, facts: { ...item.facts, extras: { styles: { color: 1 } } } })).toBe(false);
  });

  it('accepts the facts it round-trips from a picked feedback', () => {
    const pending: PickerFeedback = {
      id: 'fb_1',
      capturedAt: '2026-10-10T09:00:00.000Z',
      page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' },
      element: {
        tag: 'a',
        id: null,
        classes: [],
        selector: 'a',
        text: 'Home',
        attributes: { href: '/' },
        box: { x: 0, y: 0, width: 40, height: 16 },
        viewport: { width: 1280, height: 800 },
        scroll: { x: 0, y: 0 },
      },
      extras: { screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 40, height: 16 } },
    };
    const item: OutboxItem = {
      id: 'ob_1',
      comment: 'Home link wraps oddly',
      capturedAt: pending.capturedAt,
      status: 'queued',
      facts: { page: pending.page, element: pending.element, extras: pending.extras },
    };

    expect(isOutboxItem(item)).toBe(true);
  });

  it('accepts an item carrying a send error and rejects a broken one', () => {
    expect(isOutboxItem({ ...pageItem('hi'), error: 'Not paired' })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), error: 7 })).toBe(false);
  });

  it('accepts an item with a captured destination and rejects a broken one', () => {
    expect(isOutboxItem({ ...pageItem('hi'), destination: DESTINATION })).toBe(true);
    expect(isOutboxItem(pageItem('hi'))).toBe(true);
    expect(
      isOutboxItem({ ...pageItem('hi'), destination: { ...DESTINATION, backendId: 'from-a-newer-version' } }),
    ).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), destination: { ...DESTINATION, backendId: '' } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), destination: { ...DESTINATION, endpoint: '' } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), destination: { ...DESTINATION, directory: 7 } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), destination: 'nonsense' })).toBe(false);
  });

  it('accepts an item with an attempt and an admission, and rejects broken ones', () => {
    const attempt = { requestID: 'req_1', sentAt: '2026-10-10T09:00:00.000Z' };
    const admission = {
      requestID: 'req_1',
      messageID: 'msg_1',
      sessionID: 'ses_1',
      sessionTitle: 'Browsertalk · example · 2026-10-10',
      admittedAt: '2026-10-10T09:00:01.000Z',
    };

    expect(isOutboxItem({ ...pageItem('hi'), attempt })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), attempt, admission })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), attempt, admission: { ...admission, messageID: null } })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), attempt: { requestID: '', sentAt: attempt.sentAt } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), attempt: { requestID: 'req_1' } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), attempt: 'nonsense' })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), admission })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), admission: { ...admission, messageID: 7 } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), admission: { ...admission, sessionID: '' } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), admission: { ...admission, sessionTitle: 7 } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), admission: { ...admission, admittedAt: '' } })).toBe(false);
    expect(isOutboxItem({ ...pageItem('hi'), admission: 'nonsense' })).toBe(false);
  });

  it('accepts a frozen admission input on an attempt and rejects broken ones', () => {
    const attempt = { requestID: 'req_1', sentAt: '2026-10-10T09:00:00.000Z' };
    const admissionInput = {
      sessionID: 'ses_1',
      sessionTitle: 'Browsertalk · example · 2026-10-10',
      text: '## Browser feedback — example',
      delivery: 'queue',
      files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png' }],
    };

    expect(isOutboxItem({ ...pageItem('hi'), attempt: { ...attempt, admissionInput } })).toBe(true);
    expect(isOutboxItem({ ...pageItem('hi'), attempt })).toBe(true);
    expect(
      isOutboxItem({ ...pageItem('hi'), attempt: { ...attempt, admissionInput: { ...admissionInput, sessionID: '' } } }),
    ).toBe(false);
    expect(
      isOutboxItem({ ...pageItem('hi'), attempt: { ...attempt, admissionInput: { ...admissionInput, sessionTitle: 7 } } }),
    ).toBe(false);
    expect(
      isOutboxItem({ ...pageItem('hi'), attempt: { ...attempt, admissionInput: { ...admissionInput, delivery: 'soon' } } }),
    ).toBe(false);
    expect(
      isOutboxItem({
        ...pageItem('hi'),
        attempt: { ...attempt, admissionInput: { ...admissionInput, files: [{ name: 'element.png' }] } },
      }),
    ).toBe(false);
    expect(
      isOutboxItem({ ...pageItem('hi'), attempt: { ...attempt, admissionInput: 'nonsense' } }),
    ).toBe(false);
  });
});

describe('outbox mutations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('removes one item by id and keeps the rest in order', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));
    await appendToOutbox(pageItem('third'));

    await removeFromOutbox('ob_second');

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['first', 'third']);
  });

  it('no-ops when the id is not in the outbox', async () => {
    await appendToOutbox(pageItem('first'));

    await removeFromOutbox('ob_missing');

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['first']);
  });

  it('records a send error on one item without touching the others', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));

    await setOutboxItemError('ob_second', 'The opencode server returned HTTP 500');

    expect(await readOutbox()).toEqual([
      pageItem('first'),
      { ...pageItem('second'), error: 'The opencode server returned HTTP 500' },
    ]);
  });

  it('replaces an older error on a retried item', async () => {
    await appendToOutbox({ ...pageItem('first'), error: 'old error' });

    await setOutboxItemError('ob_first', 'new error');

    expect((await readOutbox())[0]?.error).toBe('new error');
  });

  it('records the captured destination on one item without touching the others', async () => {
    await appendToOutbox(pageItem('first'));
    await appendToOutbox(pageItem('second'));

    await setOutboxDestination('ob_second', DESTINATION);

    expect(await readOutbox()).toEqual([
      pageItem('first'),
      { ...pageItem('second'), destination: DESTINATION },
    ]);
  });

  it('keeps the destination when a later error is recorded', async () => {
    await appendToOutbox({ ...pageItem('first'), destination: DESTINATION });

    await setOutboxItemError('ob_first', 'Not paired');

    expect(await readOutbox()).toEqual([
      { ...pageItem('first'), destination: DESTINATION, error: 'Not paired' },
    ]);
  });
});
