import { describe, expect, it, vi } from 'vitest';
import { createOverlayHolds } from './overlay-visibility';

function holds() {
  const hide = vi.fn();
  const show = vi.fn();
  return { hide, show, overlay: createOverlayHolds({ hide, show }) };
}

describe('overlay holds', () => {
  it('hides on the first hold and restores on the last release', () => {
    const { hide, show, overlay } = holds();

    const release = overlay.hold();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();

    release();
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('keeps the overlay hidden until every hold is released', () => {
    const { hide, show, overlay } = holds();

    const first = overlay.hold();
    const second = overlay.hold();
    expect(overlay.count()).toBe(2);

    first();
    expect(show).not.toHaveBeenCalled();

    second();
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('ignores a double release', () => {
    const { hide, show, overlay } = holds();

    const release = overlay.hold();
    release();
    release();

    expect(overlay.count()).toBe(0);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('restores after the guarded operation resolves', async () => {
    const { show, overlay } = holds();

    await expect(overlay.guard(async () => 'shot')).resolves.toBe('shot');

    expect(show).toHaveBeenCalledTimes(1);
  });

  it('restores after the guarded operation throws', async () => {
    const { show, overlay } = holds();

    await expect(
      overlay.guard(async () => {
        throw new Error('capture failed');
      }),
    ).rejects.toThrow('capture failed');

    expect(overlay.count()).toBe(0);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('keeps overlapping guarded operations covered', async () => {
    const { show, overlay } = holds();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const slow = overlay.guard(async () => {
      await gate;
    });
    await overlay.guard(async () => {});
    expect(show).not.toHaveBeenCalled();

    release();
    await slow;
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('holds and releases without a visibility target', () => {
    const overlay = createOverlayHolds({ hide: () => {}, show: () => {} });

    const release = overlay.hold();
    release();

    expect(overlay.count()).toBe(0);
  });
});
