import { describe, expect, it, vi } from 'vitest';
import { CAPTURE_WINDOW_MS, createCaptureBudget } from './capture-budget';
import type { PickerBoxFacts, PickerFeedback, PickerSizeFacts } from './facts';
import {
  computeCropRect,
  createElementScreenshotter,
  dataUrlToBlob,
  type ScreenshotDeps,
  type ScreenshotRequest,
} from './screenshot';

const VIEWPORT: PickerSizeFacts = { width: 1280, height: 800 };
const BOX: PickerBoxFacts = { x: 10, y: 20, width: 120, height: 32 };

function fakeClock(start = 0) {
  let time = start;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleeps,
    set: (value: number) => {
      time = value;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}

function request(windowId: number | undefined, isVisible: () => Promise<boolean> = async () => true): ScreenshotRequest {
  return { windowId, isVisible };
}

function feedback(box: PickerBoxFacts = BOX): PickerFeedback {
  return {
    id: 'fb_1',
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: { url: 'https://example.com/cart', path: '/cart', query: [], title: 'Cart' },
    elements: [
      {
        element: {
          tag: 'button',
          id: 'checkout',
          classes: ['btn'],
          selector: 'button#checkout',
          text: 'Checkout',
          attributes: {},
          box,
          viewport: VIEWPORT,
          scroll: { x: 0, y: 0 },
        },
      },
    ],
  };
}

function deps(partial: Partial<ScreenshotDeps> = {}): ScreenshotDeps {
  const clock = fakeClock();
  return {
    captureTab: vi.fn(async () => 'data:image/png;base64,AAAA'),
    crop: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 })),
    budget: createCaptureBudget({ now: clock.now, sleep: clock.sleep }),
    ...partial,
  };
}

function budgeted(partial: Partial<ScreenshotDeps> = {}) {
  const clock = fakeClock();
  const budget = createCaptureBudget({ now: clock.now, sleep: clock.sleep });
  return { clock, budget, stub: deps({ budget, ...partial }) };
}

describe('crop math', () => {
  it('crops 1:1 when the capture matches the viewport', () => {
    expect(computeCropRect(BOX, VIEWPORT, { width: 1280, height: 800 })).toEqual(BOX);
  });

  it('scales for hi-DPI captures', () => {
    expect(computeCropRect(BOX, VIEWPORT, { width: 2560, height: 1600 })).toEqual({
      x: 20,
      y: 40,
      width: 240,
      height: 64,
    });
  });

  it('scales for browser zoom on top of hi-DPI', () => {
    // devicePixelRatio 2 at 125% zoom → capture is 2.5× the CSS viewport
    expect(computeCropRect(BOX, VIEWPORT, { width: 3200, height: 2000 })).toEqual({
      x: 25,
      y: 50,
      width: 300,
      height: 80,
    });
  });

  it('rounds outward on fractional scales', () => {
    // 1.2× capture: floor the origin and ceil the far edge to keep the whole element
    expect(computeCropRect({ x: 10, y: 20, width: 101, height: 33 }, VIEWPORT, { width: 1536, height: 960 })).toEqual({
      x: 12,
      y: 24,
      width: 122,
      height: 40,
    });
  });

  it('clamps a crop that runs off the top-left of the viewport', () => {
    expect(computeCropRect({ x: -40, y: -10, width: 100, height: 50 }, VIEWPORT, { width: 1280, height: 800 })).toEqual({
      x: 0,
      y: 0,
      width: 60,
      height: 40,
    });
  });

  it('clamps a crop that runs off the bottom-right of the viewport', () => {
    expect(computeCropRect({ x: 1240, y: 780, width: 100, height: 50 }, VIEWPORT, { width: 1280, height: 800 })).toEqual({
      x: 1240,
      y: 780,
      width: 40,
      height: 20,
    });
  });

  it('returns null for offscreen, empty, or degenerate inputs', () => {
    expect(computeCropRect({ x: -300, y: 0, width: 100, height: 50 }, VIEWPORT, { width: 1280, height: 800 })).toBeNull();
    expect(computeCropRect({ x: 10, y: 20, width: 0, height: 32 }, VIEWPORT, { width: 1280, height: 800 })).toBeNull();
    expect(computeCropRect(BOX, VIEWPORT, { width: 0, height: 0 })).toBeNull();
    expect(computeCropRect(BOX, { width: 0, height: 800 }, { width: 1280, height: 800 })).toBeNull();
  });
});

describe('data URL decoding', () => {
  it('parses a base64 PNG data URL into a blob', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGVsbG8=');

    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(5);
    expect(await blob.text()).toBe('hello');
  });

  it('defaults the mime type to PNG', () => {
    expect(dataUrlToBlob('data:;base64,aGVsbG8=').type).toBe('image/png');
  });
});

