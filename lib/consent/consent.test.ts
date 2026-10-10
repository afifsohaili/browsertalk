import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CONSENT_REQUIRED_ERROR,
  acceptConsent,
  declineConsent,
  hasConsent,
  isConsentStatus,
  readConsentStatus,
} from './consent';

describe('feedback disclosure consent', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is undecided before the first choice', async () => {
    expect(await readConsentStatus()).toBeNull();
    expect(await hasConsent()).toBe(false);
  });

  it('records acceptance in storage.local', async () => {
    await acceptConsent();

    expect(await browser.storage.local.get('consent.status')).toEqual({ 'consent.status': 'accepted' });
    expect(await readConsentStatus()).toBe('accepted');
    expect(await hasConsent()).toBe(true);
  });

  it('records decline in storage.local', async () => {
    await declineConsent();

    expect(await browser.storage.local.get('consent.status')).toEqual({ 'consent.status': 'declined' });
    expect(await readConsentStatus()).toBe('declined');
    expect(await hasConsent()).toBe(false);
  });

  it('keeps the recorded choice across reads', async () => {
    await acceptConsent();
    expect(await readConsentStatus()).toBe('accepted');

    await declineConsent();
    expect(await readConsentStatus()).toBe('declined');

    await acceptConsent();
    expect(await readConsentStatus()).toBe('accepted');
    expect(await hasConsent()).toBe(true);
  });

  it('treats junk in storage as undecided', async () => {
    await browser.storage.local.set({ 'consent.status': 'maybe' });

    expect(await readConsentStatus()).toBeNull();
    expect(await hasConsent()).toBe(false);
    expect(isConsentStatus('maybe')).toBe(false);
  });

  it('names the blocker for gated paths', () => {
    expect(CONSENT_REQUIRED_ERROR).toBe('Accept the feedback disclosure first');
  });
});
