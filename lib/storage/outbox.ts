import { browser } from 'wxt/browser';
import { isAgentBackendId, type AgentBackendId } from '@/lib/agent-backend/interface';
import {
  isElementFacts,
  isPageFacts,
  isPickerExtras,
  isRecord,
  type PickerElementFacts,
  type PickerExtras,
  type PickerPageFacts,
} from '@/lib/picker/facts';
import { STORAGE_KEYS } from './keys';

export interface OutboxFacts {
  page: PickerPageFacts;
  element?: PickerElementFacts;
  extras?: PickerExtras;
}

export interface OutboxDestination {
  backendId: AgentBackendId;
  endpoint: string;
  directory: string;
}

export interface OutboxItem {
  id: string;
  comment: string;
  capturedAt: string;
  status: 'queued';
  facts: OutboxFacts;
  destination?: OutboxDestination;
  error?: string;
}

export function isOutboxItem(value: unknown): value is OutboxItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.comment !== 'string') return false;
  if (typeof value.capturedAt !== 'string') return false;
  if (value.status !== 'queued') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.destination !== undefined && !isOutboxDestination(value.destination)) return false;
  return isOutboxFacts(value.facts);
}

export function isOutboxDestination(value: unknown): value is OutboxDestination {
  if (!isRecord(value)) return false;
  if (!isAgentBackendId(value.backendId)) return false;
  if (typeof value.endpoint !== 'string' || value.endpoint.length === 0) return false;
  if (typeof value.directory !== 'string' || value.directory.length === 0) return false;
  return true;
}

function isOutboxFacts(value: unknown): value is OutboxFacts {
  if (!isRecord(value)) return false;
  if (!isPageFacts(value.page)) return false;
  if (value.element !== undefined && !isElementFacts(value.element)) return false;
  if (value.extras !== undefined && !isPickerExtras(value.extras)) return false;
  return true;
}

export async function readOutbox(): Promise<OutboxItem[]> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.outbox);
  const value = stored[STORAGE_KEYS.outbox];
  return Array.isArray(value) ? value.filter(isOutboxItem) : [];
}

export async function appendToOutbox(item: OutboxItem): Promise<void> {
  const items = await readOutbox();
  await browser.storage.local.set({ [STORAGE_KEYS.outbox]: [...items, item] });
}

export async function removeFromOutbox(id: string): Promise<void> {
  const items = await readOutbox();
  await browser.storage.local.set({ [STORAGE_KEYS.outbox]: items.filter((item) => item.id !== id) });
}

export async function setOutboxItemError(id: string, error: string): Promise<void> {
  const items = await readOutbox();
  await browser.storage.local.set({
    [STORAGE_KEYS.outbox]: items.map((item) => (item.id === id ? { ...item, error } : item)),
  });
}

export async function setOutboxDestination(id: string, destination: OutboxDestination): Promise<void> {
  const items = await readOutbox();
  await browser.storage.local.set({
    [STORAGE_KEYS.outbox]: items.map((item) => (item.id === id ? { ...item, destination } : item)),
  });
}

export async function countOutbox(): Promise<number> {
  return (await readOutbox()).length;
}
