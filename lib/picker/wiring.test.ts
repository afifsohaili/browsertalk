// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComposerPageRequest, ComposerQueueResult, ComposerRemoveResult } from '@/lib/composer/protocol';
import { NO_PICKED_ELEMENT_ERROR } from '@/lib/composer/element-submission';
import { COMPOSER_HOST_ID } from '@/lib/composer/dom';
import { PICKER_OVERLAY_ID } from './overlay';
import type { CaptureResult } from './protocol';
import { createPickerWiring, type PickerWiringDeps } from './wiring';

const PAGE: ComposerPageRequest = { url: 'https://example.com/pricing', title: 'Pricing' };

interface WiringSpies {
  deps: PickerWiringDeps;
  notifyCaptured: ReturnType<typeof vi.fn<PickerWiringDeps['notifyCaptured']>>;
  removeElement: ReturnType<typeof vi.fn<PickerWiringDeps['removeElement']>>;
  queueComment: ReturnType<typeof vi.fn<PickerWiringDeps['queueComment']>>;
  notifyCleared: ReturnType<typeof vi.fn<PickerWiringDeps['notifyCleared']>>;
  page: ReturnType<typeof vi.fn<PickerWiringDeps['page']>>;
}

const live: Array<ReturnType<typeof createPickerWiring>> = [];

function spies(): WiringSpies {
  const notifyCaptured = vi.fn(async () => ({ ok: true }) as CaptureResult);
  const removeElement = vi.fn(async () => ({ ok: true, elementCount: 0 }) as ComposerRemoveResult);
  const queueComment = vi.fn(
    async () => ({ ok: true, outboxCount: 1 }) as ComposerQueueResult,
  );
  const notifyCleared = vi.fn(async () => ({ ok: true }) as CaptureResult);
  const page = vi.fn(() => PAGE);

  return {
    notifyCaptured,
    removeElement,
    queueComment,
    notifyCleared,
    page,
    deps: { notifyCaptured, removeElement, queueComment, notifyCleared, page },
  };
}

function wiringFor(stub: WiringSpies) {
  const wiring = createPickerWiring(stub.deps);
  live.push(wiring);
  return wiring;
}

function mount(id: string, text = 'Checkout'): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = text;
  document.body.append(button);
  return button;
}

function pick(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
}

function finish(): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));
}

function composer(): HTMLElement | null {
  return document.getElementById(COMPOSER_HOST_ID);
}

function type(value: string): HTMLTextAreaElement {
  const field = composer()?.querySelector('textarea');
  if (field === null || field === undefined) throw new Error('composer textarea missing');
  field.value = value;
  field.dispatchEvent(new Event('input'));
  return field;
}

function queueButton(): HTMLButtonElement | undefined {
  return Array.from(composer()?.querySelectorAll('button') ?? []).find(
    (button) => button.textContent === 'Queue' || button.textContent === 'Queueing…',
  );
}

function chipLabels(): string[] {
  return Array.from(composer()?.querySelectorAll('button[aria-label^="Remove "]') ?? []).map(
    (button) => button.previousElementSibling?.textContent ?? '',
  );
}

function armAndPick(...elements: Element[]): void {
  const wiring = live[live.length - 1]!;
  wiring.arm();
  for (const element of elements) pick(element);
  finish();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const wiring of live.splice(0)) wiring.session.end();
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
  document.getElementById(COMPOSER_HOST_ID)?.remove();
  document.body.innerHTML = '';
});

describe('picker wiring arm', () => {
  it('toggles armed state through the runtime arm request', () => {
    const stub = spies();
    const wiring = wiringFor(stub);

    expect(wiring.arm()).toBe(true);
    expect(wiring.session.isArmed()).toBe(true);
    expect(wiring.arm()).toBe(false);
    expect(wiring.session.isArmed()).toBe(false);
  });

  it('closes an open composer and clears its set before arming again', () => {
    const stub = spies();
    const wiring = wiringFor(stub);

    armAndPick(mount('checkout'));
    const setID = stub.notifyCaptured.mock.calls[0]?.[0].id;

    expect(composer()).not.toBeNull();

    expect(wiring.arm()).toBe(true);

    expect(composer()).toBeNull();
    expect(stub.notifyCleared).toHaveBeenCalledWith(setID);
    expect(wiring.session.isArmed()).toBe(true);
  });

  it('hides the picker overlay while the capture message is in flight', async () => {
    const seen: string[] = [];
    const stub = spies();
    stub.notifyCaptured.mockImplementation(async () => {
      seen.push(document.getElementById(PICKER_OVERLAY_ID)?.style.visibility ?? 'missing');
      return { ok: true };
    });
    const wiring = wiringFor(stub);

    wiring.arm();
    pick(mount('checkout'));

    await vi.waitFor(() => expect(seen).toEqual(['hidden']));
    expect(document.getElementById(PICKER_OVERLAY_ID)?.style.visibility).toBe('');
  });
});

