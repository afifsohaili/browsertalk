// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PICKER_COUNT_ID,
  PICKER_OVERLAY_ID,
  createPickerSession,
  type PickerSession,
  type PickerSessionOptions,
} from './session';

interface SessionSpies {
  options: PickerSessionOptions;
  onPick: ReturnType<typeof vi.fn<PickerSessionOptions['onPick']>>;
  onFinish: ReturnType<typeof vi.fn<PickerSessionOptions['onFinish']>>;
  onRemove: ReturnType<typeof vi.fn<PickerSessionOptions['onRemove']>>;
  onClear: ReturnType<typeof vi.fn<PickerSessionOptions['onClear']>>;
  onRouteChange: ReturnType<typeof vi.fn<PickerSessionOptions['onRouteChange']>>;
}

interface Harness extends SessionSpies {
  picker: PickerSession;
}

function spies(): SessionSpies {
  const onPick = vi.fn<PickerSessionOptions['onPick']>();
  const onFinish = vi.fn<PickerSessionOptions['onFinish']>();
  const onRemove = vi.fn<PickerSessionOptions['onRemove']>();
  const onClear = vi.fn<PickerSessionOptions['onClear']>();
  const onRouteChange = vi.fn<PickerSessionOptions['onRouteChange']>();

  return {
    onPick,
    onFinish,
    onRemove,
    onClear,
    onRouteChange,
    options: { onPick, onFinish, onRemove, onClear, onRouteChange },
  };
}

const live: PickerSession[] = [];

function setup(): Harness {
  const session = spies();
  const picker = createPickerSession(session.options);
  live.push(picker);
  return { ...session, picker };
}

function cleanup(): void {
  for (const picker of live.splice(0)) picker.end();
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
  document.getElementById(PICKER_COUNT_ID)?.remove();
  document.body.innerHTML = '';
  document.documentElement.style.cursor = '';
}

function place(
  element: Element,
  rect: { left: number; top: number; width: number; height: number } = {
    left: 40,
    top: 24,
    width: 120,
    height: 32,
  },
): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function mount(tag = 'button'): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = tag === 'button' ? 'Checkout' : 'Heading';
  document.body.append(element);
  place(element);
  return element;
}

function pick(element: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  element.dispatchEvent(event);
  return event;
}

