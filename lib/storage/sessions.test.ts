import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getStoredSession, setStoredSession } from './sessions';

const KEY_A = 'opencode@http://127.0.0.1:15001';
const KEY_B = 'opencode@http://127.0.0.1:4096';
const REF = { sessionID: 'ses_abc', title: 'Browsertalk · example · 2026-10-10' };

describe('session ref storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns null when nothing is stored', async () => {
    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/example::2026-10-10')).toBeNull();
  });

  it('round-trips a session ref under the sessions key', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/example::2026-10-10', REF);

    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/example::2026-10-10')).toEqual(REF);

    const raw = await browser.storage.local.get('sessions');
    expect(raw.sessions).toEqual({
      [KEY_A]: { 'per-day': { '/home/afif/example::2026-10-10': REF } },
    });
  });

  it('keeps connections and strategies apart', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/example', { sessionID: 'ses_a', title: 'A' });
    await setStoredSession(KEY_B, 'per-day', '/home/afif/example', { sessionID: 'ses_b', title: 'B' });
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', { sessionID: 'ses_c', title: 'C' });

    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
    });
    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
    });
    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_c',
      title: 'C',
    });
  });

  it('never returns another endpoint ref for the same backend and key', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/example', { sessionID: 'ses_a', title: 'A' });

    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/example')).toBeNull();
  });

  it('keeps other refs when a new one is stored', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-09', { sessionID: 'ses_a', title: 'A' });
    await setStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-10', { sessionID: 'ses_b', title: 'B' });

    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-09')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
    });
    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-10')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
    });
    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/one::2026-10-09')).toBeNull();
  });

  it('replaces a ref on rollover', async () => {
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', { sessionID: 'ses_old', title: 'Old' });
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', { sessionID: 'ses_new', title: 'New' });

    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_new',
      title: 'New',
    });
  });

  it('reads refs written in an earlier session (survives restarts)', async () => {
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', REF);

    const fresh = { getStoredSession };
    expect(await fresh.getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual(REF);
  });

  it('ignores junk values', async () => {
    await browser.storage.local.set({ sessions: 'nonsense' });
    expect(await getStoredSession(KEY_A, 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { [KEY_A]: 'nonsense' } });
    expect(await getStoredSession(KEY_A, 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { [KEY_A]: { 'per-day': 'nonsense' } } });
    expect(await getStoredSession(KEY_A, 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { [KEY_A]: { 'per-day': { k: { bad: true } } } } });
    expect(await getStoredSession(KEY_A, 'per-day', 'k')).toBeNull();

    await browser.storage.local.set({ sessions: { [KEY_A]: { 'per-day': { k: { sessionID: '', title: 'A' } } } } });
    expect(await getStoredSession(KEY_A, 'per-day', 'k')).toBeNull();
  });
});