describe('element screenshotter', () => {
  it('captures, crops, and returns the shot', async () => {
    const stub = deps();

    const shot = await createElementScreenshotter(stub).captureFor(feedback(), request(7));

    expect(shot).toEqual({ dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 });
    expect(stub.captureTab).toHaveBeenCalledWith(7);
    expect(stub.crop).toHaveBeenCalledWith('data:image/png;base64,AAAA', BOX, VIEWPORT);
  });

  it('crops the first element of a set', async () => {
    const stub = deps();
    const set = feedback();
    set.elements.push({ element: { ...set.elements[0]!.element, box: { x: 400, y: 400, width: 10, height: 10 } } });

    const shot = await createElementScreenshotter(stub).captureFor(set, request(7));

    expect(shot).not.toBeNull();
    expect(stub.crop).toHaveBeenCalledWith('data:image/png;base64,AAAA', BOX, VIEWPORT);
  });

  it('skips silently when the sender tab is not the visible tab', async () => {
    const stub = deps();

    const shot = await createElementScreenshotter(stub).captureFor(
      feedback(),
      request(7, async () => false),
    );

    expect(shot).toBeNull();
    expect(stub.captureTab).not.toHaveBeenCalled();
  });

  it('skips silently when the tab cannot be captured', async () => {
    const stub = deps({
      captureTab: vi.fn(async () => {
        throw new Error('captureVisibleTab unavailable');
      }),
    });

    expect(await createElementScreenshotter(stub).captureFor(feedback(), request(undefined))).toBeNull();
    expect(stub.crop).not.toHaveBeenCalled();
  });

  it('skips silently when the crop fails', async () => {
    const stub = deps({
      crop: vi.fn(async () => {
        throw new Error('decode failed');
      }),
    });

    expect(await createElementScreenshotter(stub).captureFor(feedback(), request(undefined))).toBeNull();
  });

  it('skips empty boxes without spending a capture', async () => {
    const stub = deps();

    expect(
      await createElementScreenshotter(stub).captureFor(feedback({ x: 0, y: 0, width: 0, height: 0 }), request(7)),
    ).toBeNull();
    expect(stub.captureTab).not.toHaveBeenCalled();
  });

  it('captures without waiting when a token is free', async () => {
    const { clock, stub } = budgeted();

    const shot = await createElementScreenshotter(stub).captureFor(feedback(), request(7), { allowWait: true });

    expect(shot).toEqual({ dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 });
    expect(clock.sleeps).toEqual([]);
  });

  it('takes two captures from one window and skips the rest', async () => {
    const { stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);

    await screenshotter.captureFor(feedback(), request(undefined), { allowWait: true });
    await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false });
    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false })).toBeNull();

    expect(stub.captureTab).toHaveBeenCalledTimes(2);
  });

  it('waits for the next token when waiting is allowed', async () => {
    const { clock, budget, stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);
    budget.tryAcquire();
    budget.tryAcquire();

    const shot = await screenshotter.captureFor(feedback(), request(undefined), { allowWait: true });

    expect(shot).not.toBeNull();
    expect(clock.sleeps).toEqual([CAPTURE_WINDOW_MS + 1]);
    expect(stub.captureTab).toHaveBeenCalledTimes(1);
  });

  it('skips without a token when waiting is not allowed', async () => {
    const { clock, budget, stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);
    budget.tryAcquire();
    budget.tryAcquire();

    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false })).toBeNull();
    expect(clock.sleeps).toEqual([]);
    expect(stub.captureTab).not.toHaveBeenCalled();
  });

  it('skips by default when no token is free', async () => {
    const { budget, stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);
    budget.tryAcquire();
    budget.tryAcquire();

    expect(await screenshotter.captureFor(feedback(), request(undefined))).toBeNull();
    expect(stub.captureTab).not.toHaveBeenCalled();
  });

  it('spends the token before the visibility check', async () => {
    const { stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);

    expect(await screenshotter.captureFor(feedback(), request(7, async () => false))).toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(7), { allowWait: false })).not.toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(7), { allowWait: false })).toBeNull();

    expect(stub.captureTab).toHaveBeenCalledTimes(1);
  });

  it('does not refund a token when the capture fails', async () => {
    const { clock, stub } = budgeted({
      captureTab: vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('quota'))
        .mockResolvedValue('data:image/png;base64,AAAA'),
    });
    const screenshotter = createElementScreenshotter(stub);

    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false })).toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false })).not.toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: false })).toBeNull();
    expect(clock.sleeps).toEqual([]);

    expect(await screenshotter.captureFor(feedback(), request(undefined), { allowWait: true })).not.toBeNull();
    expect(clock.sleeps).toEqual([CAPTURE_WINDOW_MS + 1]);
  });

  it('skips empty boxes without spending a token', async () => {
    const { stub } = budgeted();
    const screenshotter = createElementScreenshotter(stub);

    expect(
      await screenshotter.captureFor(feedback({ x: 0, y: 0, width: 0, height: 0 }), request(7), { allowWait: true }),
    ).toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(7), { allowWait: false })).not.toBeNull();
    expect(await screenshotter.captureFor(feedback(), request(7), { allowWait: false })).not.toBeNull();

    expect(stub.captureTab).toHaveBeenCalledTimes(2);
  });
});
