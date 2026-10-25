import { isProject, type BackendStatus, type Project } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { connectionKey, type ConnectionIdentity } from '@/lib/connection/identity';
import { connectionBackend, resolveConfiguredConnection, resolveConnection } from '@/lib/connection/resolve';
import { REMOTE_PAIRING_WARNING } from '@/lib/connection/status';
import { clearToken, setToken } from '@/lib/storage/auth';
import { bindProject } from '@/lib/storage/projects';
import { getSettings, setSettings } from '@/lib/storage/settings';
import { parseServerUrl, type ServerUrlCheck } from './endpoint';
import { parsePairingCredential, type PairingCredential } from './pairing-link';
import type { ConnectionResult, OnboardingResult, ProjectsResult } from './protocol';

export interface PairOptions {
  /** The user saw the link's origin and the remote-server warning and chose to continue. */
  confirmRemote?: boolean;
}

export async function pairWithServer(credential: string, options: PairOptions = {}): Promise<ConnectionResult> {
  const settings = await getSettings();
  const onboarding = getAgentBackend(settings.backendId).onboarding;
  if (onboarding === null) return { ok: false, error: 'This backend needs no pairing' };

  const entered = readCredential(credential, onboarding.emptyCredentialError, onboarding.acceptsPairingLink === true);
  if (!entered.ok) return { ok: false, error: entered.error };

  const endpoint = resolvePairingEndpoint(entered.credential, settings.serverUrl, settings.allowRemote);
  if (!endpoint.ok) return { ok: false, error: endpoint.error };
  if (endpoint.confirm !== null && options.confirmRemote !== true) return endpoint.confirm;

  try {
    const { token } = await onboarding.authenticate({
      credential: entered.credential.code,
      endpoint: entered.credential.endpoint ?? undefined,
      allowRemote: endpoint.allowRemote,
    });

    if (endpoint.changed) {
      await setSettings({ serverUrl: endpoint.endpoint, allowRemote: endpoint.allowRemote });
    }
    if (token !== null) {
      await setToken(connectionKey({ backendId: settings.backendId, endpoint: endpoint.endpoint }), token);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

function readCredential(
  value: string,
  emptyError: string,
  acceptsLink: boolean,
): { ok: true; credential: PairingCredential } | { ok: false; error: string } {
  if (value.trim().length === 0) return { ok: false, error: emptyError };
  if (acceptsLink) return parsePairingCredential(value);

  return { ok: true, credential: { code: value.trim(), endpoint: null, origin: null, remote: false } };
}

type PairingEndpoint =
  | {
      ok: true;
      endpoint: string;
      allowRemote: boolean;
      /** True when the link's endpoint or the remote policy should be persisted. */
      changed: boolean;
      confirm: null;
    }
  | {
      ok: true;
      endpoint: string;
      allowRemote: boolean;
      changed: boolean;
      confirm: Extract<ConnectionResult, { ok: false }>;
    }
  | { ok: false; error: string };

function resolvePairingEndpoint(
  credential: PairingCredential,
  savedServerUrl: string,
  allowRemote: boolean,
): PairingEndpoint {
  if (credential.endpoint === null) {
    const parsed: ServerUrlCheck = parseServerUrl(savedServerUrl, { allowRemote });
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, endpoint: parsed.endpoint, allowRemote, changed: false, confirm: null };
  }

  const needsConfirmation = credential.remote;
  const nextAllowRemote = needsConfirmation ? true : allowRemote;
  const confirm = needsConfirmation
    ? {
        ok: false as const,
        error: REMOTE_PAIRING_WARNING,
        remote: { origin: credential.origin ?? credential.endpoint, warning: REMOTE_PAIRING_WARNING },
      }
    : null;

  return {
    ok: true,
    endpoint: credential.endpoint,
    allowRemote: nextAllowRemote,
    changed: credential.endpoint !== savedServerUrl || nextAllowRemote !== allowRemote,
    confirm,
  };
}

export async function pingConnection(): Promise<BackendStatus> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) {
      return { ok: false, detail: resolved.error, state: 'unreachable', action: 'Fix the server URL in settings' };
    }
    return await connectionBackend(resolved.connection).ping();
  } catch (error) {
    return {
      ok: false,
      detail: describeError(error),
      state: 'unreachable',
      action: 'Fix the server URL in settings',
    };
  }
}

/** Clears the token for the captured connection; the connection returns to unpaired. */
export async function resetConnection(connection: ConnectionIdentity): Promise<ConnectionResult> {
  try {
    const resolved = await resolveConnection(connection);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    await clearToken(connectionKey(resolved.connection));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function connectionOnboarding(): Promise<OnboardingResult> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const onboarding = connectionBackend(resolved.connection).onboarding;
    if (onboarding === null) return { ok: true, onboarding: null };

    const input = { endpoint: resolved.connection.endpoint };
    return {
      ok: true,
      onboarding: {
        instructions: onboarding.instructions(input),
        command: onboarding.command(input),
        credentialLabel: onboarding.credentialLabel,
      },
    };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function listServerProjects(connection: ConnectionIdentity): Promise<ProjectsResult> {
  try {
    const resolved = await resolveConnection(connection);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const backend = connectionBackend(resolved.connection);
    if (!backend.capabilities.projects) return { ok: true, supported: false, projects: [] };

    const projects: Project[] = await backend.listProjects();
    if (!projects.every(isProject)) {
      return { ok: false, error: 'The server sent a project list we could not read' };
    }
    return { ok: true, supported: true, projects };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export interface BindOriginInput {
  origin: string;
  projectDirectory: string;
  connection: ConnectionIdentity;
}

export async function bindOrigin(input: BindOriginInput): Promise<ConnectionResult> {
  const origin = normalizeOrigin(input.origin);
  if (origin === null) return { ok: false, error: 'That page has no bindable origin' };

  const projectDirectory = input.projectDirectory.trim();
  if (projectDirectory.length === 0) return { ok: false, error: 'Pick a project first' };

  const { allowRemote } = await getSettings();
  const parsed = parseServerUrl(input.connection.endpoint, { allowRemote });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const key = connectionKey({ backendId: input.connection.backendId, endpoint: parsed.endpoint });
  await bindProject(key, origin, projectDirectory);
  return { ok: true };
}

function normalizeOrigin(value: string): string | null {
  try {
    const origin = new URL(value).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
