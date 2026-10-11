import { browser } from 'wxt/browser';
import { jsonByteSize, MAX_OUTBOX_BYTES, MAX_SENT_BYTES, outboxSize, OutboxFullError } from './budgets';
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
    if (outboxSize(next) > MAX_OUTBOX_BYTES) throw new OutboxFullError();
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
    const next = items.map((item) => (item.id === id ? update(item) : item));
    if (outboxSize(next) > MAX_OUTBOX_BYTES) throw new OutboxFullError();
    await browser.storage.local.set({ [STORAGE_KEYS.outbox]: next });
  });
}

function retainSent(history: SentItem[]): SentItem[] {
  let retained = history.slice(0, SENT_LIMIT);
  while (retained.length > 1 && jsonByteSize(retained) > MAX_SENT_BYTES) {
    retained = retained.slice(0, -1);
  }
  return retained;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
