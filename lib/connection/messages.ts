import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
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
} from './service';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';

export type ConnectionResponse = BackendStatus | ConnectionResult | OnboardingResult | ProjectsResult;

export async function respondToConnectionRequest(request: ConnectionRequest): Promise<ConnectionResponse> {
  switch (request.type) {
    case 'connection/pair': {
      const result = await pairWithServer(request.code);
      if (result.ok) broadcastConnectionChanged();
      return result;
    }
    case 'connection/status':
      return pingConnection();
    case 'connection/onboarding':
      return connectionOnboarding();
    case 'connection/projects':
      return listServerProjects();
    case 'connection/bind':
      return bindOrigin({ origin: request.origin, projectDirectory: request.projectDirectory });
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

export async function requestPair(code: string): Promise<ConnectionResult> {
  const response = await sendSafely({ type: 'connection/pair', code });
  return isConnectionResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestOnboarding(): Promise<OnboardingView | null> {
  const response = await sendSafely({ type: 'connection/onboarding' });
  return isOnboardingResult(response) && response.ok ? response.onboarding : null;
}

export async function requestProjects(): Promise<ProjectsResult> {
  const response = await sendSafely({ type: 'connection/projects' });
  return isProjectsResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function requestBind(origin: string, projectDirectory: string): Promise<ConnectionResult> {
  const response = await sendSafely({ type: 'connection/bind', origin, projectDirectory });
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
