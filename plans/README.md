# Plans — phases and tickets

Phase tracking lives here, not in `product.md`. One folder per phase; one ticket per phase (`ticket.md`), split phases get `ticket-01-*.md` + `ticket-02-*.md`. Tickets were cut with the to-tickets skill: tracer slices with explicit blockers.

| Phase | Folder | Ticket | Status | Blocked by |
|---|---|---|---|---|
| 001 | `001-scaffold/` | — | shipped | — |
| 002 | `002-connection/` | `ticket.md` | shipped · f53aada | — |
| 003a | `003-session-strategy/` | `ticket-01-seam.md` | shipped · 588474d | 002 |
| 003b | `003-session-strategy/` | `ticket-02-settings.md` | shipped · 85368ed | 003a |
| 004a | `004-picker/` | `ticket-01-core.md` | shipped · 67d42ed | 003b |
| 004b | `004-picker/` | `ticket-02-extras.md` | shipped · 5ca2514 | 004a |
| 005 | `005-composer/` | `ticket.md` | shipped · a78df0e | 004b |
| 006 | `006-send/` | `ticket.md` | shipped · 0689dd8 | 005 |
| 007 | `007-panel/` | `ticket.md` | shipped · 75a50ce | 006 |
| 007b | `007-panel/` | `ticket-03-binding.md` | shipped · 342d0d7 | 007 |
| 008 | `008-ship/` | `ticket.md` | shipped · bcaa003 | 007 |
| 010 | `010-hardening/` | `ticket-01..05` | shipped · 5bdea01 | 008 |
| 009 | `009-pi-adapter/` | `ticket.md` | ready · unblocked (010-05 shipped; conformance gate exists) | — |

Policy:

- One ticket = one conventional commit; tests ship with it.
- Tests use the `fake` agent backend and WXT's `fakeBrowser`; no live LLM spend, no live server needed.
- Close each phase by updating its folder: status, what shipped, divergences, next-phase must-know notes. Phase status flips `ready` → `shipped · <sha>` in the table above.
- Vocabulary: `CONTEXT.md`. Product decisions: `product.md`. Research lives with its phase (`003-session-strategy/`).
