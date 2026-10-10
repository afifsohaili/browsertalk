import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { OpenCodeBackend } from '@/lib/agent-backend/opencode';
import { setToken } from '@/lib/storage/auth';
import { setSessionStrategyOverride, setSettings } from '@/lib/storage/settings';
import { registerBuiltinSessionStrategies } from './builtins';
import { pickSessionStrategyId, resolveActiveSessionStrategy, resolveSessionStrategyFor } from './selection';

describe('session strategy selection', () => {
  beforeAll(() => {
    registerBuiltinBackends();
    registerBuiltinSessionStrategies();
  });

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to the backend strategy when no override is stored', () => {
    expect(pickSessionStrategyId(new OpenCodeBackend(), undefined)).toBe('per-day');
    expect(pickSessionStrategyId(new FakeAgentBackend(), undefined)).toBe('per-day');
  });

  it('lets a stored override beat the backend default', () => {
    expect(pickSessionStrategyId(new FakeAgentBackend(), 'sticky')).toBe('sticky');
  });

  it('ignores junk overrides', () => {
    expect(pickSessionStrategyId(new FakeAgentBackend(), 'nope')).toBe('per-day');
    expect(pickSessionStrategyId(new FakeAgentBackend(), 42)).toBe('per-day');
  });

  it('resolves the active strategy from the stored settings', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.sessionStrategy': { fake: 'sticky' },
    });

    const active = await resolveActiveSessionStrategy();

    expect(active.backend.id).toBe('fake');
    expect(active.strategy.id).toBe('sticky');
    expect(active.connectionKey).toBe('fake@http://127.0.0.1:15001');
  });

  it('scopes the connection to the canonical stored endpoint', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.serverUrl': 'http://127.0.0.1:4096/',
    });

    const active = await resolveActiveSessionStrategy();

    expect(active.connectionKey).toBe('fake@http://127.0.0.1:4096');
  });

  it('refuses to resolve against a non-loopback server URL', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'fake', 'settings.serverUrl': 'https://example.com' });

    await expect(resolveActiveSessionStrategy()).rejects.toThrow('The server must be on this machine');
  });

  it('falls back to the backend default when the override targets another backend', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.sessionStrategy': { opencode: 'sticky' },
    });

    const active = await resolveActiveSessionStrategy();

    expect(active.strategy.id).toBe('per-day');
  });

  it('applies settings changes on the next resolve without a reload', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'fake' });
    expect((await resolveActiveSessionStrategy()).backend.id).toBe('fake');

    await setSettings({ backendId: 'opencode' });
    expect((await resolveActiveSessionStrategy()).backend.id).toBe('opencode');

    await setSettings({ backendId: 'fake' });
    await setSessionStrategyOverride('fake', 'sticky');
    expect((await resolveActiveSessionStrategy()).strategy.id).toBe('sticky');

    await setSessionStrategyOverride('fake', null);
    expect((await resolveActiveSessionStrategy()).strategy.id).toBe('per-day');
  });

  it('resolves the strategy, key, and token for a captured connection', async () => {
    await setSettings({ sessionStrategy: { fake: 'sticky' } });
    await setToken('fake@http://127.0.0.1:15001', 'tok_captured');

    const active = await resolveSessionStrategyFor({ backendId: 'fake', endpoint: 'http://127.0.0.1:15001' });

    expect(active.backend.id).toBe('fake');
    expect(active.strategy.id).toBe('sticky');
    expect(active.connectionKey).toBe('fake@http://127.0.0.1:15001');
    expect(active.connection).toEqual({
      backendId: 'fake',
      endpoint: 'http://127.0.0.1:15001',
      token: 'tok_captured',
    });
  });

  it('ignores the stored connection when resolving a captured one', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'opencode',
      'settings.serverUrl': 'http://127.0.0.1:4096',
    });

    const active = await resolveSessionStrategyFor({ backendId: 'fake', endpoint: 'http://127.0.0.1:15001' });

    expect(active.backend.id).toBe('fake');
    expect(active.connectionKey).toBe('fake@http://127.0.0.1:15001');
  });

  it('refuses a non-loopback captured endpoint', async () => {
    await expect(resolveSessionStrategyFor({ backendId: 'fake', endpoint: 'https://example.com' })).rejects.toThrow(
      'The server must be on this machine',
    );
  });
});