function click(element: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function overlay(): HTMLElement | null {
  return document.getElementById(PICKER_OVERLAY_ID);
}

function pill(): HTMLElement | null {
  return document.getElementById(PICKER_COUNT_ID);
}

function pillText(): string {
  return pill()?.children[1]?.textContent ?? '';
}

function selectedBoxes(): HTMLElement[] {
  const host = overlay();
  const boxes = host?.children[0];
  return boxes === undefined ? [] : (Array.from(boxes.children) as HTMLElement[]);
}

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function setPlatform(platform: string, userAgent: string): void {
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
}

beforeEach(() => {
  cleanup();
  setPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
});

afterEach(cleanup);

describe('picker session lifecycle', () => {
  it('clears the background pending when the composer ends the set', () => {
    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(typeof session.onClear.mock.calls[0]?.[0]).toBe('string');

    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
  });

  it('names the finished set when the composer closes it', () => {
    const button = document.createElement('button');
    button.id = 'checkout';
    button.textContent = 'Checkout';
    document.body.append(button);

    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    expect(session.onFinish).toHaveBeenCalledTimes(1);
    const finished = session.onFinish.mock.calls[0]?.[0];
    expect(finished?.picks).toHaveLength(1);

    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(session.onClear).toHaveBeenCalledWith(finished?.setID);
  });

  it('clears once and closes the composer on a route change', () => {
    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    window.dispatchEvent(new Event('popstate'));

    expect(session.onRouteChange).toHaveBeenCalledTimes(1);
    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(typeof session.onClear.mock.calls[0]?.[0]).toBe('string');
  });
});

describe('picker arming', () => {
  it('arms with an overlay, no count pill, and a crosshair cursor', () => {
    const { picker } = setup();

    expect(picker.toggle()).toBe(true);
    expect(picker.isArmed()).toBe(true);
    expect(overlay()).not.toBeNull();
    expect(pill()?.style.display).toBe('none');
    expect(document.documentElement.style.cursor).toBe('crosshair');

    expect(picker.toggle()).toBe(false);
    expect(picker.isArmed()).toBe(false);
    expect(overlay()).toBeNull();
    expect(document.documentElement.style.cursor).toBe('');
  });
});

describe('picker selection', () => {
  it('adds every modifier click and numbers the badges', () => {
    const { picker, onPick, onFinish } = setup();
    const first = mount();
    const heading = mount('h1');

    picker.toggle();
    pick(first);
    pick(heading);

    expect(onPick.mock.calls.map(([, index]) => index)).toEqual([0, 1]);
    expect(onFinish).not.toHaveBeenCalled();
    expect(picker.isArmed()).toBe(true);

    expect(selectedBoxes().map((box) => box.textContent)).toEqual(['1', '2']);
    expect(selectedBoxes().map((box) => box.style.left)).toEqual(['40px', '40px']);
    expect(pill()?.style.display).toBe('flex');
    expect(pillText()).toBe('2 selected · release ⌘ to comment');
    expect(pill()?.textContent).toContain('Clear');
  });

  it('toggles a selected element off and keeps a fresh index for the next pick', () => {
    const { picker, onPick, onRemove, onFinish } = setup();
    const first = mount();
    const second = mount();
    const third = mount();

    picker.toggle();
    pick(first);
    pick(second);
    pick(first);

    const setID = onPick.mock.calls[0]?.[0].id;
    expect(setID).toBe(onPick.mock.calls[1]?.[0].id);
    expect(onRemove).toHaveBeenCalledWith(setID, 0);
    expect(selectedBoxes()).toHaveLength(1);
    expect(selectedBoxes()[0]?.textContent).toBe('1');

    pick(third);

    expect(onPick.mock.calls.map(([, index]) => index)).toEqual([0, 1, 2]);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    const picks = onFinish.mock.calls[0]?.[0].picks ?? [];
    expect(picks.map((entry) => entry.element)).toEqual([second, third]);
    expect(picks.map((entry) => entry.index)).toEqual([1, 2]);
  });

  it('finishes a plain click on an empty set with the clicked element', () => {
    const { picker, onPick, onFinish } = setup();
    const button = mount();

    picker.toggle();
    click(button);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0].picks.map((entry) => entry.element)).toEqual([button]);
    expect(picker.isArmed()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('finishes a plain click on an existing set without adding the clicked element', () => {
    const { picker, onPick, onFinish } = setup();
    const first = mount();
    const second = mount();

    picker.toggle();
    pick(first);
    click(second);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0].picks.map((entry) => entry.element)).toEqual([first]);
  });

  it('ignores right clicks, overlay clicks, and clicks once picking is over', () => {
    const { picker, onPick, onFinish } = setup();
    const button = mount();

    picker.toggle();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 2 }));
    pill()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onPick).not.toHaveBeenCalled();
    expect(picker.isArmed()).toBe(true);

    click(button);
    expect(onFinish).toHaveBeenCalledTimes(1);

    pick(mount());
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe('picker finishing', () => {
  it('finishes the set when the modifier is released', () => {
    const { picker, onFinish, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0].picks).toHaveLength(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('disarms on a modifier release with nothing selected', () => {
    const { picker, onFinish, onClear } = setup();

    picker.toggle();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));

    expect(onFinish).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(picker.isArmed()).toBe(false);
  });

  it('finishes the set on Enter and ignores Enter with nothing selected', () => {
    const { picker, onFinish } = setup();
    const button = mount();

    picker.toggle();
    press('Enter');
    expect(onFinish).not.toHaveBeenCalled();
    expect(picker.isArmed()).toBe(true);

    pick(button);
    press('Enter');

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0].picks).toHaveLength(1);
  });

  it('finishes on the fifth pick and refuses a sixth', () => {
    const { picker, onPick, onFinish } = setup();
    picker.toggle();

    for (let index = 0; index < 5; index += 1) pick(mount());

    expect(onPick).toHaveBeenCalledTimes(5);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0].picks).toHaveLength(5);
    expect(picker.isArmed()).toBe(false);

    pick(mount());
    expect(onPick).toHaveBeenCalledTimes(5);
  });

  it('keeps the route watcher alive through the composer', () => {
    const { picker, onFinish, onRouteChange, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    const setID = onFinish.mock.calls[0]?.[0].setID;
    window.dispatchEvent(new Event('popstate'));

    expect(onRouteChange).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledWith(setID);
  });
});

