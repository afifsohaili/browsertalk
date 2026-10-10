import type { AgentBackend } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { getToken } from '@/lib/storage/auth';
import { getSettings } from '@/lib/storage/settings';
import { parseLoopbackUrl } from './endpoint';
import { connectionKey, type ConnectionIdentity } from './identity';

export interface ConfiguredConnection extends ConnectionIdentity {
  token: string | null;
}

export type ConfiguredConnectionResult =
  | { ok: true; connection: ConfiguredConnection }
  | { ok: false; error: string };

export async function resolveConfiguredConnection(): Promise<ConfiguredConnectionResult> {
  const { backendId, serverUrl } = await getSettings();
  const parsed = parseLoopbackUrl(serverUrl);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return resolveConnection({ backendId, endpoint: parsed.endpoint });
}

export async function resolveConnection(identity: ConnectionIdentity): Promise<ConfiguredConnectionResult> {
  const parsed = parseLoopbackUrl(identity.endpoint);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const canonical: ConnectionIdentity = { backendId: identity.backendId, endpoint: parsed.endpoint };
  const token = await getToken(connectionKey(canonical));
  return { ok: true, connection: { ...canonical, token } };
}

export function connectionBackend(connection: ConfiguredConnection): AgentBackend {
  return getAgentBackend(connection.backendId, { baseUrl: connection.endpoint, token: connection.token });
}
