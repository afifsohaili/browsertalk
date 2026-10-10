# 010 — Hardening (pre-009 review fixes)

Source: pre-009 review (general + `openai/gpt-6.1-sol`, 2026-10-10; full report at `/tmp/opencode/review-pre-009.md`). Runs **before 009** (pi adapter); 009 stays blocked until the seams are correct.

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 010-01 | `ticket-01-connection-identity.md` | shipped · 281b18c | 008 |
| 010-02 | `ticket-02-backend-onboarding.md` | shipped · e3c1053 | 010-01 |
| 010-03 | `ticket-03-serialized-admission.md` | shipped · b9874ef | 010-02 |
| 010-04 | `ticket-04-capture-quota-consent.md` | shipped · df64ba9 | 010-03 |
| 010-05 | `ticket-05-conformance.md` | shipped · 5bdea01 | 010-04 |

Findings map: 1→010-02, 2→010-01, 3→010-02, 4→010-01, 5→010-04, 6→010-03, 7→010-03, 8→010-04, 9→010-04, 10→010-03, 11→010-02, 12→010-04. Coverage gaps: 1→010-05, 2–4→010-03/010-04 (TDD) + 010-05, 5→010-04.

Phase tickets (001–008) stay historical; corrections are recorded here. One ticket = one conventional `fix(...)` commit.
