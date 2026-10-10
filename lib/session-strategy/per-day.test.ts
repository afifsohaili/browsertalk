import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { getStoredSession } from '@/lib/storage/sessions';
import { localDateKey, perDayTitle, PerDaySessionStrategy } from './per-day';

const DIRECTORY = '/home/afif/example';
const DAY = `${DIRECTORY}::2026-10-10`;

function at(hours: number, minutes = 0, day = 10): Date {
  return new Date(2026, 9, day, hours, minutes);
}

describe('PerDaySessionStrategy', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('creates a session titled for the project and the local date on the first feedback', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new PerDaySessionStrategy();

    const session = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(9, 30) });

    expect(session).toEqual({ id: 'ses_fake_1', title: 'Browsertalk · example · 2026-10-10' });
    expect(backend.createInputs).toEqual([
      { directory: DIRECTORY, title: 'Browsertalk · example · 2026-10-10' },
    ]);
    expect(await getStoredSession('fake', 'per-day', DAY)).toEqual({
      sessionID: 'ses_fake_1',
      title: 'Browsertalk · example · 2026-10-10',
    });
  });

  it('reuses the day session for later feedback on the same day', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new PerDaySessionStrategy();

    const first = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(9, 30) });
    const second = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(22, 0) });

    expect(second).toEqual(first);
    expect(backend.sessions).toHaveLength(1);
  });

  it('rolls over at local midnight', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new PerDaySessionStrategy();

    const beforeMidnight = await strategy.resolveSession({
      backend,
      directory: DIRECTORY,
      now: at(23, 59),
    });
    const afterMidnight = await strategy.resolveSession({
      backend,
      directory: DIRECTORY,
      now: at(0, 1, 11),
    });

    expect(beforeMidnight.id).toBe('ses_fake_1');
    expect(afterMidnight).toEqual({ id: 'ses_fake_2', title: 'Browsertalk · example · 2026-10-11' });
    expect(await getStoredSession('fake', 'per-day', `${DIRECTORY}::2026-10-11`)).toEqual({
      sessionID: 'ses_fake_2',
      title: 'Browsertalk · example · 2026-10-11',
    });
  });

  it('rolls over on demand and continues on the fresh session', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new PerDaySessionStrategy();

    const first = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(9, 30) });
    const fresh = await strategy.rolloverSession({ backend, directory: DIRECTORY, now: at(10, 0) });

    expect(fresh.id).not.toBe(first.id);
    expect(fresh.title).toBe('Browsertalk · example · 2026-10-10');
    expect(await getStoredSession('fake', 'per-day', DAY)).toEqual({
      sessionID: fresh.id,
      title: fresh.title,
    });

    const next = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(11, 0) });
    expect(next).toEqual(fresh);
  });

  it('formats the local date key with zero padding', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(perDayTitle('/home/afif/example/', new Date(2026, 9, 10))).toBe('Browsertalk · example · 2026-10-10');
  });
});
