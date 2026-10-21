# 015 — Element set (one comment, many elements)

Source: wayfinder map (`map.md`), decisions 2026-10-21. Visual source: `prototype.html`, variant A.

One comment attached to up to five elements on the same page, picked with Cmd/Ctrl+click, sent as one feedback to the active session. Single-element sends keep working; the prompt becomes compact for every N.

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 015a | `ticket-01-data-prompt.md` | shipped · 2a905e9 + e1dfccf | — |
| 015b | `ticket-02-composer-plumbing.md` | shipped · sha pending (015f) | 015a |
| 015c | `ticket-03-multi-pick.md` | shipped · sha pending (015f) | 015b |
| 015d | `ticket-04-capture-budget.md` | shipped · sha pending (015f) | 015c |
| 015e | `ticket-05-panel-counts.md` | shipped · sha pending (015f) | 015a |
| 015f | `ticket-06-docs-verification.md` | ready | 015a–015e |

Policy: one ticket = one conventional commit; tests ship with it. Vocabulary: `CONTEXT.md`. Decisions: `product.md` and the map.

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
| Full loop | live CDP smoke: 3 picks, 5 cap, N=1, server context |
