# 018 — Onboarding review fixes

Source: `plans/017-onboarding/review.md` (2026-10-22). Verdict: changes requested. 0 blocker, 2 high, 5 medium, 2 low.

Scope: all findings, including the inherited R7 consent issue. R5 gets real component tests with `@vue/test-utils` and happy-dom. R7 is a separate security fix, not a 017 regression.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 018a | `ticket-01-blocking.md` | shipped · 0ecd272 | 017 |
| 018b | `ticket-02-migration-version-copy.md` | shipped · 5175153 | 018a |
| 018c | `ticket-03-component-tests.md` | shipped · 456ffea | 018a |
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

## Closeout 018a

Shipped 2026-10-22 in `0ecd272`.

- Every remote link confirms its origin, independent of the saved remote policy. A second remote link confirms again; cancel writes nothing.
- `upgrade` keeps the pairing form and Check again; a supported 2.x link recovers.
- `connection/status` applies the probe to the badge in both directions.
- Divergences: the SHA lives in the follow-up docs commit; rendered welcome specs stay in 018c.
- 018b must-know: `resolvePairingEndpoint` confirms on `credential.remote` alone. Do not reintroduce the `allowRemote` shortcut. `showsRecheck` gates Check again; `showsPairForm` now includes `upgrade`.

## Closeout 018b

Shipped 2026-10-22 in `5175153`.

- Boot migration normalizes a stored `fake` to `opencode`; connection, pairing, and delivery specs cover it without visiting settings.
- Version gate is strict 2.x semver-ish; parser and cancel/version-failure negatives ship with the fix.
- ConsentGate, README, and the store record use pairing-endpoint wording; `15001` stays documented as the legacy fallback.
- Divergences: the SHA lives in the follow-up docs commit; the migration owner identity is normalized too. `2.0.32+build` metadata is accepted.
- 018c must-know: the ConsentGate copy is now the exact store-recorded text; render specs should assert it verbatim.

## Closeout 018c

Shipped 2026-10-22 in `456ffea`.

- Welcome spec mounts the real tab with `fakeBrowser`, real connection messaging, and injected opencode fetch. Covers the unreachable pair form, upgrade plus Check again recovery, remote origin/warning, cancel, connected handoff, clipboard success/rejection, and the side-panel fallback.
- Panel card spec covers all five states, the fake backend's Connected result without network, Finish setup opening the welcome tab, and the absence of a pairing form.
- Divergences: clipboard rejection now renders visible `copyFailed` copy, because the surface previously swallowed it; `@vitejs/plugin-vue` joins `@vue/test-utils` so Vitest can mount SFCs. The SHA lives in the follow-up docs commit.
- 018d must-know: panel-card specs stop at the card, so consent gating still needs its own rendered proof. Mounted specs must unmount to release the connection listeners.
