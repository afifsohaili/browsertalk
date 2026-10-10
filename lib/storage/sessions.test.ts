import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getStoredSession, setStoredSession } from './sessions';

const KEY_A = 'opencode@http://127.0.0.1:15001';
const KEY_B = 'opencode@http://127.0.0.1:4096';
const REF = { sessionID: 'ses_abc', title: 'Browsertalk · example · 2026-10-10', generation: 0 };

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
    await setStoredSession(KEY_A, 'per-day', '/home/afif/example', {
      sessionID: 'ses_a',
      title: 'A',
      generation: 0,
    });
    await setStoredSession(KEY_B, 'per-day', '/home/afif/example', {
      sessionID: 'ses_b',
      title: 'B',
      generation: 0,
    });
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', {
      sessionID: 'ses_c',
      title: 'C',
      generation: 0,
    });

    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
      generation: 0,
    });
    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/example')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
      generation: 0,
    });
    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_c',
      title: 'C',
      generation: 0,
    });
  });

  it('never returns another endpoint ref for the same backend and key', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/example', {
      sessionID: 'ses_a',
      title: 'A',
      generation: 0,
    });

    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/example')).toBeNull();
  });

  it('keeps other refs when a new one is stored', async () => {
    await setStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-09', {
      sessionID: 'ses_a',
      title: 'A',
      generation: 0,
    });
    await setStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-10', {
      sessionID: 'ses_b',
      title: 'B',
      generation: 1,
    });

    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-09')).toEqual({
      sessionID: 'ses_a',
      title: 'A',
      generation: 0,
    });
    expect(await getStoredSession(KEY_A, 'per-day', '/home/afif/one::2026-10-10')).toEqual({
      sessionID: 'ses_b',
      title: 'B',
      generation: 1,
    });
    expect(await getStoredSession(KEY_B, 'per-day', '/home/afif/one::2026-10-09')).toBeNull();
  });

  it('replaces a ref on rollover and keeps the generation', async () => {
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', {
      sessionID: 'ses_old',
      title: 'Old',
      generation: 0,
    });
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', {
      sessionID: 'ses_new',
      title: 'New',
      generation: 1,
    });

    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_new',
      title: 'New',
      generation: 1,
    });
  });

  it('reads refs written in an earlier session (survives restarts)', async () => {
    await setStoredSession(KEY_A, 'sticky', '/home/afif/example', REF);

    const fresh = { getStoredSession };
    expect(await fresh.getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual(REF);
  });

  it('reads a legacy ref without a generation as generation 0', async () => {
    await browser.storage.local.set({
      sessions: { [KEY_A]: { sticky: { '/home/afif/example': { sessionID: 'ses_legacy', title: 'Legacy' } } } },
    });

    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_legacy',
      title: 'Legacy',
      generation: 0,
    });
  });

  it('reads a malformed generation as generation 0 without dropping the ref', async () => {
    await browser.storage.local.set({
      sessions: {
        [KEY_A]: { sticky: { '/home/afif/example': { sessionID: 'ses_bad', title: 'Bad', generation: -2 } } },
      },
    });

    expect(await getStoredSession(KEY_A, 'sticky', '/home/afif/example')).toEqual({
      sessionID: 'ses_bad',
      title: 'Bad',
      generation: 0,
    });
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
