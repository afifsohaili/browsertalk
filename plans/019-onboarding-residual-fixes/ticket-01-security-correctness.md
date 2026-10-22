# 019a: Security and correctness residuals

**What to build:** A queued feedback item cannot deliver a fake success after the boot migration. A stale consent read cannot mount the panel after a newer decline. A stale status probe cannot repaint the badge.

**Blocked by:** 018.

**Status:** F1 shipped · 154f1ed. F2 shipped · e494eb8. F3 pending.

## Shipped: F1

- `sendQueuedItem` records an actionable error and returns without touching the backend when a stored destination's backend is no longer user-selectable. The item stays queued with its frozen destination; no Sent entry is written.
- The migration → send regression seeds accepted consent, a queued `fake` destination, and a stored `fake` selection. Boot normalizes the selection to opencode, then delivery quarantines the frozen destination instead of sending it to `fake`.

## Divergences: F1

- A frozen nonselectable destination still delivers while that same backend remains the configured selection. Boot migration makes this unreachable in production, and the exception preserves explicit fake injection in existing tests.
- An already-admitted item skips the quarantine: committing its receipt needs no backend.
- Two send specs that used a captured `fake` destination under an opencode selection now exercise the captured-destination and connection-queue behavior through two opencode endpoints. They asserted the pre-fix false success.

## Seams under test: F1

- Boot migration → delivery: stored fake destination, normalized opencode selection, accepted consent.
- Delivery: error recorded on the item, outbox retained, Sent empty, zero fetch calls.

## Shipped: F2

- `useConsent` keeps a generation counter. Every read captures the counter; a newer read, accept, decline, or consent storage change bumps it. Only the current generation writes `status` and `loaded`.
- The rendered regression holds the initial stored-`accepted` read, completes a newer `declined` refresh, then releases the accepted reply. The gate stays declined, `main.panel` never mounts, no tab query or tab listener appears, and stored consent remains `declined`.

## Divergences: F2

- `accept` and `decline` bump the generation before their storage write, so a read that lands during the write cannot overwrite the user's choice. On write failure the outstanding read is already stale, leaving `loaded` false; the UI can only call either action after `loaded` is true.
- `accept` and `decline` now set `loaded` when their write succeeds. This preserves the gate boundary if an outstanding read was invalidated.
- No new status source was added. Stale replies are dropped, not reconciled.

## Seams under test: F2

- Rendered side panel: delayed accepted read + newer decline → gate shown, no panel mount, no `browser.tabs.query`, stored consent declined.
- Composable: existing undecided, accept, decline, cross-surface change, unrelated change, and scope-stop cases still pass.

## Acceptance criteria

- [x] F1: `sendQueuedItem` refuses a stored destination whose backend is not user-selectable. It records an actionable error, leaves the item queued, writes no Sent entry, and makes no HTTP call.
- [x] F1: the migration does not silently reroute a frozen fake destination to opencode. Add a migration → send test.
- [x] F2: `useConsent` ignores older reads. A delayed accepted snapshot cannot overwrite a newer declined state.
- [x] F2: after a declined snapshot wins, the panel does not mount and makes no active-tab read. Add a rendered delayed-read regression.
- [ ] F3: badge writes apply only for the latest status generation and current connection. Pair and reset invalidate older probes.
- [ ] F3: an out-of-order A-unreachable after B-connected leaves the badge cleared. The reverse order sets it. Add both regressions.
- [ ] F4: not in this ticket.
- [x] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 019 README, and `plans/README.md` updated with the SHA.

## Notes

- F1: `lib/send/send.ts`, `lib/connection/migrate.ts`, outbox storage. Do not use a connection-wide fallback that breaks explicit fake tests.
- F2: `lib/consent/use-consent.ts`, `entrypoints/sidepanel/App.vue`.
- F3: `lib/connection/messages.ts`, `lib/connection/use-connection.ts`.
