import { browser } from 'wxt/browser';
import {
  deliveryReadySize,
  jsonByteSize,
  MAX_OUTBOX_BYTES,
  MAX_SENT_BYTES,
  OutboxFullError,
  truncateJsonString,
  utf8ByteLength,
} from './budgets';
import { STORAGE_KEYS } from './keys';
import {
  readOutbox,
  type OutboxAdmission,
  type OutboxAttempt,
  type OutboxDestination,
  type OutboxItem,
} from './outbox';
import { readSent, SENT_LIMIT, type SentItem } from './sent';
import type { StoredSession } from './sessions';

let tail: Promise<unknown> = Promise.resolve();

export function enqueueStorageWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function appendToOutbox(item: OutboxItem): Promise<void> {
  return enqueueStorageWrite(async () => {
    const items = await readOutbox();
    const next = [...items, item];
    if (deliveryReadySize(next) > MAX_OUTBOX_BYTES) throw new OutboxFullError();
    await browser.storage.local.set({ [STORAGE_KEYS.outbox]: next });
  });
}

export class OutboxReservedError extends Error {
  constructor() {
    super('This feedback is being sent and cannot be discarded');
    this.name = 'OutboxReservedError';
  }
}

export function removeFromOutbox(id: string): Promise<void> {
  return enqueueStorageWrite(async () => {
    const items = await readOutbox();
    const item = items.find((entry) => entry.id === id);
    if (item?.reservedAt !== undefined) throw new OutboxReservedError();
    await browser.storage.local.set({ [STORAGE_KEYS.outbox]: items.filter((entry) => entry.id !== id) });
  });
}

export function reserveOutboxItem(id: string, now: Date = new Date()): Promise<boolean> {
  return enqueueStorageWrite(async () => {
    const items = await readOutbox();
    if (!items.some((item) => item.id === id)) return false;
    const reservedAt = now.toISOString();
    await browser.storage.local.set({
      [STORAGE_KEYS.outbox]: items.map((item) => (item.id === id ? { ...item, reservedAt } : item)),
    });
    return true;
  });
}

export function setOutboxItemError(id: string, error: string): Promise<void> {
  return updateOutboxItem(id, (item) => ({ ...item, error, reservedAt: undefined }));
}

export function setOutboxDestination(id: string, destination: OutboxDestination): Promise<void> {
  return updateOutboxItem(id, (item) => ({ ...item, destination }));
}

export function setOutboxAttempt(id: string, attempt: OutboxAttempt): Promise<void> {
  return updateOutboxItem(id, (item) => ({ ...item, attempt }));
}

export function setOutboxAdmission(id: string, admission: OutboxAdmission): Promise<void> {
  return updateOutboxItem(id, (item) => ({ ...item, admission }));
}

export interface DeliveredCommit {
  itemId: string;
  sent: SentItem;
}

export function commitDeliveredItem(input: DeliveredCommit): Promise<void> {
  return enqueueStorageWrite(async () => {
    const [items, history] = await Promise.all([readOutbox(), readSent()]);
    await browser.storage.local.set({
      [STORAGE_KEYS.outbox]: items.filter((item) => item.id !== input.itemId),
      [STORAGE_KEYS.sent]: retainSent([input.sent, ...history]),
    });
  });
}

export function appendToSent(item: SentItem): Promise<void> {
  return enqueueStorageWrite(async () => {
    const items = await readSent();
    await browser.storage.local.set({ [STORAGE_KEYS.sent]: retainSent([item, ...items]) });
  });
}

export function writeStoredSession(
  connectionKey: string,
  strategyId: string,
  key: string,
  session: StoredSession,
): Promise<void> {
  return enqueueStorageWrite(async () => {
    const stored = await browser.storage.local.get(STORAGE_KEYS.sessions);
    const byConnection = asRecord(stored[STORAGE_KEYS.sessions]);
    const byStrategy = asRecord(byConnection[connectionKey]);
    await browser.storage.local.set({
      [STORAGE_KEYS.sessions]: {
        ...byConnection,
        [connectionKey]: { ...byStrategy, [strategyId]: { ...asRecord(byStrategy[strategyId]), [key]: session } },
      },
    });
  });
}

