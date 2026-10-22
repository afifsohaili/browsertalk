import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import type { RemotePairingConfirmation } from '@/lib/connection/protocol';
import { connectionState } from '@/lib/connection/status';
import { useConnection, type Connection } from '@/lib/connection/use-connection';

export type SetupStep = 'checking' | 'prerequisite' | 'upgrade' | 'pair' | 'remote' | 'project';

/** The shared setup state machine. The welcome tab and the panel card both read this. */
export function setupStep(
  status: BackendStatus | null,
  remote: RemotePairingConfirmation | null,
): SetupStep {
  if (remote !== null) return 'remote';
  if (status === null) return 'checking';

  switch (connectionState(status)) {
    case 'connected':
      return 'project';
    case 'incompatible':
      return 'upgrade';
    case 'unreachable':
      return 'prerequisite';
    default:
      return 'pair';
  }
}

/** The pairing form must stay visible when the saved server is unreachable: the link sets the endpoint. */
export function showsPairForm(step: SetupStep): boolean {
  return step === 'prerequisite' || step === 'upgrade' || step === 'pair' || step === 'remote';
}

/** A link can move the connection off an incompatible or unreachable server, so both states can recheck. */
export function showsRecheck(step: SetupStep): boolean {
  return step === 'prerequisite' || step === 'upgrade';
}

export interface Setup {
  step: ComputedRef<SetupStep>;
  status: Connection['status'];
  onboarding: Connection['onboarding'];
  pairing: Connection['pairing'];
  pairError: Connection['pairError'];
  remoteConfirmation: Connection['remoteConfirmation'];
  credential: Ref<string>;
  submit: () => Promise<boolean>;
  confirmRemote: () => Promise<boolean>;
  cancelRemote: () => void;
  forget: Connection['forget'];
  refresh: Connection['refresh'];
}

export function useSetup(connection: Connection = useConnection()): Setup {
  const credential = ref('');
  const step = computed(() => setupStep(connection.status.value, connection.remoteConfirmation.value));

  async function submit(): Promise<boolean> {
    const ok = await connection.pair(credential.value.trim());
    if (ok) credential.value = '';
    return ok;
  }

  return {
    step,
    status: connection.status,
    onboarding: connection.onboarding,
    pairing: connection.pairing,
    pairError: connection.pairError,
    remoteConfirmation: connection.remoteConfirmation,
    credential,
    submit,
    confirmRemote: connection.confirmRemote,
    cancelRemote: connection.cancelRemote,
    forget: connection.forget,
    refresh: connection.refresh,
  };
}
