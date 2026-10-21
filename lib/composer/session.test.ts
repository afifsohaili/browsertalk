// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComposerQueueResult, ComposerRemoveResult } from './protocol';
import {
  COMPOSER_HOST_ID,
  createComposerSession,
  type ComposerSession,
  type ComposerSessionOptions,
  type ComposerSetElement,
} from './session';

interface ComposerSpies {
  queue: ReturnType<typeof vi.fn<ComposerSessionOptions['queue']>>;
  remove: ReturnType<typeof vi.fn<ComposerSessionOptions['remove']>>;
  onClose: ReturnType<typeof vi.fn<() => void>>;
}

const live: ComposerSession[] = [];

function spies(): ComposerSpies {
  return {
    queue: vi.fn(async () => ({ ok: true, outboxCount: 1 }) as ComposerQueueResult),
    remove: vi.fn(async () => ({ ok: true, elementCount: 0 }) as ComposerRemoveResult),
    onClose: vi.fn(),
  };
}

function element(index: number, label: string): ComposerSetElement {
  const node = document.createElement('button');
  node.textContent = label;
  document.body.append(node);
  return { element: node, label, index };
}

function mount(entries: ComposerSetElement[], anchor?: Element): ComposerSession {
  const session = createComposerSession(spies());
  live.push(session);
  session.openSet({ elements: entries, anchor: anchor ?? entries[0]?.element ?? document.body });
  return session;
}

function host(): HTMLElement | null {
  return document.getElementById(COMPOSER_HOST_ID);
}

function textarea(): HTMLTextAreaElement | null {
  return host()?.querySelector('textarea') ?? null;
}

function queueButton(): HTMLButtonElement | null {
  const buttons = Array.from(host()?.querySelectorAll('button') ?? []);
  return buttons.find((button) => button.textContent === 'Queue' || button.textContent === 'Queueing…') ?? null;
}

function removeButtons(): HTMLButtonElement[] {
  return Array.from(host()?.querySelectorAll('button[aria-label^="Remove "]') ?? []);
}

function chipLabels(): string[] {
  return removeButtons().map((button) => button.previousElementSibling?.textContent ?? '');
}

function countText(): string {
  return (
    Array.from(host()?.querySelectorAll('div') ?? [])
      .map((node) => node.textContent ?? '')
      .find((text) => /^\d+ elements?$/.test(text)) ?? ''
  );
}

function emptyText(): string {
  return (
    Array.from(host()?.querySelectorAll('div') ?? [])
      .map((node) => node.textContent ?? '')
      .find((text) => text.startsWith('No elements left')) ?? ''
  );
}

function type(value: string): void {
  const field = textarea();
  if (field === null) throw new Error('composer textarea missing');
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

function click(button: HTMLButtonElement | null | undefined): void {
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const session of live.splice(0)) session.close();
  document.getElementById(COMPOSER_HOST_ID)?.remove();
  document.body.innerHTML = '';
});

describe('composer open set', () => {
  it('opens one element with a chip, count, focus, and an enabled queue', () => {
    const session = mount([element(0, 'button#checkout · "Checkout"')]);

    expect(session.isOpen()).toBe(true);
    expect(countText()).toBe('1 element');
    expect(chipLabels()).toEqual(['button#checkout · "Checkout"']);
    expect(textarea()).toBe(document.activeElement);
    expect(queueButton()?.disabled).toBe(false);
  });

  it('opens three elements with three chips and a set count', () => {
    mount([element(0, 'button#checkout'), element(2, 'h1.title'), element(5, 'article.card')]);

    expect(countText()).toBe('3 elements');
    expect(chipLabels()).toEqual(['button#checkout', 'h1.title', 'article.card']);
    expect(removeButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove button#checkout',
      'Remove h1.title',
      'Remove article.card',
    ]);
  });

  it('shows the empty state and disables the queue for an empty set', () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [], anchor: document.body });

    expect(emptyText()).toBe('No elements left. Close and pick again.');
    expect(countText()).toBe('');
    expect(chipLabels()).toEqual([]);
    expect(queueButton()?.disabled).toBe(true);

    type('Nothing to send');
    click(queueButton());
    textarea()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(spiesForTest.queue).not.toHaveBeenCalled();
  });

  it('replaces an already open composer', () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);

    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });
    session.openSet({ elements: [element(1, 'h1.title')], anchor: document.body });

    expect(spiesForTest.onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(`#${COMPOSER_HOST_ID}`)).toHaveLength(1);
    expect(chipLabels()).toEqual(['h1.title']);
  });
});

