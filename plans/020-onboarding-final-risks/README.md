# 020 — Onboarding final risks

Source: `plans/019-onboarding-residual-fixes/review.md` (2026-10-25). Verdict: changes requested. 0 blocker, 4 risk, 0 nit.

Scope: F3a, F3b, F1a, F7a. One subagent per ticket, foreground, sequential. Rerun the review after 020c.

Do not touch or stage the uncommitted `entrypoints/background.ts`, `lib/background.test.ts`, `components/ArmPickerButton.*`, `entrypoints/sidepanel/PanelSurface.*`, `promo/`, or the review reports.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 020a | `ticket-01-badge-races.md` | shipped · d93dca5 | 019 |
| 020b | `ticket-02-fake-admission.md` | shipped · cadc726 | 020a |
| 020c | `ticket-03-semver-numeric.md` | shipped · 1b5f58f | 020b |

## Findings map

| Finding | Severity | Ticket |
|---|---|---|
| F3a startup probe bypasses the badge guard | risk | 020a |
| F3b obsolete reset repaints another badge | risk | 020a |
| F1a stored fake admission bypasses quarantine | risk | 020b |
| F7a numeric prerelease leading zeros pass | risk | 020c |

## Closeout 020a (F3a, F3b)

020a shipped 2026-10-25 in `d93dca5`.

- The generation and connection guard moved into `lib/onboarding/badge.ts`. Startup `syncSetupBadge`, `connection/status`, pair, and reset share one counter; a check paints only while its generation is newest and its `backendId`/`serverUrl` is still configured.
- Pair and reset claim a generation before their badge write, so an in-flight startup probe cannot repaint afterwards.
- Reset captures the connection before clearing its token and writes the badge only when that connection is still configured. A reset for A that finishes after B is connected leaves the badge clear and B's token intact.
- Five regressions: stale startup error after connected B, stale startup after a settings switch with no newer probe, stale startup after pair, stale startup after reset, and held reset A after connected B.
- Divergences: the generation left `messages.ts` for `badge.ts`; reset only invalidates when its own connection is still configured, so newer checks stay authoritative. An already in-flight badge write cannot be retracted.
- 020b must-know: `nextStatusGeneration`, `configuredConnectionKey`, and `writeBadgeIfCurrent` are exported from `lib/onboarding/badge.ts`. Full suite: 82 files, 1,114 tests. Leave the unrelated `background.ts`, `lib/background.test.ts`, `ArmPickerButton`, `PanelSurface`, `promo/`, and review reports unstaged.

## Closeout 020b (F1a)

020b shipped 2026-10-25 in `cadc726`.

- `unavailableStoredBackend` in `lib/send/send.ts` checks the stored destination before trusting `item.admission`. A non-user-selectable backend is quarantined unless settings still select it. User-selectable backends keep receipt recovery; explicitly injected fakes still deliver while selected.
- The regression in `lib/connection/migrate.test.ts` rejects `commitDeliveredItem`'s cleanup write, persists the fake admission, migrates to `opencode`, and retries. The retry records the existing quarantine error, leaves the item queued with its admission, writes no Sent entry, and makes zero HTTP calls.
- `lib/send/send.test.ts` adds the preserved path: an admitted `opencode` destination recovers its receipt with no backend call.
- Divergences: the quarantine reuses the unadmitted-destination error and leaves the admission in place; recovery requires discard and re-queue. The now-unused `item` parameter was removed from `unavailableStoredBackend`.
- 020c must-know: the "no longer offers" message and the settings-selects-it escape hatch are unchanged. Full suite: 82 files, 1,116 tests. Leave the unrelated `background.ts`, `lib/background.test.ts`, `ArmPickerButton`, `PanelSurface`, `promo/`, and review reports unstaged.

## Closeout 020c (F7a)

020c shipped 2026-10-25 in `1b5f58f`.

- The gate now applies semver's numeric prerelease rule. `2.0.32-01` and `2.0.32-beta.01` reject; `2.0.32`, `2.1.0-beta`, `2.0.0-rc.1+build.5`, and `2.0.0+build.01` stay accepted.
- Coverage runs at four seams: the status unit, paired `ping`, `authenticate` after redemption, and `pairWithServer` persistence. The persistence case seeds nondefault settings plus saved-endpoint and unrelated tokens, and compares the exact settings and raw-storage snapshots after each rejected version.
- Divergence: the prerelease grammar is one shared string fragment, and main-version leading zeros (`2.00.1`) remain accepted outside F7a's scope. All four new tests fail against the old gate; sensitivity was checked by stashing the production change.
- 020 closeout: all four findings shipped. Full suite: 82 files, 1,121 tests. Leave the unrelated `background.ts`, `lib/background.test.ts`, `ArmPickerButton`, `PanelSurface`, `promo/`, and review reports unstaged.
