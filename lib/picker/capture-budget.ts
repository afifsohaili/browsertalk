export const CAPTURE_WINDOW_MS = 1000;
export const CAPTURE_TOKENS_PER_WINDOW = 2;

const MAX_WAIT_ATTEMPTS = 3;

export interface CaptureBudgetDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export interface CaptureBudget {
  tryAcquire: () => boolean;
  waitForToken: () => Promise<boolean>;
}

/**
 * Chrome's `tabs.captureVisibleTab` allows two calls per one-second fixed window,
 * shared by the whole extension. A token is spent when the call starts, before any
 * visibility check, because Chrome spends it either way. The window resets only on
 * a clock strictly past its expiry (`QuotaService::TimedLimit`), so `now === expiresAt`
 * is still inside the window.
 */
export function createCaptureBudget(deps: CaptureBudgetDeps): CaptureBudget {
  let windowStart: number | null = null;
  let used = 0;

  function expiresAt(): number | null {
    return windowStart === null ? null : windowStart + CAPTURE_WINDOW_MS;
  }

  function resetIfExpired(now: number): void {
    const expiry = expiresAt();
    if (expiry === null || now > expiry) {
      windowStart = now;
      used = 0;
    }
  }

  function tryAcquire(): boolean {
    const now = deps.now();
    resetIfExpired(now);
    if (used >= CAPTURE_TOKENS_PER_WINDOW) return false;
    used += 1;
    return true;
  }

  function waitTime(now: number): number | null {
    const expiry = expiresAt();
    if (expiry === null) return null;
    return Math.max(1, expiry - now + 1);
  }

  async function waitForToken(): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_WAIT_ATTEMPTS; attempt += 1) {
      if (tryAcquire()) return true;

      const wait = waitTime(deps.now());
      if (wait === null) return false;
      await deps.sleep(wait);
    }
    return tryAcquire();
  }

  return { tryAcquire, waitForToken };
}
