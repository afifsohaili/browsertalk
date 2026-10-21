# 015c: Capture budget and multi-element attachments

**What to build:** Screenshots for an element set are best effort. Capture at pick time on Chrome's 2-per-1-second fixed window; the first pick waits for a token, later picks skip when the window is empty. Hide the picker overlay around each capture. Attach up to four crops as `element-1.png` …; storage-quota drops strip from the last element.

**Owner decisions (2026-10-21):** [Screenshot capture under rapid multi-pick](issues/04-screenshot-capture.md). 2-per-1s fixed window; no single frame at finish; skip fast picks; no user-gesture reliance.

**Blocked by:** 015b.

**Status:** ready.

## Checklist

- [ ] `lib/picker/capture-budget.ts` (new): 2 tokens per 1000ms fixed window; `tryAcquire`/`waitForToken`; injectable clock; tests (0/100/200/300ms, 0/500/1000ms, no refund).
- [ ] `lib/picker/screenshot.ts`: remove the 500ms sleep; `captureFor(entry, request, { allowWait })`; `allowWait` only for index 0; skip otherwise; tests.
- [ ] `lib/picker/messages.ts`: one shared budget in the background; skip capture for index ≥ 4; tests.
- [ ] `lib/picker/session.ts` / `lib/composer/element-submission.ts`: hide the overlay host and count pill around each capture with a ref count; restore in `finally`; live check.
- [ ] `lib/send/attachments.ts`: at most 4; `element-1.png` … in element order; tests.
- [ ] `lib/composer/assemble.ts`: `withoutScreenshot` strips the last element's shot, then the previous; tests.
- [ ] `lib/storage/budgets.ts`: count every attachment; tests.
- [ ] `bun run compile` + `bun run test` pass; live CDP check; one conventional commit.

## Acceptance

- Four rapid picks produce at most two `captureVisibleTab` calls in the first second; no quota error; elements without shots still send.
- A lone pick on an empty window waits for the next token and captures; N=1 parity.
- Captured crops contain no picker overlay or count pill; a skipped pick leaves no overlay stuck hidden.
- A five-element set has at most four attachments; the fifth element sends without a shot.
- A full outbox drops screenshots from the last element backward until it fits.

## Outcome

<!-- fill after shipping: quota evidence, live check -->
