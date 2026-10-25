import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import {
  applySetupBadge,
  claimStatusGenerationIfCurrent,
  clearSetupBadge,
  configuredConnection,
  configuredConnectionKey,
  currentStatusGeneration,
  invalidateStatusChecks,
  nextStatusGeneration,
  setSetupBadge,
  writeBadgeIfCurrent,
} from '@/lib/onboarding/badge';
import { connectionKey, type ConnectionIdentity } from './identity';
import {
  isBackendStatus,
  isConnectionChanged,
  isConnectionRequest,
  isConnectionResult,
  isOnboardingResult,
  isProjectsResult,
  type ConnectionChangedEvent,
  type ConnectionRequest,
  type ConnectionResult,
  type OnboardingResult,
  type OnboardingView,
  type ProjectsResult,
} from './protocol';
import {
  bindOrigin,
  connectionOnboarding,
  listServerProjects,
  pairWithServer,
  pingConnection,
  resetConnection,
} from './service';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';

export type ConnectionResponse = BackendStatus | ConnectionResult | OnboardingResult | ProjectsResult;

export async function respondToConnectionRequest(request: ConnectionRequest): Promise<ConnectionResponse> {
  switch (request.type) {
    case 'connection/pair': {
      const result = await pairWithServer(request.code, { confirmRemote: request.confirmRemote === true });
      if (result.ok) {
        nextStatusGeneration();
        await clearSetupBadge();
        broadcastConnectionChanged();
      }
      return result;
    }
    case 'connection/status': {
      const generation = nextStatusGeneration();
      const connection = await configuredConnectionKey();
      const status = await pingConnection();
      await writeBadgeIfCurrent(generation, connection, () => applySetupBadge(status));
      return status;
    }
    case 'connection/onboarding':
      return connectionOnboarding();
    case 'connection/reset': {
      const generation = currentStatusGeneration();
      const connection = await configuredConnection();
      const result = await resetConnection(connection);
      if (result.ok) {
        invalidateStatusChecks(connectionKey(connection));
        const stillConfigured = connectionKey(connection) === (await configuredConnectionKey());
        if (stillConfigured && claimStatusGenerationIfCurrent(generation) !== null) {
          await setSetupBadge();
        }
        broadcastConnectionChanged();
      }
      return result;
    }
    case 'connection/projects':
      return listServerProjects(request.connection);
    case 'connection/bind':
      return bindOrigin({
        origin: request.origin,
        projectDirectory: request.projectDirectory,
        connection: request.connection,
      });
  }
}

export function registerConnectionHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isConnectionRequest(message)) return undefined;

    respondToConnectionRequest(message).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies ConnectionResult);
    });
    return true;
  });
}

export function broadcastConnectionChanged(): void {
  const message: ConnectionChangedEvent = { type: 'connection/changed' };
  try {
    void browser.runtime.sendMessage(message).catch(() => {});
  } catch {
    /* no surface is open */
  }
}

export async function requestConnectionStatus(): Promise<BackendStatus> {
  const response = await sendSafely({ type: 'connection/status' });
  return isBackendStatus(response) ? response : { ok: false, detail: BACKGROUND_UNAVAILABLE };
}

export interface PairRequestOptions {
  /** The user confirmed a remote link's origin and warning. */
  confirmRemote?: boolean;
}

export async function requestPair(code: string, options: PairRequestOptions = {}): Promise<ConnectionResult> {
  const response = await sendSafely({ type: 'connection/pair', code, confirmRemote: options.confirmRemote });
  return isConnectionResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestReset(): Promise<ConnectionResult> {
  const response = await sendSafely({ type: 'connection/reset' });
  return isConnectionResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestOnboarding(): Promise<OnboardingView | null> {
  const response = await sendSafely({ type: 'connection/onboarding' });
  return isOnboardingResult(response) && response.ok ? response.onboarding : null;
}

export async function requestProjects(connection: ConnectionIdentity): Promise<ProjectsResult> {
  const response = await sendSafely({ type: 'connection/projects', connection });
  return isProjectsResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestBind(
  origin: string,
  projectDirectory: string,
  connection: ConnectionIdentity,
): Promise<ConnectionResult> {
  const response = await sendSafely({ type: 'connection/bind', origin, projectDirectory, connection });
  return isConnectionResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export function onConnectionChanged(listener: () => void): () => void {
  const handler = (message: unknown): undefined => {
    if (isConnectionChanged(message)) listener();
    return undefined;
  };
  browser.runtime.onMessage.addListener(handler);
  return () => browser.runtime.onMessage.removeListener(handler);
}

async function sendSafely(message: ConnectionRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}
