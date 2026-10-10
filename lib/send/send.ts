import type { AgentBackend, SessionRef } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { broadcastOutboxChanged } from '@/lib/composer/broadcast';
import { parseLoopbackUrl } from '@/lib/connection/endpoint';
import { connectionKey } from '@/lib/connection/identity';
import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import { projectName } from '@/lib/session-strategy/interface';
import { getSessionStrategy } from '@/lib/session-strategy/registry';
import { pickSessionStrategyId } from '@/lib/session-strategy/selection';
import { getToken } from '@/lib/storage/auth';
import {
  readOutbox,
  removeFromOutbox,
  setOutboxDestination,
  setOutboxItemError,
  type OutboxDestination,
  type OutboxItem,
} from '@/lib/storage/outbox';
import { getBoundProject } from '@/lib/storage/projects';
import { getSettings } from '@/lib/storage/settings';
import { appendToSent } from '@/lib/storage/sent';
import { pageOrigin } from '@/lib/url';
import { elementAttachment } from './attachments';
import { renderPrompt } from './prompt';

export interface SendOutcome {
  ok: boolean;
  error?: string;
  session?: SessionRef;
}

export interface SendOptions {
  now?: Date;
}

let chain: Promise<unknown> = Promise.resolve();

export function sendQueuedItem(itemId: string, options: SendOptions = {}): Promise<SendOutcome> {
  const next = chain.then(() => attemptSend(itemId, options));
  chain = next.catch(() => undefined);
  return next;
}

async function attemptSend(itemId: string, options: SendOptions): Promise<SendOutcome> {
  const item = (await readOutbox()).find((candidate) => candidate.id === itemId);
  if (item === undefined) return { ok: false, error: 'The item is no longer in the outbox' };
  return deliver(item, options);
}

type DestinationResult = { ok: true; destination: OutboxDestination } | { ok: false; error: string };

async function resolveDestination(item: OutboxItem, origin: string): Promise<DestinationResult> {
  if (item.destination !== undefined) {
    const parsed = parseLoopbackUrl(item.destination.endpoint);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, destination: { ...item.destination, endpoint: parsed.endpoint } };
  }

  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const directory = await getBoundProject(connectionKey(resolved.connection), origin);
  if (directory === null) return { ok: false, error: 'This site has no project binding' };

  const destination: OutboxDestination = {
    backendId: resolved.connection.backendId,
    endpoint: resolved.connection.endpoint,
    directory,
  };
  await setOutboxDestination(item.id, destination);
  return { ok: true, destination };
}

export async function deliver(item: OutboxItem, options: SendOptions = {}): Promise<SendOutcome> {
  try {
    const origin = pageOrigin(item.facts.page.url);
    if (origin === null) return recordError(item, 'The page URL in this feedback is unreadable');

    const resolved = await resolveDestination(item, origin);
    if (!resolved.ok) return recordError(item, resolved.error);
    const { backendId, endpoint, directory } = resolved.destination;

    const key = connectionKey({ backendId, endpoint });
    const token = await getToken(key);
    const backend: AgentBackend = getAgentBackend(backendId, { baseUrl: endpoint, token });
    const { sessionStrategy } = await getSettings();
    const strategy = getSessionStrategy(pickSessionStrategyId(backend, sessionStrategy[backendId]));

    const session = await strategy.resolveSession({ backend, connectionKey: key, directory, now: options.now });

    const now = options.now ?? new Date();
    const sentAt = now.toISOString();
    const text = renderPrompt({ projectName: projectName(directory), item, sentAt });
    const attachment = elementAttachment(item.facts.extras);

    await backend.sendFeedback({
      sessionID: session.id,
      text,
      delivery: 'queue',
      ...(attachment === null ? {} : { files: [attachment] }),
    });

    await removeFromOutbox(item.id);
    await appendToSent({
      id: item.id,
      comment: item.comment,
      sentAt,
      session: { id: session.id, title: session.title },
      page: { title: item.facts.page.title, url: item.facts.page.url },
    });
    broadcastOutboxChanged();

    return { ok: true, session };
  } catch (error) {
    return recordError(item, describeError(error));
  }
}

async function recordError(item: OutboxItem, error: string): Promise<SendOutcome> {
  await setOutboxItemError(item.id, error);
  return { ok: false, error };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
