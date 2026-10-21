# 015 — Element set (one comment, many elements)

Source: wayfinder map (`map.md`), decisions 2026-10-21. Visual source: `prototype.html`, variant A.

Status: shipped 2026-10-21. One comment attached to up to five elements on the same page, picked with Cmd/Ctrl+click, sent as one feedback to the active session. Single-element sends keep working; the prompt is compact for every N.

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 015a | `ticket-01-data-prompt.md` | shipped · 2a905e9 + e1dfccf | — |
| 015b | `ticket-02-composer-plumbing.md` | shipped · d5b54a2 | 015a |
| 015c | `ticket-03-multi-pick.md` | shipped · f2c20fb | 015b |
| 015d | `ticket-04-capture-budget.md` | shipped · afc495d | 015c |
| 015e | `ticket-05-panel-counts.md` | shipped · 924b8cb | 015a |
| 015f | `ticket-06-docs-verification.md` | shipped · this docs commit | 015a–015e |

Policy: one ticket = one conventional commit; tests ship with it. Vocabulary: `CONTEXT.md`. Decisions: `product.md` and the map.

## What shipped

- Ordered `elements[]` on `PickerFeedback` and `OutboxFacts`; legacy `facts.element` normalizes to a one-entry set on read.
- Compact prompt for N=1 and N>1: attrs on the element line, one `extras` line, no box/viewport/scroll, no Browsertalk footer. Attachments `element-1.png` … capped at four.
- Composer `openSet`: chips with `×`, `N elements` count line, textarea focus, Queue; removal drops the pending element; submit awaits every capture.
- Multi-pick loop: Cmd/Ctrl+click adds, toggles off; release, Enter, or the fifth pick opens the composer; plain click with a set finishes without adding; Clear/Escape/blur/route clear; numbered badges, outlines, bottom-centre count pill.
- Capture budget in the background: 2 starts per 1-second fixed window, shared across tabs; the first pick may wait, later picks skip; 4-shot cap by element index; overlay hidden around each shot.
- Panel rows show `N elements` in outbox and sent meta; `SentItem.elementCount` optional, old records render none.
- Docs and the 015f live smoke.

## Divergences

- Clear, blur, and route changes are silent. The prototype's transient clear toast was not built (optional in `issues/03-visual-affordance.md`).
- SPA route detection: the picker patches `pushState`/`replaceState` from the isolated content-script world. The live smoke saw `popstate` clear the set; a page-world `pushState` did not. `pushState`-only SPA navigation stays unconfirmed (recorded in `product.md` open questions). No code change in 015f. Fixed in 016a with a MAIN-world bridge.
- Live shot cap: five rapid picks attached 2 screenshots, not 4. The 2-per-1s budget spends first; the cap is "at most four", unit-tested (five shots → four attachments) and not exercised live. No quota error appeared.

## Next-phase must-know

- Limits live in `lib/picker/selection.ts` (`MAX_PICKED_ELEMENTS = 5`) and `lib/picker/limits.ts` (`MAX_ELEMENT_ATTACHMENTS = 4`). Both are covered by unit tests; change them there, not in call sites.
- Capture budget tokens are spent before the visibility check and never refunded; Chrome spends the real quota either way.
- The prompt deliberately omits box, viewport, scroll, and the footer. Do not reintroduce them without a product decision.
- `SentItem.elementCount` is optional: 0/absent means page-only or an old record; the panel renders no count.

## Test matrix

| Seam | Coverage |
|---|---|
| Selection state | unit: add/toggle/cap/finish/clear |
| Feedback and outbox shape | unit: new shape, old `element` normalization |
| Prompt | snapshots: N=1, N=3, extras, page-only, no footer |
| Pending merge | unit: out-of-order indices |
| Capture budget | unit: 2-per-1s window, wait, skip, no refund |
| Composer queue | unit: count guard, await-all, failure |
| Panel rows | unit: count label |
| Full loop | live CDP smoke: 3 picks, 5 cap, N=1, clear/blur/route, 4-shot cap, server context |
