import { OPENCODE_UPGRADE_COMMAND } from '@/lib/connection/status';
import type { RemotePairingConfirmation } from '@/lib/connection/protocol';

export const SETUP_COPY = {
  prerequisite: 'Browsertalk needs opencode 2 running on this machine.',
  upgrade: `Browsertalk needs opencode 2. Run ${OPENCODE_UPGRADE_COMMAND}.`,
  runCommand: 'Run this in a terminal:',
  linkWarning: 'Copy the link. Do not open it.',
  expiry: 'Links expire in 5 minutes.',
  credentialLabel: 'Pairing link or code',
  handoff: 'Switch to your dev site, then pick a project in the side panel.',
  pin: 'Pin Browsertalk to the toolbar: open the extensions menu, then pin Browsertalk.',
  openPanel: 'Open side panel',
  copyFailed: 'Could not copy. Select the command and copy it.',
} as const;

/** Names the remote origin before the user confirms the link. */
export function remoteConfirmationCopy(remote: RemotePairingConfirmation): string {
  return `The link points to ${remote.origin}. ${remote.warning}`;
}
