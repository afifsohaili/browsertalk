import { describe, expect, it } from 'vitest';
import type { BackendStatus, ConnectionState } from '@/lib/agent-backend/interface';
import {
  CONNECTION_ACTIONS,
  CONNECTION_LABELS,
  OPENCODE_REQUIRED,
  OPENCODE_UPGRADE_COMMAND,
  connectedSummary,
  connectionState,
  isSupportedOpenCodeVersion,
} from './status';

const STATES: ConnectionState[] = ['unreachable', 'unpaired', 'unauthorized', 'incompatible', 'connected'];

describe('isSupportedOpenCodeVersion', () => {
  it('accepts the opencode 2 line', () => {
    expect(isSupportedOpenCodeVersion('2.0.24')).toBe(true);
    expect(isSupportedOpenCodeVersion('2.0.32')).toBe(true);
    expect(isSupportedOpenCodeVersion('2.1.0-beta')).toBe(true);
    expect(isSupportedOpenCodeVersion('2.0.0-rc.1+build.5')).toBe(true);
  });

  it('rejects other majors and empty values', () => {
    expect(isSupportedOpenCodeVersion('3.0.0')).toBe(false);
    expect(isSupportedOpenCodeVersion('1.9.9')).toBe(false);
    expect(isSupportedOpenCodeVersion('20.0.0')).toBe(false);
    expect(isSupportedOpenCodeVersion('20.1')).toBe(false);
    expect(isSupportedOpenCodeVersion('')).toBe(false);
  });

  it('rejects malformed 2.x forms', () => {
    expect(isSupportedOpenCodeVersion('2.')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.garbage')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32-')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32 extra')).toBe(false);
  });

  it('rejects numeric prerelease identifiers with leading zeros', () => {
    expect(isSupportedOpenCodeVersion('2.0.32-01')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32-beta.01')).toBe(false);
  });

  it('accepts build identifiers with leading zeros', () => {
    expect(isSupportedOpenCodeVersion('2.0.0+build.01')).toBe(true);
  });

  it('rejects empty dot-separated prerelease and build identifiers', () => {
    expect(isSupportedOpenCodeVersion('2.0.32-.')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32-beta..1')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32+.')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32-')).toBe(false);
    expect(isSupportedOpenCodeVersion('2.0.32+')).toBe(false);
  });
});

describe('connection state copy', () => {
  it('names a label and one next action for every state', () => {
    for (const state of STATES) {
      expect(CONNECTION_LABELS[state].length).toBeGreaterThan(0);
      expect(CONNECTION_ACTIONS[state].length).toBeGreaterThan(0);
    }
  });

  it('names the upgrade command for an incompatible server', () => {
    expect(CONNECTION_ACTIONS.incompatible).toBe(`Run ${OPENCODE_UPGRADE_COMMAND}`);
    expect(OPENCODE_REQUIRED).toBe('Browsertalk needs opencode 2');
  });
});

describe('connectionState', () => {
  it('uses the adapter state when present', () => {
    expect(connectionState({ ok: false, detail: 'x', state: 'unauthorized' })).toBe('unauthorized');
    expect(connectionState({ ok: true, detail: 'x', state: 'connected' })).toBe('connected');
  });

  it('falls back for adapters that report no onboarding state', () => {
    expect(connectionState({ ok: true, detail: 'fake backend' })).toBe('connected');
    expect(connectionState({ ok: false, detail: 'nope' })).toBe('unpaired');
  });
});

describe('connectedSummary', () => {
  const status: BackendStatus = {
    ok: true,
    detail: 'opencode 2.0.24',
    state: 'connected',
    endpoint: 'http://127.0.0.1:29422',
    version: '2.0.24',
  };

  it('shows the version and host from the probe', () => {
    expect(connectedSummary(status)).toBe('Connected: opencode 2.0.24 at 127.0.0.1:29422');
  });

  it('degrades honestly when the probe carried no version or endpoint', () => {
    expect(connectedSummary({ ok: true, detail: 'fake backend' })).toBe('Connected: opencode');
  });

  it('drops an unreadable endpoint instead of failing the card', () => {
    expect(connectedSummary({ ...status, endpoint: 'not a url' })).toBe('Connected: opencode 2.0.24');
  });
});
