import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acceptConsent, readConsentStatus } from './consent';
import { useConsent, type ConsentView } from './use-consent';

function triggerEvent(event: unknown, ...args: unknown[]): Promise<unknown> {
  return (event as { trigger: (...a: unknown[]) => Promise<unknown> }).trigger(...args);
}

function scopeConsent(): { consent: ConsentView; stop: () => void } {
  const scope = effectScope();
  const consent = scope.run(() => useConsent())!;
  return { consent, stop: () => scope.stop() };
}

async function loadedConsent(): Promise<{ consent: ConsentView; stop: () => void }> {
  const created = scopeConsent();
  await vi.waitFor(() => {
    expect(created.consent.loaded.value).toBe(true);
  });
  return created;
}

describe('consent view', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts undecided and not accepted', async () => {
    const { consent, stop } = await loadedConsent();

    expect(consent.status.value).toBeNull();
    expect(consent.accepted.value).toBe(false);
    stop();
  });

  it('accepts and updates the view', async () => {
    const { consent, stop } = await loadedConsent();

    await consent.accept();

    expect(consent.status.value).toBe('accepted');
    expect(consent.accepted.value).toBe(true);
    expect(await readConsentStatus()).toBe('accepted');
    stop();
  });

  it('declines and updates the view', async () => {
    const { consent, stop } = await loadedConsent();

    await consent.decline();

    expect(consent.status.value).toBe('declined');
    expect(consent.accepted.value).toBe(false);
    expect(await readConsentStatus()).toBe('declined');
    stop();
  });

  it('loads a previously recorded acceptance', async () => {
    await acceptConsent();

    const { consent, stop } = await loadedConsent();

    expect(consent.accepted.value).toBe(true);
    stop();
  });

  it('follows a choice made in another surface', async () => {
    const { consent, stop } = await loadedConsent();

    await browser.storage.local.set({ 'consent.status': 'accepted' });
    await triggerEvent(browser.storage.local.onChanged, { 'consent.status': { newValue: 'accepted' } });

    await vi.waitFor(() => {
      expect(consent.accepted.value).toBe(true);
    });
    stop();
  });

  it('ignores unrelated storage changes', async () => {
    const { consent, stop } = await loadedConsent();

    await triggerEvent(browser.storage.local.onChanged, { 'outbox': { newValue: [] } });

    expect(consent.status.value).toBeNull();
    stop();
  });

  it('stops listening when the scope stops', async () => {
    const { consent, stop } = await loadedConsent();
    stop();

    await browser.storage.local.set({ 'consent.status': 'accepted' });
    await triggerEvent(browser.storage.local.onChanged, { 'consent.status': { newValue: 'accepted' } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(consent.accepted.value).toBe(false);
  });
});
