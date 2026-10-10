import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getStoredSession, setStoredSession } from './sessions';

const REF = { sessionID: 'ses_abc', title: 'Browsertalk · example · 2026-10-10' };

describe('session ref storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns null when nothing is stored', async () => {
    expect(await getStoredSession('fake', 'per-day', '/home/afif/example::2026-10-10')).toBeNull();
  });

  it('round-trips a session ref under the sessions key', async () => {
    await setStoredSession('fake', 'per-day', '/home/afif/example::2026-10-10', REF);

    expect(await getStoredSession('fake', 'per-day', '/home/afif/example::2026-10-10')).toEqual(REF);

    const raw = await browser.storage.local.get('sessions');
    expect(raw.sessions).toEqual({
      fake: { 'per-day': { '/home/afif/example::2026-10-10': REF } },
    });
  });

  it('keeps backends and strategies apart', async () => {
    await setStoredSession('opencode', 'per-day', '/home/afif/example', { sessionID: 'ses_a', title: 'A' });
    await setStoredSession('fake', 'per-day', '/home/afif/example', { sessionID: 'ses_b', title: 'B' });
    await setStoredSession('fake', 'sticky', '/home/afif/example', { sessionID: 'ses_c', title: 'C' });

    expect(await getStoredSession('opencode', 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
    });
    expect(await getStoredSession('fake', 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
    });
    expect(await getStoredSession('fake', 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_c',
      title: 'C',
    });
  });

  it('keeps other refs when a new one is stored', async () => {
    await setStoredSession('fake', 'per-day', '/home/afif/one::2026-10-09', { sessionID: 'ses_a', title: 'A' });
    await setStoredSession('fake', 'per-day', '/home/afif/one::2026-10-10', { sessionID: 'ses_b', title: 'B' });

    expect(await getStoredSession('fake', 'per-day', '/home/afif/one::2026-10-09')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
    });
    expect(await getStoredSession('fake', 'per-day', '/home/afif/one::2026-10-10')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
    });
  });

  it('replaces a ref on rollover', async () => {
    await setStoredSession('fake', 'sticky', '/home/afif/example', { sessionID: 'ses_old', title: 'Old' });
    await setStoredSession('fake', 'sticky', '/home/afif/example', { sessionID: 'ses_new', title: 'New' });

    expect(await getStoredSession('fake', 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_new',
      title: 'New',
    });
  });

  it('reads refs written in an earlier session (survives restarts)', async () => {
    await setStoredSession('fake', 'sticky', '/home/afif/example', REF);

    const fresh = { getStoredSession };
    expect(await fresh.getStoredSession('fake', 'sticky', '/home/afif/example')).toEqual(REF);
  });

  it('ignores junk values', async () => {
    await browser.storage.local.set({ sessions: 'nonsense' });
    expect(await getStoredSession('fake', 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { fake: 'nonsense' } });
    expect(await getStoredSession('fake', 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { fake: { 'per-day': 'nonsense' } } });
    expect(await getStoredSession('fake', 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { fake: { 'per-day': { k: { bad: true } } } } });
    expect(await getStoredSession('fake', 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { fake: { 'per-day': { k: { sessionID: '', title: 'A' } } } } });
    expect(await getStoredSession('fake', 'per-day', 'k')).toBeNull();
  });
});
