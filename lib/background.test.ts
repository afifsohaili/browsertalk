// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acceptConsent } from '@/lib/consent/consent';
import { requestArmPicker } from '@/lib/picker/messages';
import background from '@/entrypoints/background';

const bootMigration = vi.hoisted(() => {
  let release = (): void => {};
  let enter = (): void => {};
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { entered, held, release: () => release(), enter: () => enter() };
});

vi.mock('@/lib/connection/migrate', () => ({
  migrateLegacyConnectionStorage: () => {
    bootMigration.enter();
    return bootMigration.held;
  },
}));
vi.mock('@/lib/onboarding/install', () => ({ registerOnboardingHandler: vi.fn() }));
vi.mock('@/lib/agent-backend', () => ({ registerBuiltinBackends: vi.fn() }));
vi.mock('@/lib/session-strategy', () => ({ registerBuiltinSessionStrategies: vi.fn() }));
vi.mock('@/lib/connection/messages', () => ({ registerConnectionHandler: vi.fn() }));
vi.mock('@/lib/composer/messages', () => ({ registerComposerHandler: vi.fn() }));
vi.mock('@/lib/panel/messages', () => ({ registerPanelHandler: vi.fn() }));
vi.mock('@/lib/picker/handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/picker/handler')>();
  return { ...actual, registerPickerTriggers: vi.fn() };
});

const originalQuery = browser.tabs.query;
const originalSend = browser.tabs.sendMessage;

describe('background boot', () => {
  afterEach(() => {
    browser.tabs.query = originalQuery;
    browser.tabs.sendMessage = originalSend;
    vi.restoreAllMocks();
  });

  it('answers the picker arm request while the boot migration is still running', async () => {
    fakeBrowser.reset();
    await acceptConsent();
    browser.tabs.query = vi.fn(async () => [{ id: 7, url: 'https://example.com/cart' }]) as unknown as typeof browser.tabs.query;
    browser.tabs.sendMessage = vi.fn(async () => ({ ok: true, armed: true })) as unknown as typeof browser.tabs.sendMessage;

    const running = background.main();
    await bootMigration.entered;

    const result = await requestArmPicker();
    bootMigration.release();
    await running;

    expect(result).toEqual({ ok: true, armed: true });
  });
});
