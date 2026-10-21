# 015b: Multi-pick selection and element-set composer

**What to build:** Cmd/Ctrl+click accumulates up to five elements on the current page. Numbered badges and outlines; a bottom-centre count pill with Clear; release Cmd/Ctrl, Enter, or the fifth pick opens the anchored composer with chips and one shared comment. Modifier-click toggles; blur and any route change clear and disarm; Escape and Clear disarm. The composer sends one feedback with the whole set. Screenshots keep today's behavior in this phase; 015c replaces the throttle.

**Owner decisions (2026-10-21):** [Multi-pick loop](issues/02-pick-loop.md), [Visual affordance](issues/03-visual-affordance.md), [Data/prompt](issues/01-data-and-prompt.md). Visual source: `prototype.html`, variant A.

**Blocked by:** 015a.

**Status:** ready.

## Checklist

- [ ] `lib/picker/selection.ts` (new): pure state for add/toggle/cap/finish/clear; tests.
- [ ] `lib/picker/session.ts`: arm state; Cmd/Ctrl clicks add, toggle, stay armed; plain click with no set adds and finishes; plain click with a set finishes without adding; release/Enter/fifth pick finish; blur clears; route events (`popstate`, `hashchange`, patched `pushState`/`replaceState`) clear and disarm; restore history methods on cleanup; numbered badges and selected outlines; bottom-centre count pill (`N selected · release ⌘/Ctrl to comment`) with Clear; tests for the pure parts + live CDP.
- [ ] Keep the route watcher alive through the composer: `finish()` disarms the picker but does not stop it; stop it on send, close, Escape, Clear, blur, or route.
- [ ] `lib/picker/protocol.ts` + `lib/picker/messages.ts`: `picker/captured` carries `elementIndex`; one message per picked element; guards; tests.
- [ ] Add `picker/cleared` (set id) to clear the background pending on cancel, blur, or route; tests.
- [ ] `lib/storage/pending.ts`: `mergePendingElement(tabId, feedback, index)` upserts by index, sorted, initializes on the first; out-of-order tests.
- [ ] `lib/composer/element-submission.ts`: track every element's capture promise; `submit` awaits all; fail on the first capture error; carry `elementCount`; tests.
- [ ] `lib/composer/protocol.ts` + `lib/composer/messages.ts`: `composer/queue` gains `elementCount`; reject an incomplete set; tests.
- [ ] `lib/composer/session.ts`: `openSet(elements, anchor)` anchored card (variant A), chips + ×, empty state, textarea focus, Queue; plural screenshot-drop copy; tests/live.
- [ ] `entrypoints/picker.content.ts`: wire `onPick` → submission and `onFinish` → composer.
- [ ] `bun run compile` + `bun run test` pass; live CDP smoke of the loop; one conventional commit.

## Acceptance

- Hold Cmd/Ctrl, click 3 elements: badges 1–3, `3 selected · release ⌘/Ctrl to comment`; release opens the composer with 3 chips.
- One comment sends one feedback with 3 elements; the pending set is complete; no partial send.
- Plain click with no set sends 1; the fifth modifier-click opens the composer immediately; there is no sixth click.
- Modifier-click a selected element toggles it off; chip × removes one; removing all shows the empty state.
- Blur and any route change clear and disarm; Escape and Clear disarm.
- Single-element behavior is unchanged except the compact prompt from 015a.

## Outcome

<!-- fill after shipping: what shipped, divergences, live check -->
