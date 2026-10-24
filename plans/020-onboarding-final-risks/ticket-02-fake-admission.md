# 020b: Fake admission quarantine

**What to build:** A stored fake admission cannot become a false Sent entry after a cleanup-write failure and migration. The quarantine runs before the admission bypass.

**Blocked by:** 020a.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] F1a: a stored destination whose backend is not user-selectable is quarantined before `item.admission` is trusted. A fake-backed profile with a persisted admission, a rejected `commitDeliveredItem` cleanup write, and a later migration cannot produce `ok: true`, empty the outbox, or write a Sent entry.
- [ ] Retry returns an actionable error, leaves the item queued, and makes no HTTP call.
- [ ] Real-backend receipt recovery still works. Explicit fake injection in tests still works.
- [ ] Add the cleanup-error → migration → retry regression.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/send/send.ts`; the admission bypass is before the destination check.
- Do not edit the unrelated WIP files.