describe('picker clearing', () => {
  it('clears the set from the count pill button', () => {
    const { picker, onPick, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    const setID = onPick.mock.calls[0]?.[0].id;

    const clear = pill()?.querySelector('button');
    clear?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledWith(setID);
    expect(picker.isArmed()).toBe(false);
    expect(overlay()).toBeNull();
    expect(document.documentElement.style.cursor).toBe('');
  });

  it('clears the set on Escape', () => {
    const { picker, onPick, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    press('Escape');

    expect(onClear).toHaveBeenCalledWith(onPick.mock.calls[0]?.[0].id);
    expect(picker.isArmed()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('clears the set when the window blurs', () => {
    const { picker, onPick, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    window.dispatchEvent(new Event('blur'));

    expect(onClear).toHaveBeenCalledWith(onPick.mock.calls[0]?.[0].id);
    expect(picker.isArmed()).toBe(false);
  });

  it('clears and disarms on a page-world route event', () => {
    const { picker, onPick, onRouteChange, onClear } = setup();
    const button = mount();

    picker.toggle();
    pick(button);
    window.dispatchEvent(new Event('browsertalk:picker-route'));

    expect(onRouteChange).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledWith(onPick.mock.calls[0]?.[0].id);
    expect(picker.isArmed()).toBe(false);
  });
});

describe('picker overlay holds', () => {
  it('hides the overlay and count pill around a capture, then restores them', async () => {
    const { picker } = setup();
    const button = mount();

    picker.toggle();
    pick(button);

    const seen = await picker.withOverlayHidden(async () => ({
      host: overlay()?.style.visibility,
      pill: pill()?.style.visibility,
    }));

    expect(seen).toEqual({ host: 'hidden', pill: 'hidden' });
    expect(overlay()?.style.visibility).toBe('');
    expect(pill()?.style.visibility).toBe('');
  });

  it('stays hidden until every overlapping capture settles', async () => {
    const { picker } = setup();
    const button = mount();

    picker.toggle();
    pick(button);

    let release: () => void = () => {};
    const first = picker.withOverlayHidden(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await picker.withOverlayHidden(async () => {});

    expect(overlay()?.style.visibility).toBe('hidden');
    expect(pill()?.style.visibility).toBe('hidden');

    release();
    await first;

    expect(overlay()?.style.visibility).toBe('');
    expect(pill()?.style.visibility).toBe('');
  });

  it('restores the overlay when the capture throws, and does nothing while disarmed', async () => {
    const { picker } = setup();
    const button = mount();

    picker.toggle();
    pick(button);

    await expect(
      picker.withOverlayHidden(async () => {
        throw new Error('capture failed');
      }),
    ).rejects.toThrow('capture failed');

    expect(overlay()?.style.visibility).toBe('');

    picker.disarm();

    await expect(picker.withOverlayHidden(async () => 'no overlay')).resolves.toBe('no overlay');
  });
});

describe('picker hover', () => {
  it('labels the hovered element and hides the label once it is selected', () => {
    const { picker } = setup();
    const button = mount();
    button.id = 'checkout';
    button.classList.add('btn');
    mount('h1');

    picker.toggle();
    button.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    const host = overlay();
    const hoverBox = host?.children[1] as HTMLElement;
    const hoverLabel = host?.children[2] as HTMLElement;

    expect(hoverBox.style.display).toBe('block');
    expect(hoverBox.style.width).toBe('120px');
    expect(hoverLabel.style.display).toBe('block');
    expect(hoverLabel.textContent).toBe('button#checkout.btn');

    pick(button);

    expect(hoverBox.style.display).toBe('none');
    expect(hoverLabel.style.display).toBe('none');
  });

  it('skips a zero-size element but still counts it', () => {
    const { picker, onPick, onFinish } = setup();
    const hidden = document.createElement('button');
    document.body.append(hidden);
    place(hidden, { left: 0, top: 0, width: 0, height: 0 });

    picker.toggle();
    pick(hidden);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(selectedBoxes()).toHaveLength(0);
    expect(pillText()).toBe('1 selected · release ⌘ to comment');

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    expect(onFinish.mock.calls[0]?.[0].picks).toHaveLength(1);
  });
});

describe('picker platform label', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.cursor = '';
  });

  it('uses Ctrl on a non-Mac platform', () => {
    setPlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const { picker } = setup();

    picker.toggle();
    pick(mount());

    expect(pillText()).toBe('1 selected · release Ctrl to comment');
  });
});
