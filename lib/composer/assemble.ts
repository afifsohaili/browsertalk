import { parsePageFacts, type RawPageCapture } from '@/lib/picker/collect';
import type { PickerFeedback } from '@/lib/picker/facts';
import type { OutboxItem } from '@/lib/storage/outbox';

export interface OutboxItemMeta {
  id: string;
  now: string;
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
  };
}

export function buildPageOutboxItem(raw: RawPageCapture, comment: string, meta: OutboxItemMeta): OutboxItem {
  return {
    id: meta.id,
    comment,
    capturedAt: meta.now,
    status: 'queued',
    facts: { page: parsePageFacts(raw.url, raw.title) },
  };
}
