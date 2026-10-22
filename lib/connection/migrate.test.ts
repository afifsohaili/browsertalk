import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { acceptConsent } from '@/lib/consent/consent';
import { captureQueuedDestination } from '@/lib/connection/destinations';
import { bindOrigin, pairWithServer, pingConnection } from '@/lib/connection/service';
import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import { sendQueuedItem } from '@/lib/send/send';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { getToken } from '@/lib/storage/auth';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { getBoundProject, getOriginBindings } from '@/lib/storage/projects';
import { readSent } from '@/lib/storage/sent';
import { getStoredSession } from '@/lib/storage/sessions';
import { getSettings } from '@/lib/storage/settings';
import { appendToOutbox } from '@/lib/storage/writer';
import { migrateLegacyConnectionStorage } from './migrate';

const BASE = 'http://127.0.0.1:15001';
const KEY = `opencode@${BASE}`;
const LEGACY_REF = { sessionID: 'ses_old', title: 'Browsertalk · example · 2026-10-09' };
const QUARANTINED_FAKE =
  'This feedback was queued for the "fake" backend, which this build no longer offers — discard it and queue it again';

registerBuiltinBackends();
registerBuiltinSessionStrategies();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

  afterEach(() => {
    resetOpenCodeFetch();
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

  it('keeps already-scoped data and consumes the legacy leftovers in the same pass', async () => {
    await seedLegacy();
    await browser.storage.local.set({
      'auth.tokens': { [KEY]: 'tok_scoped' },
      'projects.byOrigin': { [KEY]: { 'https://example.com': '/home/afif/scoped' } },
      sessions: {
        opencode: { 'per-day': { '/home/afif/example::2026-10-09': LEGACY_REF } },
        [KEY]: { 'per-day': { '/home/afif/example::2026-10-09': { sessionID: 'ses_scoped', title: 'new' } } },
      },
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
    expect(raw['auth.token']).toBeUndefined();
    expect((raw.sessions as Record<string, unknown>).opencode).toBeUndefined();
  });

  it('never lets a scoped-first migration hand the legacy token or refs to a later endpoint', async () => {
    await seedLegacy();
    await browser.storage.local.set({
      'auth.tokens': { [KEY]: 'tok_scoped' },
      sessions: {
        opencode: { 'per-day': { '/home/afif/example::2026-10-09': LEGACY_REF } },
        [KEY]: { 'per-day': { '/home/afif/example::2026-10-09': { sessionID: 'ses_scoped', title: 'new' } } },
      },
    });

    await migrateLegacyConnectionStorage();

    const otherKey = 'opencode@http://127.0.0.1:15002';
    await browser.storage.local.set({ 'settings.serverUrl': 'http://127.0.0.1:15002' });
    await migrateLegacyConnectionStorage();

    expect(await getToken(otherKey)).toBeNull();
    expect(await getStoredSession(otherKey, 'per-day', '/home/afif/example::2026-10-09')).toBeNull();
    expect(await getBoundProject(otherKey, 'https://example.com')).toBeNull();
    expect(await getToken(KEY)).toBe('tok_scoped');
  });

  it('merges unrelated legacy refs into the scoped connection without overwriting scoped slots', async () => {
    await seedLegacy();
    await browser.storage.local.set({
      sessions: {
        opencode: {
          'per-day': {
            '/home/afif/example::2026-10-09': LEGACY_REF,
            '/home/afif/other::2026-10-09': { sessionID: 'ses_other', title: 'other' },
          },
        },
        [KEY]: { 'per-day': { '/home/afif/example::2026-10-09': { sessionID: 'ses_scoped', title: 'new' } } },
      },
    });

    await migrateLegacyConnectionStorage();

    expect(await getStoredSession(KEY, 'per-day', '/home/afif/example::2026-10-09')).toEqual({
      sessionID: 'ses_scoped',
      title: 'new',
      generation: 0,
    });
    expect(await getStoredSession(KEY, 'per-day', '/home/afif/other::2026-10-09')).toEqual({
      sessionID: 'ses_other',
      title: 'other',
      generation: 0,
    });

    const raw = await browser.storage.local.get(null);
    expect((raw.sessions as Record<string, unknown>).opencode).toBeUndefined();
  });

  it('never lets a rejected legacy removal hand the credential to another endpoint', async () => {
    await seedLegacy();
    await browser.storage.local.set({ 'auth.tokens': { [KEY]: 'tok_scoped' } });

    const removal = vi
      .spyOn(browser.storage.local, 'remove')
      .mockRejectedValueOnce(new Error('synthetic storage error'));
    await expect(migrateLegacyConnectionStorage()).rejects.toThrow('synthetic storage error');
    removal.mockRestore();

    await browser.storage.local.set({ 'settings.serverUrl': 'http://127.0.0.1:15002' });
    await migrateLegacyConnectionStorage();

    const otherKey = 'opencode@http://127.0.0.1:15002';
    expect(await getToken(otherKey)).toBeNull();
    expect(await getBoundProject(otherKey, 'https://example.com')).toBeNull();
    expect(await getStoredSession(otherKey, 'per-day', '/home/afif/example::2026-10-09')).toBeNull();

    expect(await getToken(KEY)).toBe('tok_scoped');
    expect(await getBoundProject(KEY, 'https://example.com')).toBe('/home/afif/example');
    expect(await getStoredSession(KEY, 'per-day', '/home/afif/example::2026-10-09')).toEqual({
      ...LEGACY_REF,
      generation: 0,
    });

    const raw = await browser.storage.local.get(null);
    expect(raw['auth.token']).toBeUndefined();
    expect(raw['migration.owner']).toEqual({ backendId: 'opencode', endpoint: BASE });
  });

  it('does nothing when there is no legacy data', async () => {
    await migrationNoop();
  });

  it('normalizes a stored test-only backend to opencode before ping, pairing, or delivery', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'fake', 'settings.serverUrl': BASE });
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);

    await migrateLegacyConnectionStorage();

    expect((await getSettings()).backendId).toBe('opencode');

    await expect(resolveConfiguredConnection()).resolves.toMatchObject({
      ok: true,
      connection: { backendId: 'opencode', endpoint: BASE },
    });

    await expect(pingConnection()).resolves.toMatchObject({
      ok: false,
      state: 'unpaired',
      endpoint: BASE,
    });

    await expect(pairWithServer('ABC123')).resolves.toEqual({ ok: true });
    expect(await getToken(KEY)).toBe('tok_live');

    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) throw new Error(resolved.error);
    await bindOrigin({
      origin: 'https://example.com',
      projectDirectory: '/home/afif/example',
      connection: resolved.connection,
    });
    await expect(captureQueuedDestination('https://example.com/page')).resolves.toEqual({
      backendId: 'opencode',
      endpoint: BASE,
      directory: '/home/afif/example',
    });
  });

  it('quarantines a queued fake destination instead of rerouting it to the normalized backend', async () => {
    await acceptConsent();
    await browser.storage.local.set({ 'settings.backendId': 'fake', 'settings.serverUrl': BASE });
    const queued: OutboxItem = {
      id: 'ob_fake',
      comment: 'Queued before the upgrade',
      capturedAt: '2026-10-10T09:05:00.000Z',
      status: 'queued',
      facts: {
        page: { url: 'https://example.com/cart', path: '/cart', query: [], title: 'Cart' },
      },
      destination: { backendId: 'fake', endpoint: BASE, directory: '/tmp/fake' },
    };
    await appendToOutbox(queued);
    const fetchFn = vi.fn<FetchLike>(async () => {
      throw new TypeError('no network in tests');
    });
    setOpenCodeFetch(fetchFn);

    await migrateLegacyConnectionStorage();
    expect((await getSettings()).backendId).toBe('opencode');

    await expect(sendQueuedItem(queued.id, { now: new Date(2026, 9, 10, 12, 0) })).resolves.toEqual({
      ok: false,
      error: QUARANTINED_FAKE,
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(await readOutbox()).toEqual([{ ...queued, error: QUARANTINED_FAKE }]);
    expect(await readSent()).toEqual([]);
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
