import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type { SessionCreateInput, SessionRef } from '@/lib/agent-backend/interface';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { sendQueuedItem } from '@/lib/send/send';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { bindProject } from '@/lib/storage/projects';
import { getStoredSession } from '@/lib/storage/sessions';
import { appendToOutbox, writeStoredSession } from '@/lib/storage/writer';
import { setSettings } from '@/lib/storage/settings';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { readSent } from '@/lib/storage/sent';
import {
  registerPanelHandler,
  requestOutboxDiscard,
  requestOutboxRetry,
  requestSessionRollover,
  requestTargetRead,
} from './messages';

const ORIGIN = 'https://example.com';
const DIRECTORY = '/home/afif/example';
const STICKY_TITLE = 'Browsertalk · example';
const KEY = 'fake@http://127.0.0.1:15001';
const OPENCODE_KEY = 'opencode@http://127.0.0.1:15001';
const GATED_KEY = 'gated@http://127.0.0.1:15001';

class GatedCreateBackend extends FakeAgentBackend {
  readonly startedCreates: SessionCreateInput[] = [];
  readonly pendingCreates: Array<() => void> = [];

  override async createSession(input: SessionCreateInput): Promise<SessionRef> {
    this.startedCreates.push(input);
    await new Promise<void>((resolve) => {
      this.pendingCreates.push(resolve);
    });
    return super.createSession(input);
  }

  releaseCreate(): void {
    this.pendingCreates.shift()?.();
  }
}

let gatedBackend = new GatedCreateBackend();

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
    registerAgentBackend('gated', () => gatedBackend);
  });

  beforeEach(async () => {
    fakeBrowser.reset();
    registerPanelHandler();
    gatedBackend = new GatedCreateBackend();
    await setSettings({ backendId: 'fake', sessionStrategy: { fake: 'sticky' } });
    await bindProject(KEY, ORIGIN, DIRECTORY);
  });

  it('reads the bound target with the stored session', async () => {
    await writeStoredSession(KEY, 'sticky', DIRECTORY, { sessionID: 'ses_seed', title: 'My review thread', generation: 0 });

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
    await bindProject(OPENCODE_KEY, ORIGIN, DIRECTORY);
    const failed = item({ error: 'old failure' });
    await appendToOutbox(failed);

    await expect(requestOutboxRetry(failed.id)).resolves.toEqual({ ok: false, error: 'Not paired' });

    expect((await readOutbox())[0]?.error).toBe('Not paired');
    expect(await readSent()).toEqual([]);
  });

  it('rolls the session over and continues on the fresh one', async () => {
    await writeStoredSession(KEY, 'sticky', DIRECTORY, { sessionID: 'ses_old', title: 'Old thread', generation: 0 });

    await expect(requestSessionRollover(ORIGIN)).resolves.toEqual({
      ok: true,
      session: { id: 'ses_fake_1', title: STICKY_TITLE },
    });

    expect(await getStoredSession(KEY, 'sticky', DIRECTORY)).toEqual({
      sessionID: 'ses_fake_1',
      title: STICKY_TITLE,
      generation: 1,
    });
    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({
      ok: true,
      target: { project: DIRECTORY, session: { id: 'ses_fake_1', title: STICKY_TITLE } },
    });
  });

  it('withholds a rollover while the first send is resolving its session', async () => {
    await setSettings({ backendId: 'gated', sessionStrategy: { gated: 'sticky' } });
    await bindProject(GATED_KEY, ORIGIN, DIRECTORY);
    await appendToOutbox(
      item({ destination: { backendId: 'gated', endpoint: 'http://127.0.0.1:15001', directory: DIRECTORY } }),
    );

    const send = sendQueuedItem('ob_1');
    await vi.waitFor(() => {
      expect(gatedBackend.startedCreates).toHaveLength(1);
    });

    const rollover = requestSessionRollover(ORIGIN);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(gatedBackend.startedCreates).toHaveLength(1);

    gatedBackend.releaseCreate();
    await expect(send).resolves.toMatchObject({ ok: true });

    await vi.waitFor(() => {
      expect(gatedBackend.startedCreates).toHaveLength(2);
    });
    expect(gatedBackend.startedCreates[1]?.intent.generation).toBe(1);

    gatedBackend.releaseCreate();
    const rolloverResult = await rollover;
    expect(rolloverResult.ok).toBe(true);
    if (!rolloverResult.ok) throw new Error('expected the rollover to succeed');

    expect(await getStoredSession(GATED_KEY, 'sticky', DIRECTORY)).toEqual({
      sessionID: rolloverResult.session.id,
      title: STICKY_TITLE,
      generation: 1,
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
    await bindProject(OPENCODE_KEY, ORIGIN, DIRECTORY);

    await expect(requestSessionRollover(ORIGIN)).resolves.toEqual({ ok: false, error: 'Not paired' });
    expect(await getStoredSession(OPENCODE_KEY, 'per-day', `${DIRECTORY}::2026-10-10`)).toBeNull();
    expect(await getStoredSession(OPENCODE_KEY, 'sticky', DIRECTORY)).toBeNull();
  });

  it('discards an item through the background writer', async () => {
    await appendToOutbox(item({ id: 'ob_keep', comment: 'keep' }));
    await appendToOutbox(item({ id: 'ob_drop', comment: 'drop' }));

    const broadcasts: unknown[] = [];
    browser.runtime.onMessage.addListener((message: unknown) => {
      broadcasts.push(message);
      return undefined;
    });

    await expect(requestOutboxDiscard('ob_drop')).resolves.toEqual({ ok: true });

    expect((await readOutbox()).map((entry) => entry.id)).toEqual(['ob_keep']);
    expect(broadcasts).toContainEqual({ type: 'outbox/changed' });
  });

  it('falls back honestly when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestTargetRead(ORIGIN)).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestOutboxRetry('ob_1')).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestOutboxDiscard('ob_1')).resolves.toEqual({ ok: false, error: 'Background unavailable' });
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
