import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerConnectionHandler } from '@/lib/connection/messages';
import type { RemotePairingConfirmation } from '@/lib/connection/protocol';
import { useConnection, type Connection } from '@/lib/connection/use-connection';
import { getToken, setToken } from '@/lib/storage/auth';
import { setupStep, showsPairForm, showsRecheck, useSetup } from './use-setup';

registerBuiltinBackends();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

  it('shows the form while upgrading so a supported link can recover', () => {
    expect(showsPairForm('upgrade')).toBe(true);
  });

  it('hides the form while checking or connected', () => {
    expect(showsPairForm('checking')).toBe(false);
    expect(showsPairForm('project')).toBe(false);
  });
});

describe('recheck visibility', () => {
  it('offers Check again when unreachable or upgrading', () => {
    expect(showsRecheck('prerequisite')).toBe(true);
    expect(showsRecheck('upgrade')).toBe(true);
  });

  it('hides Check again in the pairing and handoff steps', () => {
    for (const step of ['checking', 'pair', 'remote', 'project'] as const) {
      expect(showsRecheck(step)).toBe(false);
    }
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

describe('upgrade recovery', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('pairs a supported link from the upgrade state', async () => {
    const saved = 'http://127.0.0.1:15001';
    const supported = 'http://127.0.0.1:29422';
    await setToken(`opencode@${saved}`, 'tok_old');
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        const href = String(url);
        if (href.endsWith('/auth/connect/recover')) return jsonResponse({ token: 'tok_2' });
        if (href.startsWith(supported)) return jsonResponse({ version: '2.0.32' });
        return jsonResponse({ version: '3.0.0' });
      }),
    );

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;
    const setup = useSetup(connection);

    await vi.waitFor(() => expect(setup.step.value).toBe('upgrade'));
    expect(showsPairForm(setup.step.value)).toBe(true);
    expect(showsRecheck(setup.step.value)).toBe(true);

    setup.credential.value = `${supported}/auth/connect/recover`;
    await expect(setup.submit()).resolves.toBe(true);

    await vi.waitFor(() => expect(setup.step.value).toBe('project'));
    expect(await getToken(`opencode@${supported}`)).toBe('tok_2');

    scope.stop();
  });
});
