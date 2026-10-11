# 010 — Hardening (pre-009 review fixes)

Source: pre-009 review (general + `openai/gpt-6.1-sol`, 2026-10-10; report at `/tmp/opencode/review-pre-009.md`). Round 2 source: verification of 010-01..05 (report at `/tmp/opencode/verify-pre-009.md`). Runs **before 009** (pi adapter); 009 stays blocked until the seams are correct.

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 010-01 | `ticket-01-connection-identity.md` | shipped · 281b18c | 008 |
| 010-02 | `ticket-02-backend-onboarding.md` | shipped · e3c1053 | 010-01 |
| 010-03 | `ticket-03-serialized-admission.md` | shipped · b9874ef | 010-02 |
| 010-04 | `ticket-04-capture-quota-consent.md` | shipped · df64ba9 | 010-03 |
| 010-05 | `ticket-05-conformance.md` | shipped · 5bdea01 | 010-04 |
| 010-06 | `ticket-06-admission-integrity.md` | shipped · c9430aa | 010-05 |
| 010-07 | `ticket-07-byte-budgets-serialization.md` | shipped · 18e21b2 | 010-06 |
| 010-08 | `ticket-08-migration-selection.md` | shipped · 5a181e4 | 010-07 |
| 010-09 | `ticket-09-admission-reservation.md` | shipped · b9b4f44 | 010-08 |
| 010-10 | `ticket-10-migration-frozen-pending.md` | shipped · 5da52cf | 010-09 |
| 010-11 | `ticket-11-sent-bound-target-gate.md` | shipped · b08d057 | 010-10 |

Findings map: 1→010-02, 2→010-01, 3→010-02, 4→010-01, 5→010-04, 6→010-03, 7→010-03, 8→010-04, 9→010-04, 10→010-03, 11→010-02, 12→010-04. Coverage gaps: 1→010-05, 2–4→010-03/010-04 (TDD) + 010-05, 5→010-04.

Phase tickets (001–008) stay historical; corrections are recorded here. One ticket = one conventional `fix(...)` commit.

Round-2 re-verification: **done** (`/tmp/opencode/verify2-pre-009.md`) — 3 of 8 regressions closed, 5 partially closed, 7 remaining issues (3 major, 4 moderate) all locally reproduced with probes. Round-3 fix set 010-09..11 addresses them; the seven reproduction probes get re-run after the fixes. 010-09 shipped (`b9b4f44`): the probe file then failed exactly probes 3 and 7 (corrected behavior). 010-10 shipped (`5da52cf`): the probe file then failed probes 1, 3, 4, 6, and 7. 010-11 shipped (`b08d057`): probes 2 (sent bounds) and 5 (target invalidation) converted; re-running `/tmp/opencode/verify2-pre-009.probes.test.ts` now fails all seven reproductions — every verify2 probe is converted to a repo test with corrected expectations. Round 3 is complete and 009 is unblocked; the live phase-009 acceptance gate still applies.
