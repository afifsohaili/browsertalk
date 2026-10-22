# 018 — Onboarding review fixes

Source: `plans/017-onboarding/review.md` (2026-10-22). Verdict: changes requested. 0 blocker, 2 high, 5 medium, 2 low.

Scope: all findings, including the inherited R7 consent issue. R5 gets real component tests with `@vue/test-utils` and happy-dom. R7 is a separate security fix, not a 017 regression.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 018a | `ticket-01-blocking.md` | ready | 017 |
| 018b | `ticket-02-migration-version-copy.md` | ready | 018a |
| 018c | `ticket-03-component-tests.md` | ready | 018a |
| 018d | `ticket-04-consent-gate.md` | ready | 018c |

Policy: one ticket = one conventional commit; tests ship with it. `bun run compile` and `bun run test` before each commit.

## Findings map

| Finding | Severity | Ticket |
|---|---|---|
| R1 remote link bypasses origin confirmation | high | 018a |
| R2 upgrade state hides pairing and recheck | high | 018a |
| R3 badge stale after status check | medium | 018a |
| R4 stored fake not normalized in connection layer | medium | 018b |
| R5 no rendered welcome/panel specs | medium | 018c |
| R6 parser/feature negatives and cancel persistence | medium | 018b |
| R7 panel reads before consent | medium (inherited) | 018d |
| R8 version gate accepts malformed 2.x | low | 018b |
| R9 disclosure/store copy still names 15001 | low | 018b |

## Out of scope

- New onboarding features.
- Store submission.
- `pi` adapter.