describe('picker wiring finish', () => {
  it('opens the composer with ordered labels and tracks every pick', () => {
    const stub = spies();
    const wiring = wiringFor(stub);
    const button = mount('checkout', 'Checkout');
    const heading = mount('title', 'Plans');

    wiring.arm();
    pick(button);
    pick(heading);
    finish();

    expect(composer()).not.toBeNull();
    expect(chipLabels()).toEqual(['button#checkout · "Checkout"', 'button#title · "Plans"']);
    expect(stub.notifyCaptured.mock.calls.map(([, index]) => index)).toEqual([0, 1]);
    expect(stub.notifyCaptured.mock.calls[0]?.[0].id).toBe(stub.notifyCaptured.mock.calls[1]?.[0].id);
    expect(wiring.session.isArmed()).toBe(false);
  });

  it('queues the comment with the page and the set count', async () => {
    const stub = spies();
    const wiring = wiringFor(stub);
    const button = mount('checkout', 'Checkout');
    const heading = mount('title', 'Plans');

    armAndPick(button, heading);

    type('Both look off');
    queueButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(stub.queueComment).toHaveBeenCalledTimes(1));

    expect(stub.page).toHaveBeenCalledTimes(1);
    expect(stub.queueComment).toHaveBeenCalledWith(
      'Both look off',
      PAGE,
      stub.notifyCaptured.mock.calls[0]?.[0].id,
      2,
    );
  });

  it('removes a chip through the background request', async () => {
    const stub = spies();
    stub.removeElement.mockResolvedValue({ ok: true, elementCount: 1 });
    const wiring = wiringFor(stub);
    const button = mount('checkout', 'Checkout');
    const heading = mount('title', 'Plans');

    armAndPick(button, heading);

    const remove = Array.from(composer()?.querySelectorAll('button[aria-label^="Remove "]') ?? [])[0]!;
    remove.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(chipLabels()).toEqual(['button#title · "Plans"']));

    expect(stub.removeElement).toHaveBeenCalledWith(stub.notifyCaptured.mock.calls[0]?.[0].id, 0);
  });
});

describe('picker wiring close', () => {
  it('clears the submission and the background pending when the composer closes', async () => {
    const stuck = new Promise<CaptureResult>(() => {});
    const stub = spies();
    stub.notifyCaptured.mockResolvedValueOnce({ ok: true }).mockReturnValueOnce(stuck);
    const wiring = wiringFor(stub);

    armAndPick(mount('checkout'), mount('title'));
    const setID = stub.notifyCaptured.mock.calls[0]?.[0].id;

    wiring.composer.close();

    expect(stub.notifyCleared).toHaveBeenCalledTimes(1);
    expect(stub.notifyCleared).toHaveBeenCalledWith(setID);

    await expect(wiring.submission.submit('A fresh set', PAGE, 1)).resolves.toEqual({
      ok: false,
      error: NO_PICKED_ELEMENT_ERROR,
    });
  });

  it('closes the composer and clears the set on a route change', () => {
    const stub = spies();
    const wiring = wiringFor(stub);

    armAndPick(mount('checkout'));
    const setID = stub.notifyCaptured.mock.calls[0]?.[0].id;

    window.dispatchEvent(new Event('popstate'));

    expect(composer()).toBeNull();
    expect(stub.notifyCleared).toHaveBeenCalledWith(setID);
    expect(wiring.session.isArmed()).toBe(false);
  });

  it('closes the composer on Escape and clears once', () => {
    const stub = spies();
    const wiring = wiringFor(stub);

    armAndPick(mount('checkout'));
    const setID = stub.notifyCaptured.mock.calls[0]?.[0].id;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(composer()).toBeNull();
    expect(stub.notifyCleared).toHaveBeenCalledTimes(1);
    expect(stub.notifyCleared).toHaveBeenCalledWith(setID);
  });
});
