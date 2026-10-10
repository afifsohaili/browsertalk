import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { getStoredSession, setStoredSession } from '@/lib/storage/sessions';
import { stickyTitle, StickySessionStrategy } from './sticky';

const DIRECTORY = '/home/afif/example';

function at(day: number, hours = 9): Date {
  return new Date(2026, 9, day, hours);
}

describe('StickySessionStrategy', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('creates one long-lived session per project on the first feedback', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new StickySessionStrategy();

    const session = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(10) });

    expect(session).toEqual({ id: 'ses_fake_1', title: 'Browsertalk · example' });
    expect(backend.createInputs).toEqual([{ directory: DIRECTORY, title: 'Browsertalk · example' }]);
    expect(await getStoredSession('fake', 'sticky', DIRECTORY)).toEqual({
      sessionID: 'ses_fake_1',
      title: 'Browsertalk · example',
    });
  });

  it('appends every later feedback to the same session, across days', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new StickySessionStrategy();

    const first = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(10) });
    const later = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(14) });

    expect(later).toEqual(first);
    expect(backend.sessions).toHaveLength(1);
  });

  it('rolls over to a fresh session on demand and continues on it', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new StickySessionStrategy();

    const first = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(10) });
    const fresh = await strategy.rolloverSession({ backend, directory: DIRECTORY, now: at(11) });

    expect(fresh.id).not.toBe(first.id);
    expect(await getStoredSession('fake', 'sticky', DIRECTORY)).toEqual({
      sessionID: fresh.id,
      title: fresh.title,
    });

    const next = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(12) });
    expect(next).toEqual(fresh);
  });

  it('keeps the stored title on reuse, so a rename survives', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new StickySessionStrategy();

    const created = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(10) });
    await setStoredSession('fake', 'sticky', DIRECTORY, { sessionID: created.id, title: 'My review thread' });

    const reused = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(11) });
    expect(reused).toEqual({ id: created.id, title: 'My review thread' });
  });

  it('titles without a date', () => {
    expect(stickyTitle('/home/afif/example/')).toBe('Browsertalk · example');
  });

  it('peeks the stored session without creating one', async () => {
    const backend = new FakeAgentBackend();
    const strategy = new StickySessionStrategy();

    expect(await strategy.peekSession({ backend, directory: DIRECTORY, now: at(10) })).toBeNull();
    expect(backend.createInputs).toEqual([]);

    const created = await strategy.resolveSession({ backend, directory: DIRECTORY, now: at(11) });
    expect(await strategy.peekSession({ backend, directory: DIRECTORY, now: at(12) })).toEqual(created);
    expect(backend.createInputs).toHaveLength(1);
  });
});
