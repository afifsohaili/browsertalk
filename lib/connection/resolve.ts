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

  const identity: ConnectionIdentity = { backendId, endpoint: parsed.endpoint };
  const token = await getToken(connectionKey(identity));
  return { ok: true, connection: { ...identity, token } };
}

export function connectionBackend(connection: ConfiguredConnection): AgentBackend {
  return getAgentBackend(connection.backendId, { baseUrl: connection.endpoint, token: connection.token });
}
