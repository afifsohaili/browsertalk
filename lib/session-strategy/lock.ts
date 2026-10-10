const locks = new Map<string, Promise<unknown>>();

export function sessionLockKey(connectionKey: string, directory: string): string {
  return `${connectionKey}::${directory}`;
}

export function withSessionLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return result;
}
