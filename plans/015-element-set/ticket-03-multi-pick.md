# 015c: Multi-pick selection (N>1)

**What to build:** Cmd/Ctrl+click accumulates up to five elements on the current page. Numbered badges and outlines; a bottom-centre count pill with Clear; release Cmd/Ctrl, Enter, or the fifth pick opens the composer with the full set. Modifier-click toggles; blur and any route change clear and disarm; Escape and Clear disarm. The composer and queue are already set-aware from 015b.

**Owner decisions (2026-10-21):** [Multi-pick loop](issues/02-pick-loop.md), [Visual affordance](issues/03-visual-affordance.md). Visual source: `prototype.html`, variant A.

**Blocked by:** 015b.

**Status:** ready.

## Checklist

- [ ] `lib/picker/selection.ts` (new): pure state for add/toggle/cap/finish/clear; tests.
- [ ] `lib/picker/session.ts`: Cmd/Ctrl clicks add, toggle, stay armed; plain click with no set adds and finishes; plain click with a set finishes without adding; release/Enter/fifth pick finish; blur clears; numbered badges and selected outlines; bottom-centre count pill (`N selected · release ⌘/Ctrl to comment`) with Clear; tests for the pure parts + live CDP.
- [ ] Route watcher: patch `popstate`, `hashchange`, `pushState`, `replaceState`; clear and disarm on any route change; keep the watcher alive through the composer; restore history methods on cleanup; tests/live.
- [ ] `lib/picker/protocol.ts` + `lib/picker/messages.ts`: real `elementIndex` per picked element; one message per element; guards; tests.
- [ ] `lib/picker/messages.ts` + `lib/storage/pending.ts`: out-of-order `mergePendingElement`; tests.
- [ ] `lib/composer/element-submission.ts`: track all elements; `submit` awaits all; fail on the first capture error; tests.
- [ ] Add `picker/cleared` (set id) to clear the background pending on cancel, blur, or route; tests.
- [ ] `entrypoints/picker.content.ts`: wire `onPick` → `track(feedback, index)` and `onFinish` → `openSet(elements, anchor)`.
- [ ] `bun run compile` + `bun run test` pass; live CDP smoke of the loop; one conventional commit.

## Acceptance

- Hold Cmd/Ctrl, click 3 elements: badges 1–3, `3 selected · release ⌘/Ctrl to comment`; release opens the composer with 3 chips.
- One comment sends one feedback with 3 elements; the pending set is complete; no partial send.
- Plain click with no set sends 1; the fifth modifier-click opens the composer immediately; there is no sixth click.
- Modifier-click a selected element toggles it off; chip × removes one; removing all shows the empty state.
- Blur and any route change clear and disarm; Escape and Clear disarm; an open composer closes on a route change.
- Single-element behavior is unchanged.

## Outcome

<!-- fill after shipping: what shipped, live check, divergences -->
