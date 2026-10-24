import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { connectionKey } from '@/lib/connection/identity';
import { pingConnection } from '@/lib/connection/service';
import { connectionState } from '@/lib/connection/status';
import { getSettings } from '@/lib/storage/settings';

export const SETUP_BADGE_TEXT = '1';

/**
 * Badge checks finish out of order. Only the newest check may paint the badge, and only while its
 * connection is still configured. The surface generation cannot undo a background write.
 */
let statusGeneration = 0;

/** Claims the newest badge check. Pair and reset also call this so older checks cannot repaint. */
export function nextStatusGeneration(): number {
  statusGeneration += 1;
  return statusGeneration;
}

export async function configuredConnectionKey(): Promise<string> {
  const { backendId, serverUrl } = await getSettings();
  return connectionKey({ backendId, endpoint: serverUrl });
}

/** A stale check, or one for a connection that is no longer configured, cannot paint the badge. */
export async function writeBadgeIfCurrent(
  generation: number,
  connection: string,
  write: () => Promise<void>,
): Promise<void> {
  if (generation !== statusGeneration) return;
  if (connection !== (await configuredConnectionKey())) return;
  if (generation !== statusGeneration) return;
  await write();
}

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

/** Re-checks the connection; a failed probe keeps the badge up. A newer check wins. */
export async function syncSetupBadge(read: () => Promise<BackendStatus> = pingConnection): Promise<void> {
  const generation = nextStatusGeneration();
  const connection = await configuredConnectionKey().catch(() => null);
  if (connection === null) {
    if (generation === statusGeneration) await setSetupBadge();
    return;
  }
  try {
    const status = await read();
    await writeBadgeIfCurrent(generation, connection, () => applySetupBadge(status));
  } catch {
    await writeBadgeIfCurrent(generation, connection, setSetupBadge);
  }
}
