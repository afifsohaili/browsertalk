import { describe, expect, it } from 'vitest';
import { sessionLockKey, withSessionLock } from './lock';

describe('session lock', () => {
  it('serializes operations sharing a key', async () => {
    const order: string[] = [];
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withSessionLock('k', async () => {
      order.push('first:start');
      await gate;
      order.push('first:end');
    });
    const second = withSessionLock('k', async () => {
      order.push('second');
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('runs operations with different keys concurrently', async () => {
    const order: string[] = [];
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withSessionLock('k1', async () => {
      await gate;
      order.push('first');
    });
    const second = withSessionLock('k2', async () => {
      order.push('second');
    });

    await second;
    expect(order).toEqual(['second']);

    release();
    await first;
    expect(order).toEqual(['second', 'first']);
  });

  it('keeps running after a failed operation', async () => {
    const failed = withSessionLock('k', async () => {
      throw new Error('boom');
    });

    await expect(failed).rejects.toThrow('boom');
    await expect(withSessionLock('k', async () => 'after')).resolves.toBe('after');
  });

  it('builds a key from the connection and the project directory', () => {
    expect(sessionLockKey('opencode@http://127.0.0.1:15001', '/home/afif/proj')).toBe(
      'opencode@http://127.0.0.1:15001::/home/afif/proj',
    );
  });
});
