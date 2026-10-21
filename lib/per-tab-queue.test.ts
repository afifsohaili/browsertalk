import { describe, expect, it, vi } from 'vitest';
import { createPerTabQueue } from './per-tab-queue';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('per-tab queue', () => {
  it('runs one task at a time per tab', async () => {
    const queue = createPerTabQueue({ continueOnError: true });
    const gate = deferred();
    const order: string[] = [];

    const first = queue.enqueue(1, async () => {
      order.push('first:start');
      await gate.promise;
      order.push('first:end');
      return 1;
    });
    const second = queue.enqueue(1, async () => {
      order.push('second');
      return 2;
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('queues each tab separately', async () => {
    const queue = createPerTabQueue({ continueOnError: true });
    const gate = deferred();
    const order: string[] = [];

    const first = queue.enqueue(1, async () => {
      await gate.promise;
      order.push('tab-1');
    });
    const second = queue.enqueue(2, async () => {
      order.push('tab-2');
    });

    await expect(second).resolves.toBeUndefined();
    expect(order).toEqual(['tab-2']);

    gate.resolve();
    await expect(first).resolves.toBeUndefined();
    expect(order).toEqual(['tab-2', 'tab-1']);
  });

  it('keeps running later work when continueOnError is true', async () => {
    const queue = createPerTabQueue({ continueOnError: true });
    const later = vi.fn(async () => 'ran');

    const failed = queue.enqueue(1, async () => {
      throw new Error('boom');
    });
    const next = queue.enqueue(1, later);

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ran');
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('skips queued work when continueOnError is false', async () => {
    const queue = createPerTabQueue({ continueOnError: false });
    const later = vi.fn(async () => 'ran');

    const failed = queue.enqueue(1, async () => {
      throw new Error('boom');
    });
    const next = queue.enqueue(1, later);

    await expect(failed).rejects.toThrow('boom');
    await expect(next).rejects.toThrow('Skipped after a failed task');
    expect(later).not.toHaveBeenCalled();
  });

  it('reports the earlier error as the cause of a skip', async () => {
    const queue = createPerTabQueue({ continueOnError: false });
    const boom = new Error('boom');

    const failed = queue.enqueue(1, async () => {
      throw boom;
    });
    const next = queue.enqueue(1, async () => 'ran');

    await expect(failed).rejects.toThrow(boom);
    await expect(next).rejects.toMatchObject({ cause: boom });
  });

  it('runs fresh work after the failed task has settled', async () => {
    const queue = createPerTabQueue({ continueOnError: false });

    await expect(queue.enqueue(1, async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    await expect(queue.enqueue(1, async () => 'ran')).resolves.toBe('ran');
  });

  it('settles when the queued work for a tab finishes', async () => {
    const queue = createPerTabQueue({ continueOnError: true });
    const gate = deferred();
    const order: string[] = [];

    const task = queue.enqueue(1, async () => {
      await gate.promise;
      order.push('task');
    });
    const settled = queue.settled(1).then(() => order.push('settled'));

    gate.resolve();
    await Promise.all([task, settled]);

    expect(order).toEqual(['task', 'settled']);
  });
});
