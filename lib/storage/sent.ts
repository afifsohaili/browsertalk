import { browser } from 'wxt/browser';
import { isRecord } from '@/lib/picker/facts';
import { STORAGE_KEYS } from './keys';

export const SENT_LIMIT = 50;

export interface SentItem {
  id: string;
  comment: string;
  sentAt: string;
  session: { id: string; title: string };
  page: { title: string; url: string };
  elementCount?: number;
}

export function isSentItem(value: unknown): value is SentItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.comment !== 'string') return false;
  if (typeof value.sentAt !== 'string' || value.sentAt.length === 0) return false;
  if (!isRecord(value.session)) return false;
  if (typeof value.session.id !== 'string' || value.session.id.length === 0) return false;
  if (typeof value.session.title !== 'string') return false;
  if (!isRecord(value.page)) return false;
  if (typeof value.page.title !== 'string' || typeof value.page.url !== 'string') return false;
  if (value.elementCount !== undefined && !isElementCount(value.elementCount)) return false;
  return true;
}

function isElementCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export async function readSent(): Promise<SentItem[]> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.sent);
  const value = stored[STORAGE_KEYS.sent];
  return Array.isArray(value) ? value.filter(isSentItem) : [];
}

export async function countSent(): Promise<number> {
  return (await readSent()).length;
}
