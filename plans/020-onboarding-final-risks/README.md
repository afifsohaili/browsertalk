# 020 — Onboarding final risks

Source: `plans/019-onboarding-residual-fixes/review.md` (2026-10-25). Verdict: changes requested. 0 blocker, 4 risk, 0 nit.

Scope: F3a, F3b, F1a, F7a. One subagent per ticket, foreground, sequential. Rerun the review after 020c.

Do not touch or stage the uncommitted `entrypoints/background.ts`, `lib/background.test.ts`, `components/ArmPickerButton.*`, `entrypoints/sidepanel/PanelSurface.*`, `promo/`, or the review reports.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 020a | `ticket-01-badge-races.md` | ready | 019 |
| 020b | `ticket-02-fake-admission.md` | ready | 020a |
| 020c | `ticket-03-semver-numeric.md` | ready | 020b |

## Findings map

| Finding | Severity | Ticket |
|---|---|---|
| F3a startup probe bypasses the badge guard | risk | 020a |
| F3b obsolete reset repaints another badge | risk | 020a |
| F1a stored fake admission bypasses quarantine | risk | 020b |
| F7a numeric prerelease leading zeros pass | risk | 020c |
