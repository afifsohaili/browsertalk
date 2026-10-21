# 016 — Review fixes (015 element set)

Source: two-axis review of `be30179..e3944f0` (2026-10-21): Standards, Spec, and coverage. Findings and quotes live in the tickets.

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 016a | `ticket-01-spec.md` | shipped · sha pending (016d) | 015 |
| 016b | `ticket-02-coverage.md` | shipped · sha pending (016d) | 016a |
| 016c | `ticket-03-standards.md` | ready | 016b |
| 016d | `ticket-04-docs-review.md` | ready | 016a–016c |

Policy: one ticket = one conventional commit; tests ship with it. The 015 history notes (015a's two commits, docs inside the first feature commit) are recorded, not rewritten.

## Test matrix

| Fix | Coverage |
|---|---|
| Route bridge | main-world emitter unit + isolated listener + live `pushState` |
| Quota loop | multi-drop until fit |
| Pending clear | composer close clears background pending |
| Panel meta | `1 element` / `N elements` wording |
| DOM sessions | happy-dom: picker, composer, wiring |
| Standards | rename, shared queue/count helper, dead code removed |
