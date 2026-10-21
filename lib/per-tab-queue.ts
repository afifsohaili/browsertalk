export interface PerTabQueueOptions {
  continueOnError: boolean;
}

export interface PerTabQueue {
  enqueue: <T>(tabId: number, operation: () => Promise<T>) => Promise<T>;
  settled: (tabId: number) => Promise<void>;
}

interface Tail {
  promise: Promise<void>;
  error: unknown;
  done: boolean;
}

export function createPerTabQueue(options: PerTabQueueOptions): PerTabQueue {
  const tails = new Map<number, Tail>();

  function enqueue<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
    const previous = tails.get(tabId);
    const chain = previous?.promise ?? Promise.resolve();
    const gated = previous !== undefined && !previous.done && !options.continueOnError;

    const result = chain.then(() => {
      if (gated && previous.error !== undefined) {
        throw new Error('Skipped after a failed task', { cause: previous.error });
      }
      return operation();
    });

    return track(tabId, result);
  }

  function track<T>(tabId: number, result: Promise<T>): Promise<T> {
    const tail: Tail = { promise: Promise.resolve(), error: undefined, done: false };
    tail.promise = result.then(
      () => {
        tail.done = true;
      },
      (error: unknown) => {
        tail.error = error;
        tail.done = true;
      },
    );
    tails.set(tabId, tail);
    void tail.promise.then(() => {
      if (tails.get(tabId) === tail) tails.delete(tabId);
    });
    return result;
  }

  function settled(tabId: number): Promise<void> {
    return tails.get(tabId)?.promise ?? Promise.resolve();
  }

  return { enqueue, settled };
}
