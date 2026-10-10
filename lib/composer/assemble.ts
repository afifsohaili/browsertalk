import { parsePageFacts, type RawPageCapture } from '@/lib/picker/collect';
import type { PickerFeedback } from '@/lib/picker/facts';
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
      element: pending.element,
      ...(pending.extras === undefined ? {} : { extras: pending.extras }),
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
  const extras = item.facts.extras;
  if (extras?.screenshot === undefined) return item;

  const { screenshot: _screenshot, ...rest } = extras;
  const { extras: _extras, ...facts } = item.facts;
  return { ...item, facts: Object.keys(rest).length === 0 ? facts : { ...facts, extras: rest } };
}
