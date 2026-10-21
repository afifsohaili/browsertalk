import { parsePageFacts, type RawPageCapture } from '@/lib/picker/collect';
import type { PickerElementCapture, PickerFeedback } from '@/lib/picker/facts';
import type { OutboxDestination, OutboxItem } from '@/lib/storage/outbox';

export interface OutboxItemMeta {
  id: string;
  now: string;
  destination?: OutboxDestination;
}

export function buildElementOutboxItem(
  pending: PickerFeedback,
  comment: string,
  meta: OutboxItemMeta,
): OutboxItem {
  return {
    id: meta.id,
    comment,
    capturedAt: pending.capturedAt,
    status: 'queued',
    facts: {
      page: pending.page,
      elements: pending.elements.map((entry) => ({ ...entry })),
    },
    ...(meta.destination === undefined ? {} : { destination: meta.destination }),
  };
}

export function buildPageOutboxItem(raw: RawPageCapture, comment: string, meta: OutboxItemMeta): OutboxItem {
  return {
    id: meta.id,
    comment,
    capturedAt: meta.now,
    status: 'queued',
    facts: { page: parsePageFacts(raw.url, raw.title) },
    ...(meta.destination === undefined ? {} : { destination: meta.destination }),
  };
}

export function withoutScreenshot(item: OutboxItem): OutboxItem {
  const elements = item.facts.elements;
  if (elements === undefined) return item;

  const index = lastScreenshotIndex(elements);
  if (index === -1) return item;

  const next = elements.map((entry, position) => (position === index ? withoutElementScreenshot(entry) : entry));
  return { ...item, facts: { ...item.facts, elements: next } };
}

function lastScreenshotIndex(elements: readonly PickerElementCapture[]): number {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    if (elements[index]?.extras?.screenshot !== undefined) return index;
  }
  return -1;
}

function withoutElementScreenshot(entry: PickerElementCapture): PickerElementCapture {
  const extras = entry.extras;
  if (extras === undefined) return entry;

  const { screenshot: _screenshot, ...rest } = extras;
  return Object.keys(rest).length === 0 ? { element: entry.element } : { element: entry.element, extras: rest };
}
