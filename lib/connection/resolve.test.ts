import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { AgentBackend, BackendConnectionConfig } from '@/lib/agent-backend/interface';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { setToken } from '@/lib/storage/auth';
import { bindProject } from '@/lib/storage/projects';
import { captureQueuedDestination } from './destinations';
import { connectionBackend, resolveConfiguredConnection, resolveConnection } from './resolve';

let seenConfigs: Array<BackendConnectionConfig | undefined> = [];

beforeAll(() => {
  registerAgentBackend('fake', (config) => {
    seenConfigs.push(config);
    return new FakeAgentBackend();
  });
});

describe('resolveConfiguredConnection', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    seenConfigs = [];
  });

  it('resolves the identity, canonical endpoint, and namespaced token', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.serverUrl': 'http://127.0.0.1:4096/',
    });
    await setToken('fake@http://127.0.0.1:4096', 'tok_fake');

    await expect(resolveConfiguredConnection()).resolves.toEqual({
      ok: true,
      connection: { backendId: 'fake', endpoint: 'http://127.0.0.1:4096', token: 'tok_fake' },
    });
  });

  it('reports no token for another endpoint', async () => {
    await setToken('fake@http://127.0.0.1:15001', 'tok_other');

    const resolved = await resolveConfiguredConnection();

    expect(resolved).toMatchObject({ ok: true, connection: { token: null } });
  });

  it('refuses a non-loopback stored URL with the loopback error', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });

    await expect(resolveConfiguredConnection()).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1',
    });
  });

  it('feeds the captured config to the backend factory', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'fake' });
    await setToken('fake@http://127.0.0.1:15001', 'tok_fake');

    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) throw new Error('expected a resolved connection');

    const backend: AgentBackend = connectionBackend(resolved.connection);

    expect(backend.id).toBe('fake');
    expect(seenConfigs).toEqual([{ baseUrl: 'http://127.0.0.1:15001', token: 'tok_fake' }]);
  });
});

describe('resolveConnection', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    seenConfigs = [];
  });

  it('resolves a captured identity against its own token, ignoring the stored settings', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.serverUrl': 'http://127.0.0.1:4096',
    });
    await setToken('fake@http://127.0.0.1:15001', 'tok_captured');
    await setToken('fake@http://127.0.0.1:4096', 'tok_stored');

    await expect(resolveConnection({ backendId: 'fake', endpoint: 'http://127.0.0.1:15001' })).resolves.toEqual({
      ok: true,
      connection: { backendId: 'fake', endpoint: 'http://127.0.0.1:15001', token: 'tok_captured' },
    });
  });

  it('refuses a non-loopback captured endpoint', async () => {
    await expect(resolveConnection({ backendId: 'fake', endpoint: 'https://example.com' })).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1',
    });
  });
});

describe('captureQueuedDestination', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    seenConfigs = [];
  });

  it('captures the configured connection along with the origin binding', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'fake' });
    await bindProject('fake@http://127.0.0.1:15001', 'https://example.com', '/home/afif/example');

    await expect(captureQueuedDestination('https://example.com/cart?step=2')).resolves.toEqual({
      backendId: 'fake',
      endpoint: 'http://127.0.0.1:15001',
      directory: '/home/afif/example',
    });
  });

  it('stays destinationless without a binding', async () => {
    await expect(captureQueuedDestination('https://unbound.example.org/page')).resolves.toBeNull();
  });

  it('stays destinationless for an unreadable page URL', async () => {
    await expect(captureQueuedDestination('not a url')).resolves.toBeNull();
  });

  it('stays destinationless when the stored URL left loopback', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });

    await expect(captureQueuedDestination('https://example.com/cart')).resolves.toBeNull();
  });
});
