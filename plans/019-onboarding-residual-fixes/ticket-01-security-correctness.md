# 019a: Security and correctness residuals

**What to build:** A queued feedback item cannot deliver a fake success after the boot migration. A stale consent read cannot mount the panel after a newer decline. A stale status probe cannot repaint the badge.

**Blocked by:** 018.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] F1: `sendQueuedItem` refuses a stored destination whose backend is not user-selectable. It records an actionable error, leaves the item queued, writes no Sent entry, and makes no HTTP call.
- [ ] F1: the migration does not silently reroute a frozen fake destination to opencode. Add a migration → send test.
- [ ] F2: `useConsent` ignores older reads. A delayed accepted snapshot cannot overwrite a newer declined state.
- [ ] F2: after a declined snapshot wins, the panel does not mount and makes no active-tab read. Add a rendered delayed-read regression.
- [ ] F3: badge writes apply only for the latest status generation and current connection. Pair and reset invalidate older probes.
- [ ] F3: an out-of-order A-unreachable after B-connected leaves the badge cleared. The reverse order sets it. Add both regressions.
- [ ] F4: not in this ticket.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 019 README, and `plans/README.md` updated with the SHA.

## Notes

- F1: `lib/send/send.ts`, `lib/connection/migrate.ts`, outbox storage. Do not use a connection-wide fallback that breaks explicit fake tests.
- F2: `lib/consent/use-consent.ts`, `entrypoints/sidepanel/App.vue`.
- F3: `lib/connection/messages.ts`, `lib/connection/use-connection.ts`.
