import { BackendError, backendErrorCode, type AgentBackend, type SessionRef } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { broadcastOutboxChanged } from '@/lib/composer/broadcast';
import { parseLoopbackUrl } from '@/lib/connection/endpoint';
import { connectionKey } from '@/lib/connection/identity';
import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import { projectName } from '@/lib/session-strategy/interface';
import { sessionLockKey, withSessionLock } from '@/lib/session-strategy/lock';
import { getSessionStrategy } from '@/lib/session-strategy/registry';
import { pickSessionStrategyId } from '@/lib/session-strategy/selection';
import { getToken } from '@/lib/storage/auth';
import {
  readOutbox,
  type OutboxAdmission,
  type OutboxAttempt,
  type OutboxDestination,
  type OutboxItem,
} from '@/lib/storage/outbox';
import { getBoundProject } from '@/lib/storage/projects';
import { getSettings } from '@/lib/storage/settings';
import {
  commitDeliveredItem,
  setOutboxAdmission,
  setOutboxAttempt,
  setOutboxDestination,
  setOutboxItemError,
} from '@/lib/storage/writer';
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

const NO_LONGER_IN_OUTBOX = 'The item is no longer in the outbox';
const UNREADABLE_URL = 'The page URL in this feedback is unreadable';
const NO_PROJECT_BINDING = 'This site has no project binding';
const MALFORMED_ADMISSION = 'The backend did not confirm the admission';
const AMBIGUOUS_ADMISSION_ERROR =
  'The server did not confirm the feedback was admitted; retrying is safe and will not send it twice';

let routing: Promise<unknown> = Promise.resolve();
const connectionQueues = new Map<string, Promise<unknown>>();

interface RoutedDelivery {
  delivery: Promise<SendOutcome>;
}

export function sendQueuedItem(itemId: string, options: SendOptions = {}): Promise<SendOutcome> {
  const routed = routing.then(() => route(itemId, options));
  routing = routed.then(
    () => undefined,
    () => undefined,
  );
  return routed.then(({ delivery }) => delivery);
}

async function route(itemId: string, options: SendOptions): Promise<RoutedDelivery> {
  const item = await findOutboxItem(itemId);
  if (item === null) return { delivery: Promise.resolve({ ok: false, error: NO_LONGER_IN_OUTBOX }) };

  const origin = pageOrigin(item.facts.page.url);
  if (origin === null) return { delivery: recordError(itemId, UNREADABLE_URL) };

  const resolved = await resolveDestination(item, origin);
  if (!resolved.ok) return { delivery: recordError(itemId, resolved.error) };

  return {
    delivery: enqueueConnection(connectionKeyOf(resolved.destination), () =>
      deliver(itemId, resolved.destination, options),
    ),
  };
}

async function deliver(
  itemId: string,
  destination: OutboxDestination,
  options: SendOptions,
): Promise<SendOutcome> {
  const item = await findOutboxItem(itemId);
  if (item === null) return { ok: false, error: NO_LONGER_IN_OUTBOX };

  try {
    const session = await withSessionLock(
      sessionLockKey(connectionKeyOf(destination), destination.directory),
      () => admit(item, destination, options),
    );
    broadcastOutboxChanged();
    return { ok: true, session };
  } catch (error) {
    return recordError(itemId, describeSendError(error));
  }
}

async function admit(item: OutboxItem, destination: OutboxDestination, options: SendOptions): Promise<SessionRef> {
  if (item.admission !== undefined) return commitAdmitted(item, item.admission);

  const key = connectionKeyOf(destination);
  const token = await getToken(key);
  const backend: AgentBackend = getAgentBackend(destination.backendId, { baseUrl: destination.endpoint, token });
  const { sessionStrategy } = await getSettings();
  const strategy = getSessionStrategy(pickSessionStrategyId(backend, sessionStrategy[destination.backendId]));

  const session = await strategy.resolveSession({
    backend,
    connectionKey: key,
    directory: destination.directory,
    now: options.now,
  });

  const now = options.now ?? new Date();
  const attempt: OutboxAttempt = item.attempt ?? { requestID: crypto.randomUUID(), sentAt: now.toISOString() };
  if (item.attempt === undefined) await setOutboxAttempt(item.id, attempt);

  const text = renderPrompt({ projectName: projectName(destination.directory), item, sentAt: attempt.sentAt });
  const attachment = backend.capabilities.images ? elementAttachment(item.facts.extras) : null;

  const result = await backend.sendFeedback({
    sessionID: session.id,
    text,
    delivery: 'queue',
    requestID: attempt.requestID,
    ...(attachment === null ? {} : { files: [attachment] }),
  });
  if (result.admitted !== true) throw new BackendError('ambiguous-admission', MALFORMED_ADMISSION);

  const admission: OutboxAdmission = {
    requestID: attempt.requestID,
    messageID: result.messageID,
    sessionID: session.id,
    sessionTitle: session.title,
    admittedAt: now.toISOString(),
  };
  await setOutboxAdmission(item.id, admission);
  return commitAdmitted(item, admission);
}

async function commitAdmitted(item: OutboxItem, admission: OutboxAdmission): Promise<SessionRef> {
  await commitDeliveredItem({
    itemId: item.id,
    sent: {
      id: item.id,
      comment: item.comment,
      sentAt: item.attempt?.sentAt ?? admission.admittedAt,
      session: { id: admission.sessionID, title: admission.sessionTitle },
      page: { title: item.facts.page.title, url: item.facts.page.url },
    },
  });
  return { id: admission.sessionID, title: admission.sessionTitle };
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
  if (directory === null) return { ok: false, error: NO_PROJECT_BINDING };

  const destination: OutboxDestination = {
    backendId: resolved.connection.backendId,
    endpoint: resolved.connection.endpoint,
    directory,
  };
  await setOutboxDestination(item.id, destination);
  return { ok: true, destination };
}

function enqueueConnection<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = connectionQueues.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  connectionQueues.set(key, tail);
  void tail.then(() => {
    if (connectionQueues.get(key) === tail) connectionQueues.delete(key);
  });
  return result;
}

async function findOutboxItem(itemId: string): Promise<OutboxItem | null> {
  return (await readOutbox()).find((item) => item.id === itemId) ?? null;
}

function connectionKeyOf(destination: OutboxDestination): string {
  return connectionKey({ backendId: destination.backendId, endpoint: destination.endpoint });
}

async function recordError(itemId: string, error: string): Promise<SendOutcome> {
  await setOutboxItemError(itemId, error);
  return { ok: false, error };
}

function describeSendError(error: unknown): string {
  if (backendErrorCode(error) === 'ambiguous-admission') return AMBIGUOUS_ADMISSION_ERROR;
  return error instanceof Error ? error.message : 'Something went wrong';
}
