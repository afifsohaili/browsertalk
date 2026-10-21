# 015b: Element-set composer plumbing (N=1)

**What to build:** Make the composer and queue set-aware while the picker still sends one element. The composer renders one chip, the queue requires the set count, and the background merges pending elements by index. This is the shippable N=1 step before multi-pick.

**Owner decisions (2026-10-21):** [Data/prompt](issues/01-data-and-prompt.md), [Visual affordance](issues/03-visual-affordance.md). The composer is variant A (anchored card, chips, textarea, Queue); 015c unlocks N>1.

**Blocked by:** 015a.

**Status:** ready.

## Checklist

- [ ] `lib/picker/protocol.ts` + `lib/picker/messages.ts`: `picker/captured` carries `elementIndex` (0 for now); guards; tests.
- [ ] `lib/storage/pending.ts`: `mergePendingElement(tabId, feedback, index)` upserts by index, sorted, initializes on the first; tests.
- [ ] `lib/composer/element-submission.ts`: track by index; `remove(index)`; `submit` awaits all tracked captures and sends `elementCount`; tests.
- [ ] `lib/composer/protocol.ts` + `lib/composer/messages.ts`: `composer/queue` gains `elementCount`; reject an incomplete set; tests.
- [ ] `lib/composer/session.ts`: `openSet(elements, anchor)` anchored card with chips + ×, empty state, textarea focus, Queue; chip labels from `PickerElementFacts`; `queue` passes the remaining count; tests for the pure label helper, live smoke for the DOM.
- [ ] `entrypoints/picker.content.ts`: `onPick` → `track(feedback, 0)`; open the composer with one chip; single-element behavior preserved.
- [ ] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- A single pick opens the anchored card with one chip; × shows the empty state and disables Queue.
- Sending queues one outbox item with `elements.length === 1`; the prompt is compact and attachments are unchanged.
- `composer/queue` rejects a request whose `elementCount` does not match the pending set.
- N>1 is not selectable yet; N=1 behavior is otherwise unchanged.

## Outcome

<!-- fill after shipping: what shipped, tests, live check, divergences -->
