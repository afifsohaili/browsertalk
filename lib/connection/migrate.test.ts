import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getToken } from '@/lib/storage/auth';
import { getBoundProject, getOriginBindings } from '@/lib/storage/projects';
import { getStoredSession } from '@/lib/storage/sessions';
import { migrateLegacyConnectionStorage } from './migrate';

const BASE = 'http://127.0.0.1:15001';
const KEY = `opencode@${BASE}`;
const LEGACY_REF = { sessionID: 'ses_old', title: 'Browsertalk · example · 2026-10-09' };

async function seedLegacy(): Promise<void> {
  await browser.storage.local.set({
    'settings.backendId': 'opencode',
    'settings.serverUrl': BASE,
    'auth.token': 'tok_legacy',
    'projects.byOrigin': { 'https://example.com': '/home/afif/example' },
    sessions: {
      opencode: { 'per-day': { '/home/afif/example::2026-10-09': LEGACY_REF } },
      fake: { sticky: { '/tmp/fake': { sessionID: 'ses_dev', title: 'dev' } } },
    },
  });
}

describe('migrateLegacyConnectionStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('claims legacy tokens, bindings, and refs for the configured connection', async () => {
    await seedLegacy();

    await migrateLegacyConnectionStorage();

    expect(await getToken(KEY)).toBe('tok_legacy');
    expect(await getBoundProject(KEY, 'https://example.com')).toBe('/home/afif/example');
    expect(await getStoredSession(KEY, 'per-day', '/home/afif/example::2026-10-09')).toEqual({
      ...LEGACY_REF,
      generation: 0,
    });

    const raw = await browser.storage.local.get(null);
    expect(raw['auth.token']).toBeUndefined();
    expect(raw['projects.byOrigin']).toEqual({ [KEY]: { 'https://example.com': '/home/afif/example' } });
    expect(raw.sessions).toEqual({
      [KEY]: { 'per-day': { '/home/afif/example::2026-10-09': LEGACY_REF } },
      fake: { sticky: { '/tmp/fake': { sessionID: 'ses_dev', title: 'dev' } } },
    });
  });

  it('never claims legacy data for a non-loopback stored URL', async () => {
    await seedLegacy();
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });

    await migrateLegacyConnectionStorage();

    const raw = await browser.storage.local.get(null);
    expect(raw['auth.token']).toBe('tok_legacy');
    expect(raw['projects.byOrigin']).toEqual({ 'https://example.com': '/home/afif/example' });
    expect(raw.sessions).toEqual({
      opencode: { 'per-day': { '/home/afif/example::2026-10-09': LEGACY_REF } },
      fake: { sticky: { '/tmp/fake': { sessionID: 'ses_dev', title: 'dev' } } },
    });
  });

  it('is idempotent', async () => {
    await seedLegacy();

    await migrateLegacyConnectionStorage();
    const first = await browser.storage.local.get(null);
    await migrateLegacyConnectionStorage();
    const second = await browser.storage.local.get(null);

    expect(second).toEqual(first);
    expect(await getToken(KEY)).toBe('tok_legacy');
  });

  it('keeps already-scoped data and never overwrites it with legacy data', async () => {
    await seedLegacy();
    await browser.storage.local.set({
      'auth.tokens': { [KEY]: 'tok_scoped' },
      'projects.byOrigin': { [KEY]: { 'https://example.com': '/home/afif/scoped' } },
      sessions: { [KEY]: { 'per-day': { '/home/afif/example::2026-10-09': { sessionID: 'ses_scoped', title: 'new' } } } },
    });

    await migrateLegacyConnectionStorage();

    expect(await getToken(KEY)).toBe('tok_scoped');
    expect(await getBoundProject(KEY, 'https://example.com')).toBe('/home/afif/scoped');
    expect(await getStoredSession(KEY, 'per-day', '/home/afif/example::2026-10-09')).toEqual({
      sessionID: 'ses_scoped',
      title: 'new',
      generation: 0,
    });

    const raw = await browser.storage.local.get(null);
    expect(raw['auth.token']).toBe('tok_legacy');
  });

  it('does nothing when there is no legacy data', async () => {
    await migrationNoop();
  });
});

async function migrationNoop(): Promise<void> {
  await browser.storage.local.set({ 'settings.backendId': 'opencode', 'settings.serverUrl': BASE });
  await migrateLegacyConnectionStorage();
  expect(await browser.storage.local.get(null)).toEqual({
    'settings.backendId': 'opencode',
    'settings.serverUrl': BASE,
  });
}
