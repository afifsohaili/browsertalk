import { describe, expect, it, vi } from 'vitest';
import { createComposerController, EMPTY_COMMENT_ERROR, type ComposerQueueResult } from './controller';

describe('composer controller', () => {
  it('queues the trimmed comment and reports success', async () => {
    const queue = vi.fn(async () => ({ ok: true }) as ComposerQueueResult);
    const controller = createComposerController({ queue });

    controller.setComment('  Fix the checkout button  ');
    await expect(controller.submit()).resolves.toBe(true);

    expect(queue).toHaveBeenCalledWith('Fix the checkout button');
    expect(controller.getState()).toEqual({ comment: '  Fix the checkout button  ', busy: false, error: null });
  });

  it('does not queue a blank comment', async () => {
    const queue = vi.fn(async () => ({ ok: true }) as ComposerQueueResult);
    const controller = createComposerController({ queue });

    controller.setComment('   ');
    await expect(controller.submit()).resolves.toBe(false);

    expect(queue).not.toHaveBeenCalled();
    expect(controller.getState().error).toBe(EMPTY_COMMENT_ERROR);
  });

  it('keeps the error when queueing fails', async () => {
    const queue = vi.fn(async () => ({ ok: false, error: 'Background unavailable' }) as ComposerQueueResult);
    const controller = createComposerController({ queue });

    controller.setComment('Fix this');
    await expect(controller.submit()).resolves.toBe(false);

    expect(controller.getState().error).toBe('Background unavailable');
    expect(controller.getState().busy).toBe(false);
  });

  it('ignores a second submit while the first is in flight', async () => {
    let finish: (result: ComposerQueueResult) => void = () => {};
    const queue = vi.fn(
      () =>
        new Promise<ComposerQueueResult>((resolve) => {
          finish = resolve;
        }),
    );
    const controller = createComposerController({ queue });

    controller.setComment('Once');
    const first = controller.submit();
    await expect(controller.submit()).resolves.toBe(false);
    expect(controller.getState().busy).toBe(true);

    finish({ ok: true });
    await expect(first).resolves.toBe(true);
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('clears a previous error when the user types again', async () => {
    const queue = vi.fn(async () => ({ ok: true }) as ComposerQueueResult);
    const controller = createComposerController({ queue });
    await controller.submit();
    expect(controller.getState().error).toBe(EMPTY_COMMENT_ERROR);

    controller.setComment('Now it has text');

    expect(controller.getState().error).toBeNull();
  });

  it('resets to a fresh composer', async () => {
    const queue = vi.fn(async () => ({ ok: false, error: 'nope' }) as ComposerQueueResult);
    const controller = createComposerController({ queue });
    controller.setComment('Fix this');
    await controller.submit();

    controller.reset();

    expect(controller.getState()).toEqual({ comment: '', busy: false, error: null });
  });

  it('notifies transitions for the view', async () => {
    const states: Array<{ busy: boolean; error: string | null }> = [];
    const queue = vi.fn(async () => ({ ok: true }) as ComposerQueueResult);
    const controller = createComposerController({
      queue,
      onTransition: (state) => states.push({ busy: state.busy, error: state.error }),
    });

    controller.setComment('Fix this');
    await controller.submit();

    expect(states).toEqual([
      { busy: true, error: null },
      { busy: false, error: null },
    ]);
  });
});
