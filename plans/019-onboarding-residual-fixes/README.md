# 019 — Onboarding residual fixes

Source: `plans/018-onboarding-review-fixes/review.md` (2026-10-22). Verdict: changes requested. 0 blocker, 0 high, 4 medium, 3 low.

Scope: all seven residual findings, F1–F7. One subagent per ticket, foreground, sequential. Rerun the review after 019b.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 019a | `ticket-01-security-correctness.md` | ready | 018 |
| 019b | `ticket-02-test-hardening.md` | ready | 019a |

Policy: one ticket = one conventional commit; tests ship with it. `bun run compile` and `bun run test` before each commit.

## Findings map

| Finding | Severity | Ticket |
|---|---|---|
| F1 queued fake destinations deliver false success | medium | 019a |
| F2 stale consent read reopens the panel | medium | 019a |
| F3 stale status probe repaints the badge | medium | 019a |
| F4 tests escape to live loopback | medium | 019b |
| F5 no rendered successful pair/handoff | low | 019b |
| F6 token-preservation test seeds nothing | low | 019b |
| F7 malformed semver suffixes pass | low | 019b |

## Out of scope

- New onboarding features.
- Real-Chrome or store submission.
- Session cleanup.
