# 017 — Onboarding

Source: exploration 2026-10-22. The extension assumes a fixed server URL and a low-level pairing command. A stock opencode 2 install has neither.

## Decisions locked 2026-10-22

| Decision | Choice |
|---|---|
| Setup surface | Welcome tab on install + compact setup card in the side panel |
| Server discovery | `opencode pair` link; no port scan |
| Pairing input | Pairing link or bare code |
| Diagnosis | State taxonomy: unreachable / unpaired / unauthorized / incompatible / connected |
| Fake backend | Removed from user choices |
| Version | Require opencode 2.x; nudge to upgrade |
| Remote link | Confirm in setup with the existing remote-server warning |
| Install entry | `reason=install` only; skip development and admin; badge until connected |
| Scope | Connection core, welcome tab, docs/store; no demo or doctor view |

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 017a | `ticket-01-connection-core.md` | shipped | — |
| 017b | `ticket-02-welcome-tab.md` | ready | 017a |
| 017c | `ticket-03-docs-store.md` | ready | 017a, 017b |

Policy: one ticket = one conventional commit; tests ship with it. Feature specs verify the public seam; unit tests cover edge cases. `bun run compile` and `bun run test` must pass before each commit.

## Setup copy

1. "Browsertalk needs opencode 2 running on this machine."
2. "Run `opencode pair` in a terminal."
3. "Copy the link. Do not open it. Links expire in 5 minutes."
4. "Paste the link or code."
5. "Connected: opencode 2.0.32 at 127.0.0.1:29422."
6. "Switch to your dev site, then pick a project in the side panel."

## Test matrix

| Behaviour | Seam | Kind |
|---|---|---|
| Pairing link and bare code parse | Adapter credential parser | Unit |
| Unreachable, unpaired, unauthorized, incompatible, connected | `ping` / connection service | Unit |
| Pair link stores token under the link endpoint and reaches connected | `pairWithServer` + `pingConnection` + projects | Feature |
| Remote link confirm/cancel persists nothing on cancel | `pairWithServer` | Feature |
| Version gate accepts 2.x and rejects others | `ping` | Unit |
| Forget pairing clears the token and returns to unpaired | reset service | Feature |
| Fake backend hidden from choices; stored fake falls back | settings page | Unit |
| Install opens welcome; update does not; dev/admin skipped | install handler | Unit |
| Badge set until connected, cleared after pair | install handler | Unit |
| Welcome and panel share one setup state machine | setup composable | Unit |

## Out of scope

- Port scanning. The pairing link carries the real port.
- A demo or fake backend in user choices.
- A doctor view with raw diagnostics.
- Password auth.
- `pi` adapter changes.
