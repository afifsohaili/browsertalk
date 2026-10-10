import type { SessionRef } from '@/lib/agent-backend/interface';
import { broadcastOutboxChanged } from '@/lib/composer/broadcast';
import { projectName } from '@/lib/session-strategy/interface';
import { resolveActiveSessionStrategy } from '@/lib/session-strategy/selection';
import { readOutbox, removeFromOutbox, setOutboxItemError, type OutboxItem } from '@/lib/storage/outbox';
import { getBoundProject } from '@/lib/storage/projects';
import { appendToSent } from '@/lib/storage/sent';
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

export async function deliver(item: OutboxItem, options: SendOptions = {}): Promise<SendOutcome> {
  try {
    const origin = pageOrigin(item.facts.page.url);
    if (origin === null) return recordError(item, 'The page URL in this feedback is unreadable');

    const directory = await getBoundProject(origin);
    if (directory === null) return recordError(item, 'This site has no project binding');

    const { backend, strategy } = await resolveActiveSessionStrategy();
    const session = await strategy.resolveSession({ backend, directory, now: options.now });

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

function pageOrigin(url: string): string | null {
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}