describe('composer queueing', () => {
  it('queues the trimmed comment with the set count', async () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({
      elements: [element(0, 'button#checkout'), element(1, 'h1.title'), element(2, 'article.card')],
      anchor: document.body,
    });

    type('  All three look off  ');
    click(queueButton());
    await vi.waitFor(() => expect(spiesForTest.queue).toHaveBeenCalledTimes(1));

    expect(spiesForTest.queue).toHaveBeenCalledWith('All three look off', 3);
    await vi.waitFor(() => expect(host()?.textContent).toBe('Queued'));
  });

  it('queues on Enter in the textarea only', async () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    type('Button is misaligned');
    textarea()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(spiesForTest.queue).toHaveBeenCalledWith('Button is misaligned', 1));

    spiesForTest.queue.mockClear();
    type('Shift should not send');
    textarea()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    await Promise.resolve();

    expect(spiesForTest.queue).not.toHaveBeenCalled();
    expect(session.isOpen()).toBe(true);
  });

  it('disables the queue while the background is busy', async () => {
    let finish: (result: ComposerQueueResult) => void = () => {};
    const spiesForTest = spies();
    spiesForTest.queue.mockImplementation(
      () =>
        new Promise<ComposerQueueResult>((resolve) => {
          finish = resolve;
        }),
    );
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    type('Fix this');
    click(queueButton());

    await vi.waitFor(() => expect(queueButton()?.textContent).toBe('Queueing…'));
    expect(queueButton()?.disabled).toBe(true);

    finish({ ok: true, outboxCount: 1 });
    await vi.waitFor(() => expect(host()?.textContent).toBe('Queued'));
  });

  it('shows the queue error and keeps the composer open', async () => {
    const spiesForTest = spies();
    spiesForTest.queue.mockResolvedValue({ ok: false, error: 'Background unavailable' });
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    type('Fix this');
    click(queueButton());
    await vi.waitFor(() => expect(host()?.textContent).toContain('Background unavailable'));

    expect(session.isOpen()).toBe(true);
    expect(chipLabels()).toEqual(['button#checkout']);
  });

  it('reports the dropped screenshot in the confirmation', async () => {
    const spiesForTest = spies();
    spiesForTest.queue.mockResolvedValue({ ok: true, outboxCount: 1, screenshotDropped: true });
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    type('Fix this');
    click(queueButton());

    await vi.waitFor(() =>
      expect(host()?.textContent).toBe('Queued without the screenshot — storage is full'),
    );
  });
});

describe('composer chip removal', () => {
  it('removes one chip, updates the count, and refocuses the comment', async () => {
    const spiesForTest = spies();
    spiesForTest.remove.mockResolvedValue({ ok: true, elementCount: 2 });
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({
      elements: [element(0, 'button#checkout'), element(4, 'h1.title'), element(7, 'article.card')],
      anchor: document.body,
    });

    click(removeButtons()[1]);
    await vi.waitFor(() => expect(chipLabels()).toEqual(['button#checkout', 'article.card']));

    expect(spiesForTest.remove).toHaveBeenCalledWith(4);
    expect(countText()).toBe('2 elements');
    expect(textarea()).toBe(document.activeElement);
  });

  it('shows the empty state and disables the queue after the last chip goes', async () => {
    const spiesForTest = spies();
    spiesForTest.remove.mockResolvedValue({ ok: true, elementCount: 0 });
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    click(removeButtons()[0]);
    await vi.waitFor(() => expect(emptyText()).toBe('No elements left. Close and pick again.'));

    expect(chipLabels()).toEqual([]);
    expect(countText()).toBe('');
    expect(queueButton()?.disabled).toBe(true);
    expect(session.isOpen()).toBe(true);
  });

  it('keeps the chip and shows the error when the background refuses', async () => {
    const spiesForTest = spies();
    spiesForTest.remove.mockResolvedValue({ ok: false, error: 'No picked element to comment on' });
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout'), element(1, 'h1.title')], anchor: document.body });

    click(removeButtons()[0]);
    await vi.waitFor(() => expect(host()?.textContent).toContain('No picked element to comment on'));

    expect(chipLabels()).toEqual(['button#checkout', 'h1.title']);
    expect(countText()).toBe('2 elements');
  });

  it('drops only one chip when the same remove button is clicked twice', async () => {
    const spiesForTest = spies();
    let release: (result: ComposerRemoveResult) => void = () => {};
    spiesForTest.remove.mockImplementation(
      () =>
        new Promise<ComposerRemoveResult>((resolve) => {
          release = resolve;
        }),
    );
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout'), element(1, 'h1.title')], anchor: document.body });

    const target = removeButtons()[0];
    click(target);
    click(target);

    expect(spiesForTest.remove).toHaveBeenCalledTimes(2);

    release({ ok: true, elementCount: 1 });
    await vi.waitFor(() => expect(chipLabels()).toEqual(['h1.title']));
  });
});

describe('composer closing', () => {
  it('closes on Escape and reports it once', () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(session.isOpen()).toBe(false);
    expect(host()).toBeNull();
    expect(spiesForTest.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes once and stays closed', () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    session.close();
    session.close();

    expect(spiesForTest.onClose).toHaveBeenCalledTimes(1);
    expect(session.isOpen()).toBe(false);
  });

  it('ignores keys while an IME composition is active', () => {
    const spiesForTest = spies();
    const session = createComposerSession(spiesForTest);
    live.push(session);
    session.openSet({ elements: [element(0, 'button#checkout')], anchor: document.body });

    const composing = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(composing, 'isComposing', { value: true });
    window.dispatchEvent(composing);

    expect(session.isOpen()).toBe(true);
  });
});
