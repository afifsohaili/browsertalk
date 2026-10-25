import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { connectionKey, type ConnectionIdentity } from '@/lib/connection/identity';
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

/** Reset snapshots the counter so a check that starts during its identity read can win. */
export function currentStatusGeneration(): number {
  return statusGeneration;
}

/** Claims the counter only while the snapshot is still newest; a newer check keeps the claim. */
export function claimStatusGenerationIfCurrent(generation: number): number | null {
  if (generation !== statusGeneration) return null;
  return nextStatusGeneration();
}

/**
 * Reset removes one connection's token while its check may still be holding a server response.
 * Stamps that connection so a check that already began cannot paint; checks for other
 * connections or checks that begin later keep their authority (020e, review F3a-1).
 */
const invalidatedThrough = new Map<string, number>();

/** Reset committed the token removal; checks that began at or before it used the removed credential. */
export function invalidateStatusChecks(connection: string): void {
  invalidatedThrough.set(connection, statusGeneration);
}

export async function configuredConnection(): Promise<ConnectionIdentity> {
  const { backendId, serverUrl } = await getSettings();
  return { backendId, endpoint: serverUrl };
}

export async function configuredConnectionKey(): Promise<string> {
  return connectionKey(await configuredConnection());
}

/** A stale check, or one for a connection that is no longer configured, cannot paint the badge. */
export async function writeBadgeIfCurrent(
  generation: number,
  connection: string,
  write: () => Promise<void>,
): Promise<void> {
  if (generation !== statusGeneration) return;
  if (generation <= (invalidatedThrough.get(connection) ?? 0)) return;
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
