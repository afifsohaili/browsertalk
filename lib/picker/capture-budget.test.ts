import { describe, expect, it } from 'vitest';
import { CAPTURE_TOKENS_PER_WINDOW, CAPTURE_WINDOW_MS, createCaptureBudget } from './capture-budget';

function fakeClock(start = 0) {
  let time = start;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleeps,
    set: (value: number) => {
      time = value;
    },
    advance: (ms: number) => {
      time += ms;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}

function budgetAt(clock: ReturnType<typeof fakeClock>) {
  return createCaptureBudget({ now: clock.now, sleep: clock.sleep });
}

describe('capture budget', () => {
  it('allows two starts per window', () => {
    expect(CAPTURE_TOKENS_PER_WINDOW).toBe(2);
    expect(CAPTURE_WINDOW_MS).toBe(1000);

    const clock = fakeClock();
    const budget = budgetAt(clock);

    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);
  });

  it('runs a fixed window at 0/100/200/300ms', () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);
    const allowed: boolean[] = [];

    for (const at of [0, 100, 200, 300]) {
      clock.set(at);
      allowed.push(budget.tryAcquire());
    }

    expect(allowed).toEqual([true, true, false, false]);
  });

  it('holds the window shut at exactly 1000ms', () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);
    const allowed: boolean[] = [];

    for (const at of [0, 500, 1000]) {
      clock.set(at);
      allowed.push(budget.tryAcquire());
    }

    expect(allowed).toEqual([true, true, false]);
  });

  it('resets strictly after the window expires', () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);

    clock.set(0);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);

    clock.set(CAPTURE_WINDOW_MS);
    expect(budget.tryAcquire()).toBe(false);

    clock.set(CAPTURE_WINDOW_MS + 1);
    expect(budget.tryAcquire()).toBe(true);
  });

  it('opens the next window at the reset time', () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);

    clock.set(0);
    budget.tryAcquire();
    budget.tryAcquire();

    clock.set(1001);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);

    clock.set(1500);
    expect(budget.tryAcquire()).toBe(false);

    clock.set(2002);
    expect(budget.tryAcquire()).toBe(true);
  });

  it('waits out a full window and then captures', async () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);

    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);

    await expect(budget.waitForToken()).resolves.toBe(true);

    expect(clock.sleeps).toEqual([CAPTURE_WINDOW_MS + 1]);
    expect(clock.now()).toBe(CAPTURE_WINDOW_MS + 1);
  });

  it('does not wait when a token is free', async () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);

    await expect(budget.waitForToken()).resolves.toBe(true);

    expect(clock.sleeps).toEqual([]);
  });

  it('serves a second waiter from the window it opened', async () => {
    const clock = fakeClock();
    const budget = budgetAt(clock);

    budget.tryAcquire();
    budget.tryAcquire();

    const first = budget.waitForToken();
    const second = budget.waitForToken();

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(clock.now()).toBe(CAPTURE_WINDOW_MS + 1);
  });

  it('gives up when the clock never advances', async () => {
    const budget = createCaptureBudget({ now: () => 0, sleep: async () => {} });

    budget.tryAcquire();
    budget.tryAcquire();

    await expect(budget.waitForToken()).resolves.toBe(false);
  });
});
