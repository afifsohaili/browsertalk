import { browser } from 'wxt/browser';
import {
  isAgentBackendId,
  type AgentBackendId,
  type DeliveryMode,
  type FeedbackAttachment,
} from '@/lib/agent-backend/interface';
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

export interface OutboxAttemptInput {
  sessionID: string;
  sessionTitle: string;
  text: string;
  delivery: DeliveryMode;
  files?: FeedbackAttachment[];
}

export interface OutboxAttempt {
  requestID: string;
  sentAt: string;
  admissionInput?: OutboxAttemptInput;
}

export interface OutboxAdmission {
  requestID: string;
  messageID: string | null;
  sessionID: string;
  sessionTitle: string;
  admittedAt: string;
}

export interface OutboxItem {
  id: string;
  comment: string;
  capturedAt: string;
  status: 'queued';
  facts: OutboxFacts;
  destination?: OutboxDestination;
  attempt?: OutboxAttempt;
  admission?: OutboxAdmission;
  error?: string;
  reservedAt?: string;
}

export function isOutboxItem(value: unknown): value is OutboxItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.comment !== 'string') return false;
  if (typeof value.capturedAt !== 'string') return false;
  if (value.status !== 'queued') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.reservedAt !== undefined && typeof value.reservedAt !== 'string') return false;
  if (value.destination !== undefined && !isOutboxDestination(value.destination)) return false;
  if (value.attempt !== undefined && !isOutboxAttempt(value.attempt)) return false;
  if (value.admission !== undefined && !isOutboxAdmission(value.admission)) return false;
  return isOutboxFacts(value.facts);
}

export function isOutboxAttempt(value: unknown): value is OutboxAttempt {
  if (!isRecord(value)) return false;
  if (typeof value.requestID !== 'string' || value.requestID.length === 0) return false;
  if (typeof value.sentAt !== 'string' || value.sentAt.length === 0) return false;
  if (value.admissionInput !== undefined && !isOutboxAttemptInput(value.admissionInput)) return false;
  return true;
}

export function isOutboxAttemptInput(value: unknown): value is OutboxAttemptInput {
  if (!isRecord(value)) return false;
  if (typeof value.sessionID !== 'string' || value.sessionID.length === 0) return false;
  if (typeof value.sessionTitle !== 'string') return false;
  if (typeof value.text !== 'string') return false;
  if (value.delivery !== 'queue' && value.delivery !== 'steer') return false;
  if (value.files !== undefined && !isAttachmentList(value.files)) return false;
  return true;
}

function isAttachmentList(value: unknown): value is FeedbackAttachment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.uri === 'string' &&
        entry.uri.length > 0 &&
        (entry.name === undefined || typeof entry.name === 'string') &&
        (entry.description === undefined || typeof entry.description === 'string'),
    )
  );
}

export function isOutboxAdmission(value: unknown): value is OutboxAdmission {
  if (!isRecord(value)) return false;
  if (typeof value.requestID !== 'string' || value.requestID.length === 0) return false;
  if (!(value.messageID === null || (typeof value.messageID === 'string' && value.messageID.length > 0))) return false;
  if (typeof value.sessionID !== 'string' || value.sessionID.length === 0) return false;
  if (typeof value.sessionTitle !== 'string') return false;
  if (typeof value.admittedAt !== 'string' || value.admittedAt.length === 0) return false;
  return true;
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

export async function countOutbox(): Promise<number> {
  return (await readOutbox()).length;
}
