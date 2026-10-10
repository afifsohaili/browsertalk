import type { OutboxDestination } from '@/lib/storage/outbox';
import { getBoundProject } from '@/lib/storage/projects';
import { pageOrigin } from '@/lib/url';
import { connectionKey } from './identity';
import { resolveConfiguredConnection } from './resolve';

export async function captureQueuedDestination(pageUrl: string): Promise<OutboxDestination | null> {
  const origin = pageOrigin(pageUrl);
  if (origin === null) return null;

  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) return null;

  const directory = await getBoundProject(connectionKey(resolved.connection), origin);
  if (directory === null) return null;

  return {
    backendId: resolved.connection.backendId,
    endpoint: resolved.connection.endpoint,
    directory,
  };
}
