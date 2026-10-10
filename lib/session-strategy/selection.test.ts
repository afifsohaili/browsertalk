import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { OpenCodeBackend } from '@/lib/agent-backend/opencode';
import { setSessionStrategyOverride, setSettings } from '@/lib/storage/settings';
import { registerBuiltinSessionStrategies } from './builtins';
import { pickSessionStrategyId, resolveActiveSessionStrategy } from './selection';

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
});
