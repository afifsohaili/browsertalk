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
| 017a | `ticket-01-connection-core.md` | shipped · cd6caf8 | — |
| 017b | `ticket-02-welcome-tab.md` | shipped · 6fb7802 | 017a |
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

## Closeout 017a

Shipped 2026-10-22 in `cd6caf8`.

- Connection service: parse link/code, confirm remote links, persist the link endpoint and token after a successful exchange, reset, version gate.
- opencode probe: unauthenticated `/api/info` separates down from unpaired; every state carries a next action.
- Panel setup card; options Test connection, Forget pairing, advanced server URL; fake backend hidden with a stored-fake fallback.
- Divergences: "Finish setup" opens the options page until 017b adds the welcome tab. Docs SHA lives in the follow-up commit because a commit cannot contain its own hash.
- 017b must-know: import `useConnection` for pairing state; it exposes `pair`, `remoteConfirmation`, `confirmRemote`, `cancelRemote`, and `forget`. Reuse `CONNECTION_LABELS`, `CONNECTION_ACTIONS`, `connectedSummary`, and `connectionState`. The panel no longer hosts the pairing form.

## Closeout 017b

Shipped 2026-10-22 in `6fb7802`.

- Install handler runs before the background's first await: `reason=install` only, development and admin skipped via `browser.management.getSelf()`. It opens `welcome.html` and sets the setup badge.
- Badge: set on install, cleared after a successful pair, set again on Forget pairing, restored on startup when the probe is not connected.
- `useSetup` is the one setup state machine. The welcome page and the panel card both read it; the card's "Finish setup" opens the welcome tab.
- Welcome page: prerequisite, pair command with copy, link/code field, live state with Check again, version, link warning, remote origin confirmation, project handoff, Open side panel, pin instructions.
- Divergences: badge text is `1`; the welcome page has a manual Check again because live state does not poll; the SHA lives in the follow-up docs commit.
- 017c must-know: the setup surface is `welcome.html`; docs and store copy should link there. `SETUP_COPY` in `lib/onboarding/copy.ts` holds the shared setup lines.
