import type { AgentBackend } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { getToken } from '@/lib/storage/auth';
import { getSettings } from '@/lib/storage/settings';
import { parseServerUrl } from './endpoint';
import { connectionKey, type ConnectionIdentity } from './identity';

export interface ConfiguredConnection extends ConnectionIdentity {
  token: string | null;
  /** The "Allow a remote server" policy at resolve time; transports enforce it. */
  allowRemote: boolean;
}

export type ConfiguredConnectionResult =
  | { ok: true; connection: ConfiguredConnection }
  | { ok: false; error: string };

export async function resolveConfiguredConnection(): Promise<ConfiguredConnectionResult> {
  const { backendId, serverUrl, allowRemote } = await getSettings();
  const parsed = parseServerUrl(serverUrl, { allowRemote });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return resolveFor({ backendId, endpoint: parsed.endpoint }, allowRemote);
}

export async function resolveConnection(identity: ConnectionIdentity): Promise<ConfiguredConnectionResult> {
  const { allowRemote } = await getSettings();
  return resolveFor(identity, allowRemote);
}

async function resolveFor(identity: ConnectionIdentity, allowRemote: boolean): Promise<ConfiguredConnectionResult> {
  const parsed = parseServerUrl(identity.endpoint, { allowRemote });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const canonical: ConnectionIdentity = { backendId: identity.backendId, endpoint: parsed.endpoint };
  const token = await getToken(connectionKey(canonical));
  return { ok: true, connection: { ...canonical, token, allowRemote } };
}

export function connectionBackend(connection: ConfiguredConnection): AgentBackend {
  return getAgentBackend(connection.backendId, {
    baseUrl: connection.endpoint,
    token: connection.token,
    allowRemote: connection.allowRemote,
  });
}
