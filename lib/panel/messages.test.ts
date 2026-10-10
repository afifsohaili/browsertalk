import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { bindProject } from '@/lib/storage/projects';
import { getStoredSession, setStoredSession } from '@/lib/storage/sessions';
import { setSettings } from '@/lib/storage/settings';
import { appendToOutbox, readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { readSent } from '@/lib/storage/sent';
import {
  registerPanelHandler,
  requestOutboxRetry,
  requestSessionRollover,
  requestTargetRead,
} from './messages';

const ORIGIN = 'https://example.com';
const DIRECTORY = '/home/afif/example';
const STICKY_TITLE = 'Browsertalk · example';

function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'ob_1',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: { url: `${ORIGIN}/cart?step=2`, path: '/cart', query: [{ name: 'step', value: '2' }], title: 'Cart' },
    },
    ...overrides,
  };
}

describe('panel messaging', () => {
  beforeAll(() => {
    registerBuiltinBackends();
    registerBuiltinSessionStrategies();
  });

  beforeEach(async () => {
    fakeBrowser.reset();
    registerPanelHandler();
    await setSettings({ backendId: 'fake', sessionStrategy: { fake: 'sticky' } });
    await bindProject(ORIGIN, DIRECTORY);
  });

  it('reads the bound target with the stored session', async () => {
    await setStoredSession('fake', 'sticky', DIRECTORY, { sessionID: 'ses_seed', title: 'My review thread' });

    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({
      ok: true,
      target: { project: DIRECTORY, session: { id: 'ses_seed', title: 'My review thread' } },
    });
  });

  it('reports an unbound origin without a project or session', async () => {
    await expect(requestTargetRead('https://unbound.example.org')).resolves.toEqual({
      ok: true,
      target: { project: null, session: null },
    });
  });

  it('reports no session before the first feedback', async () => {
    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({
      ok: true,
      target: { project: DIRECTORY, session: null },
    });
  });

  it('retries a failed item through the send pipeline', async () => {
    const failed = item({ error: 'The opencode server returned HTTP 500' });
    await appendToOutbox(failed);

    await expect(requestOutboxRetry(failed.id)).resolves.toEqual({ ok: true });

    expect(await readOutbox()).toEqual([]);
    const sent = await readSent();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      id: failed.id,
      comment: 'Checkout button is broken',
      session: { title: STICKY_TITLE },
      page: { title: 'Cart' },
    });
  });

  it('keeps the item and reports the error when the retry fails', async () => {
    await setSettings({ backendId: 'opencode' });
    const failed = item({ error: 'old failure' });
    await appendToOutbox(failed);

    await expect(requestOutboxRetry(failed.id)).resolves.toEqual({ ok: false, error: 'Not paired' });

    expect((await readOutbox())[0]?.error).toBe('Not paired');
    expect(await readSent()).toEqual([]);
  });

  it('rolls the session over and continues on the fresh one', async () => {
    await setStoredSession('fake', 'sticky', DIRECTORY, { sessionID: 'ses_old', title: 'Old thread' });

    await expect(requestSessionRollover(ORIGIN)).resolves.toEqual({
      ok: true,
      session: { id: 'ses_fake_1', title: STICKY_TITLE },
    });

    expect(await getStoredSession('fake', 'sticky', DIRECTORY)).toEqual({
      sessionID: 'ses_fake_1',
      title: STICKY_TITLE,
    });
    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({
      ok: true,
      target: { project: DIRECTORY, session: { id: 'ses_fake_1', title: STICKY_TITLE } },
    });
  });

  it('refuses a rollover for an unbound origin', async () => {
    await expect(requestSessionRollover('https://unbound.example.org')).resolves.toEqual({
      ok: false,
      error: 'This site has no project binding',
    });
  });

  it('reports a backend failure during rollover without storing a session', async () => {
    await setSettings({ backendId: 'opencode' });

    await expect(requestSessionRollover(ORIGIN)).resolves.toEqual({ ok: false, error: 'Not paired' });
    expect(await getStoredSession('opencode', 'per-day', `${DIRECTORY}::2026-10-10`)).toBeNull();
    expect(await getStoredSession('opencode', 'sticky', DIRECTORY)).toBeNull();
  });

  it('falls back honestly when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestOutboxRetry('ob_1')).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestSessionRollover(ORIGIN)).resolves.toEqual({
      ok: false,
      error: 'Background unavailable',
    });
  });

  it('leaves messages for other modules alone', async () => {
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse('other module');
      return true;
    });

    await expect(browser.runtime.sendMessage({ type: 'outbox/count' })).resolves.toBe('other module');
  });
});
