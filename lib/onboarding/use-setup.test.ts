import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import type { RemotePairingConfirmation } from '@/lib/connection/protocol';
import type { Connection } from '@/lib/connection/use-connection';
import { setupStep, showsPairForm, useSetup } from './use-setup';

function connectionStub(status: BackendStatus | null): Connection {
  const remoteConfirmation = ref<RemotePairingConfirmation | null>(null);
  return {
    status: ref(status),
    onboarding: ref(null),
    pairing: ref(false),
    pairError: ref(null),
    remoteConfirmation,
    pair: vi.fn(async () => true),
    confirmRemote: vi.fn(async () => true),
    cancelRemote: vi.fn(() => {
      remoteConfirmation.value = null;
    }),
    forget: vi.fn(async () => true),
    refresh: vi.fn(async () => {}),
  };
}

describe('setup step', () => {
  it.each([
    [null, 'checking'],
    [{ ok: false, detail: 'down', state: 'unreachable' }, 'prerequisite'],
    [{ ok: false, detail: 'wrong version', state: 'incompatible' }, 'upgrade'],
    [{ ok: false, detail: 'Not paired', state: 'unpaired' }, 'pair'],
    [{ ok: false, detail: 'rejected', state: 'unauthorized' }, 'pair'],
    [{ ok: true, detail: 'opencode 2.0.32', state: 'connected' }, 'project'],
  ] as const)('maps %j to %s', (status, expected) => {
    expect(setupStep(status, null)).toBe(expected);
  });

  it('puts a remote link ahead of the unpaired state', () => {
    const remote = { origin: 'http://100.64.0.5:4096', warning: 'crosses your network' };

    expect(setupStep({ ok: false, detail: 'Not paired', state: 'unpaired' }, remote)).toBe('remote');
  });
});

describe('pair form visibility', () => {
  it('shows the form when the saved server is unreachable', () => {
    expect(showsPairForm('prerequisite')).toBe(true);
  });

  it('shows the form when unpaired or confirming a remote link', () => {
    expect(showsPairForm('pair')).toBe(true);
    expect(showsPairForm('remote')).toBe(true);
  });

  it('hides the form while checking, upgrading, or connected', () => {
    expect(showsPairForm('checking')).toBe(false);
    expect(showsPairForm('upgrade')).toBe(false);
    expect(showsPairForm('project')).toBe(false);
  });
});

describe('useSetup', () => {
  it('pairs the pasted credential and clears the field on success', async () => {
    const connection = connectionStub({ ok: false, detail: 'Not paired', state: 'unpaired' });
    const setup = useSetup(connection);
    setup.credential.value = '  ABC123  ';

    await expect(setup.submit()).resolves.toBe(true);

    expect(connection.pair).toHaveBeenCalledWith('ABC123');
    expect(setup.credential.value).toBe('');
  });

  it('keeps the credential and the error when pairing fails', async () => {
    const connection = connectionStub({ ok: false, detail: 'Not paired', state: 'unpaired' });
    vi.mocked(connection.pair).mockImplementation(async () => {
      connection.pairError.value = 'That pairing code is wrong or expired';
      return false;
    });
    const setup = useSetup(connection);
    setup.credential.value = 'WRONG';

    await expect(setup.submit()).resolves.toBe(false);

    expect(setup.credential.value).toBe('WRONG');
    expect(setup.pairError.value).toBe('That pairing code is wrong or expired');
    expect(setup.step.value).toBe('pair');
  });

  it('walks from remote confirmation to the project handoff', async () => {
    const connection = connectionStub({ ok: false, detail: 'Not paired', state: 'unpaired' });
    vi.mocked(connection.pair).mockImplementation(async () => {
      connection.remoteConfirmation.value = {
        origin: 'http://100.64.0.5:4096',
        warning: 'crosses your network',
      };
      return false;
    });
    const setup = useSetup(connection);
    setup.credential.value = 'http://100.64.0.5:4096/auth/connect/ABC123';

    await setup.submit();
    expect(setup.step.value).toBe('remote');

    vi.mocked(connection.confirmRemote).mockImplementation(async () => {
      connection.remoteConfirmation.value = null;
      connection.status.value = { ok: true, detail: 'opencode 2.0.32', state: 'connected' };
      return true;
    });

    await expect(setup.confirmRemote()).resolves.toBe(true);
    expect(setup.step.value).toBe('project');
  });

  it('goes back to the pair step when the remote link is cancelled', async () => {
    const connection = connectionStub({ ok: false, detail: 'Not paired', state: 'unpaired' });
    const setup = useSetup(connection);
    connection.remoteConfirmation.value = { origin: 'http://100.64.0.5:4096', warning: 'warning' };

    setup.cancelRemote();

    expect(connection.cancelRemote).toHaveBeenCalled();
    expect(setup.step.value).toBe('pair');
  });
});
