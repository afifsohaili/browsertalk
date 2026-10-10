import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from '@/lib/storage/keys';

export type ConsentStatus = 'accepted' | 'declined';

export const CONSENT_REQUIRED_ERROR = 'Accept the feedback disclosure first';

export const PRIVACY_POLICY_URL = 'https://github.com/afifsohaili/browsertalk/blob/main/PRIVACY.md';

export function isConsentStatus(value: unknown): value is ConsentStatus {
  return value === 'accepted' || value === 'declined';
}

export async function readConsentStatus(): Promise<ConsentStatus | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.consent.status);
  const value = stored[STORAGE_KEYS.consent.status];
  return isConsentStatus(value) ? value : null;
}

export async function acceptConsent(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.consent.status]: 'accepted' });
}

export async function declineConsent(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.consent.status]: 'declined' });
}

export async function hasConsent(): Promise<boolean> {
  return (await readConsentStatus()) === 'accepted';
}
