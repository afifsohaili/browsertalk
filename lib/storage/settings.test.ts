import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { AgentBackendId } from '@/lib/agent-backend/interface';
import type { SessionStrategyId } from '@/lib/session-strategy/interface';
import {
  DEFAULT_BACKEND_ID,
  DEFAULT_SERVER_URL,
  getSettings,
  setSessionStrategyOverride,
  setSettings,
} from './settings';

describe('settings storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to opencode on the loopback server when nothing is stored', async () => {
    expect(await getSettings()).toEqual({
      backendId: DEFAULT_BACKEND_ID,
      serverUrl: DEFAULT_SERVER_URL,
      sessionStrategy: {},
    });
  });

  it('returns stored values over the defaults', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.serverUrl': 'http://127.0.0.1:4096',
    });

    expect(await getSettings()).toEqual({
      backendId: 'fake',
      serverUrl: 'http://127.0.0.1:4096',
      sessionStrategy: {},
    });
  });

  it('persists partial updates and keeps the other default', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });

    expect(await getSettings()).toEqual({
      backendId: DEFAULT_BACKEND_ID,
      serverUrl: 'http://127.0.0.1:4096',
      sessionStrategy: {},
    });
  });

  it('falls back to the defaults for junk values', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'nope', 'settings.serverUrl': 42 });

    expect(await getSettings()).toEqual({
      backendId: DEFAULT_BACKEND_ID,
      serverUrl: DEFAULT_SERVER_URL,
      sessionStrategy: {},
    });
  });

  it('reads per-backend strategy overrides and drops junk entries', async () => {
    await browser.storage.local.set({
      'settings.sessionStrategy': { opencode: 'sticky', pi: 'nonsense', other: 'per-day', fake: 42 },
    });

    expect((await getSettings()).sessionStrategy).toEqual({ opencode: 'sticky' });
  });

  it('persists a strategy override map', async () => {
    await setSettings({ sessionStrategy: { fake: 'sticky' } });

    expect((await getSettings()).sessionStrategy).toEqual({ fake: 'sticky' });
  });

  it('replaces the whole override map on a later write', async () => {
    await setSettings({ sessionStrategy: { opencode: 'sticky' } });
    await setSettings({ sessionStrategy: { fake: 'per-day' } });

    expect((await getSettings()).sessionStrategy).toEqual({ fake: 'per-day' });
  });

  it('merges a per-backend override without clobbering the others', async () => {
    await setSessionStrategyOverride('opencode', 'sticky');
    await setSessionStrategyOverride('fake', 'per-day');

    expect((await getSettings()).sessionStrategy).toEqual({ opencode: 'sticky', fake: 'per-day' });
  });

  it('clears one backend override and keeps the others', async () => {
    await setSessionStrategyOverride('opencode', 'sticky');
    await setSessionStrategyOverride('fake', 'per-day');
    await setSessionStrategyOverride('fake', null);

    expect((await getSettings()).sessionStrategy).toEqual({ opencode: 'sticky' });
  });

  it('rejects an unknown strategy id and leaves storage untouched', async () => {
    await setSessionStrategyOverride('opencode', 'sticky');

    await expect(
      setSessionStrategyOverride('opencode', 'nope' as SessionStrategyId),
    ).rejects.toThrow('Unknown session strategy "nope"');

    expect((await getSettings()).sessionStrategy).toEqual({ opencode: 'sticky' });
  });

  it('rejects an unknown backend id and leaves storage untouched', async () => {
    await expect(
      setSessionStrategyOverride('nope' as AgentBackendId, 'sticky'),
    ).rejects.toThrow('Unknown agent backend "nope"');

    expect((await getSettings()).sessionStrategy).toEqual({});
  });
});
