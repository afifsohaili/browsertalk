import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { pingConnection } from '@/lib/connection/service';
import { connectionState } from '@/lib/connection/status';

export const SETUP_BADGE_TEXT = '1';

export async function setSetupBadge(): Promise<void> {
  await writeBadge(SETUP_BADGE_TEXT);
}

export async function clearSetupBadge(): Promise<void> {
  await writeBadge('');
}

/** The badge is cosmetic; never fail a connection flow because it could not be painted. */
async function writeBadge(text: string): Promise<void> {
  try {
    await browser.action.setBadgeText({ text });
  } catch {
    /* no toolbar in this context */
  }
}

/** Keeps the toolbar badge up until the connection reports ready. */
export async function applySetupBadge(status: BackendStatus): Promise<void> {
  if (connectionState(status) === 'connected') {
    await clearSetupBadge();
    return;
  }
  await setSetupBadge();
}

/** Re-checks the connection; a failed probe keeps the badge up. */
export async function syncSetupBadge(read: () => Promise<BackendStatus> = pingConnection): Promise<void> {
  try {
    await applySetupBadge(await read());
  } catch {
    await setSetupBadge();
  }
}
