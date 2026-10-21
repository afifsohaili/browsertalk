# 015a: Element set data and compact prompt

**What to build:** A feedback carries an ordered element set end to end. Single-element sends keep working. The prompt becomes one compact line per element for every N, with attrs on the line, an optional extras line, no box, and no `Sent by Browsertalk` footer. Old queued items with `facts.element` still send.

**Owner decisions (2026-10-21):** [Element set data shape and prompt](issues/01-data-and-prompt.md) and [Screenshot capture](issues/04-screenshot-capture.md). `elements: { element, extras? }[]`; old `element` normalized on read; `SentItem.elementCount`; compact prompt; no footer.

**Blocked by:** none.

**Status:** done.

## Checklist

- [x] `lib/picker/facts.ts`: add `PickerElementCapture`; `PickerFeedback.elements`; `isPickerElementCapture`; update `isPickerFeedback`. Pending is session-scoped: an old-shape pending is treated as absent.
- [x] `lib/picker/collect.ts`: `assembleFeedback` returns one entry; tests.
- [x] `lib/picker/screenshot.ts` + `lib/picker/messages.ts`: capture the first entry; attach the screenshot to `elements[0].extras`; tests. No multi behavior yet.
- [x] `lib/storage/pending.ts`: new feedback shape; `setPendingFeedback` unchanged; tests.
- [x] `lib/storage/outbox.ts`: `OutboxFacts.elements?`; `isOutboxFacts` accepts old `element`/`extras`; `readOutbox` normalizes to `elements`; tests.
- [x] `lib/composer/assemble.ts`: `buildElementOutboxItem` copies `elements`; `withoutScreenshot` strips the last element's shot; tests.
- [x] `lib/composer/messages.ts`: the outbox quota fallback checks for any element screenshot before stripping; tests.
- [x] `lib/send/attachments.ts`: `elementAttachments(elements)`; names `element-1.png` …; tests.
- [x] `lib/send/prompt.ts`: compact N=1 and N>1; attrs on the element line; one extras line; no box; no footer; drop `sentAt`; snapshots.
- [x] `lib/send/send.ts`: attachments array; `SentItem.elementCount`; tests.
- [x] `lib/storage/sent.ts`: optional `elementCount`; validation; tests.
- [x] `lib/storage/budgets.ts`: all attachments; no `sentAt`; tests.
- [x] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- A single-element pick still sends; the prompt is compact and has no footer.
- A page-only send keeps the page block and has no footer.
- An old queued item with `facts.element` sends as a one-element set.
- `SentItem.elementCount` is 0 for page-only and N for element sets; old records stay undefined.
- The panel rows do not change in this ticket.

## Outcome

Shipped 2026-10-21. Feedback carries `elements: { element, extras? }[]` end to end; `OutboxFacts.elements`; old queued `facts.element` items pass the guard and `readOutbox` normalizes them; the prompt is compact for every N with attrs inline, one optional `extras` line, no box, and no footer; attachments are `element-1.png` …; `SentItem.elementCount` is 0 page-only and N for element sets.

Tests: 50 files, 775 passing (compile and build green). New coverage: guard old/new shapes and empty sets, capture attaches to the first entry, old pending treated as absent, readOutbox normalization, set copy and last-shot stripping, any-element quota fallback, attachment order/naming, N=1/N=2/N=3 prompt snapshots, page-only prompt, old-item and multi-element sends, sent `elementCount` validation and 0/N writes.

Divergences and notes:

- `elementAttachments` names by element ordinal, so a set whose first element has no shot starts at `element-2.png`; the ordinal keeps the file-to-element mapping.
- `readOutbox` normalizes in memory; storage rewrites old items on the next outbox write.
- The issue left the extras separator unspecified; component, styles, and ARIA join with ` · ` on one line.
- `isPickerFeedback` rejects the old single-element shape, so an old pending capture reads as absent.
- `withoutScreenshot` strips one shot per call, walking from the last element backward to the last element that has one.
- Commit sha is recorded by 015e.