function updateOutboxItem(id: string, update: (item: OutboxItem) => OutboxItem): Promise<void> {
  return enqueueStorageWrite(async () => {
    const items = await readOutbox();
    const next = items.map((item) => (item.id === id ? boundOutboxMetadata(update(item), items) : item));
    await browser.storage.local.set({ [STORAGE_KEYS.outbox]: next });
  });
}

const TRUNCATION_MARKER = '…';
const TRUNCATION_MARKER_BYTES = utf8ByteLength(JSON.stringify(TRUNCATION_MARKER)) - 2;

function boundOutboxMetadata(item: OutboxItem, all: readonly OutboxItem[]): OutboxItem {
  const others = all.filter((entry) => entry.id !== item.id);
  const fits = (candidate: OutboxItem): boolean => metadataUsedBytes(candidate, others) <= MAX_OUTBOX_BYTES;
  if (fits(item)) return item;

  const emptied = withMetadata(
    item,
    item.error === undefined ? undefined : '',
    item.admission === undefined ? undefined : '',
  );
  if (!fits(emptied)) return emptied;

  const error = boundedField(item.error, MAX_OUTBOX_BYTES - metadataUsedBytes(emptied, others));
  let candidate = withMetadata(emptied, error, '');
  candidate = withMetadata(
    candidate,
    error,
    boundedField(item.admission?.sessionTitle, MAX_OUTBOX_BYTES - metadataUsedBytes(candidate, others)),
  );
  return candidate;
}

function metadataUsedBytes(item: OutboxItem, others: readonly OutboxItem[]): number {
  return item.attempt?.admissionInput === undefined
    ? deliveryReadySize([...others, item])
    : jsonByteSize([...others, item]);
}

function withMetadata(item: OutboxItem, error: string | undefined, sessionTitle: string | undefined): OutboxItem {
  const next = { ...item };
  if (error === undefined) delete next.error;
  else next.error = error;
  if (next.admission !== undefined && sessionTitle !== undefined) {
    next.admission = { ...next.admission, sessionTitle };
  }
  return next;
}

function boundedField(value: string | undefined, room: number): string | undefined {
  return value === undefined ? undefined : boundedText(value, room);
}

function boundedText(value: string, maxBytes: number): string {
  if (value === '') return '';
  const kept = truncateJsonString(value, Math.max(maxBytes - TRUNCATION_MARKER_BYTES, 0));
  if (kept === value) return value;
  return maxBytes < TRUNCATION_MARKER_BYTES ? '' : `${kept}${TRUNCATION_MARKER}`;
}

function retainSent(history: SentItem[]): SentItem[] {
  let retained = history.slice(0, SENT_LIMIT).map(boundSentSummary);
  while (retained.length > 1 && jsonByteSize(retained) > MAX_SENT_BYTES) {
    retained = retained.slice(0, -1);
  }
  return retained;
}

const SENT_DISPLAY_FIELD_MAX_BYTES = 512;

function boundSentSummary(item: SentItem): SentItem {
  const capped: SentItem = {
    ...item,
    page: { ...item.page, title: boundedText(item.page.title, SENT_DISPLAY_FIELD_MAX_BYTES) },
    session: { ...item.session, title: boundedText(item.session.title, SENT_DISPLAY_FIELD_MAX_BYTES) },
  };
  const available = MAX_SENT_BYTES - jsonByteSize([{ ...capped, comment: '' }]);
  const fits = truncateJsonString(capped.comment, Math.max(available, 0));
  if (fits === capped.comment) return capped;

  if (available <= TRUNCATION_MARKER_BYTES) return { ...capped, comment: '' };
  return {
    ...capped,
    comment: `${truncateJsonString(capped.comment, available - TRUNCATION_MARKER_BYTES)}${TRUNCATION_MARKER}`,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
