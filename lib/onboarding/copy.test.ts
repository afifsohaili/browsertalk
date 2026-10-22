import { describe, expect, it } from 'vitest';
import { REMOTE_PAIRING_WARNING } from '@/lib/connection/status';
import { remoteConfirmationCopy, SETUP_COPY } from './copy';

describe('setup copy', () => {
  it('names the opencode 2 prerequisite', () => {
    expect(SETUP_COPY.prerequisite).toContain('opencode 2');
  });

  it('warns before the link is opened', () => {
    expect(SETUP_COPY.linkWarning).toBe('Copy the link. Do not open it.');
  });

  it('hands the project step to the side panel on a dev site', () => {
    expect(SETUP_COPY.handoff).toBe('Switch to your dev site, then pick a project in the side panel.');
  });

  it('shows the remote origin and the remote-server warning', () => {
    const copy = remoteConfirmationCopy({ origin: 'http://100.64.0.5:4096', warning: REMOTE_PAIRING_WARNING });

    expect(copy).toContain('http://100.64.0.5:4096');
    expect(copy).toContain(REMOTE_PAIRING_WARNING);
  });
});
