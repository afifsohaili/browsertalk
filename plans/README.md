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
| 010 | `010-hardening/` | `ticket-01..12` | shipped · 0175cb1 (round 4, final local) | 008 |
| 009 | `009-pi-adapter/` | `ticket.md` | ready · locally unblocked; live acceptance gate | — |
| 011 | `011-panel-first/` | `ticket.md` | shipped · 8a269ab | — |
| 012 | `012-session-picker/` | `ticket.md` | shipped · 6ac9f55 | — |
| 013 | `013-panel-comment/` | `ticket.md` | shipped · 40fb88a | — |
| 014 | `014-remote-server/` | `ticket.md` | shipped · 05151fa | — |
| 015 | `015-element-set/` | `ticket-01..06` | shipped · 924b8cb | — |
| 016 | `016-review-fixes/` | `ticket-01..06` | shipped · 944f1d9 | 015 |
| 017a | `017-onboarding/` | `ticket-01-connection-core.md` | shipped · cd6caf8 | — |
| 017b | `017-onboarding/` | `ticket-02-welcome-tab.md` | shipped · 6fb7802 | 017a |
| 017c | `017-onboarding/` | `ticket-03-docs-store.md` | shipped · 8a9b0f7 | 017a, 017b |
| 018a | `018-onboarding-review-fixes/` | `ticket-01-blocking.md` | shipped · 0ecd272 | 017 |
| 018b | `018-onboarding-review-fixes/` | `ticket-02-migration-version-copy.md` | shipped · 5175153 | 018a |
| 018c | `018-onboarding-review-fixes/` | `ticket-03-component-tests.md` | shipped · 456ffea | 018a |
| 018d | `018-onboarding-review-fixes/` | `ticket-04-consent-gate.md` | shipped · f55ee9d | 018c |
| 019a | `019-onboarding-residual-fixes/` | `ticket-01-security-correctness.md` | shipped · aae5154 | 018 |
| 019b | `019-onboarding-residual-fixes/` | `ticket-02-test-hardening.md` | shipped · a858c96 | 019a |
| 020a | `020-onboarding-final-risks/` | `ticket-01-badge-races.md` | ready | 019 |
| 020b | `020-onboarding-final-risks/` | `ticket-02-fake-admission.md` | ready | 020a |
| 020c | `020-onboarding-final-risks/` | `ticket-03-semver-numeric.md` | ready | 020b |

Policy:

- One ticket = one conventional commit; tests ship with it.
- Tests use the `fake` agent backend and WXT's `fakeBrowser`; no live LLM spend, no live server needed.
- Close each phase by updating its folder: status, what shipped, divergences, next-phase must-know notes. Phase status flips `ready` → `shipped · <sha>` in the table above.
- Vocabulary: `CONTEXT.md`. Product decisions: `product.md`. Research lives with its phase (`003-session-strategy/`).
