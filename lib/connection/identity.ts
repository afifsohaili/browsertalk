import type { AgentBackendId } from '@/lib/agent-backend/interface';

export interface ConnectionIdentity {
  backendId: AgentBackendId;
  /** Canonical loopback endpoint from `parseLoopbackUrl`. */
  endpoint: string;
}

export function connectionKey(identity: ConnectionIdentity): string {
  return `${identity.backendId}@${identity.endpoint}`;
}

export function sameConnection(a: ConnectionIdentity, b: ConnectionIdentity): boolean {
  return a.backendId === b.backendId && a.endpoint === b.endpoint;
}
