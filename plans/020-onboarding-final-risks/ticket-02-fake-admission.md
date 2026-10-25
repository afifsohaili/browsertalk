# 020b: Fake admission quarantine

**What to build:** A stored fake admission cannot become a false Sent entry after a cleanup-write failure and migration. The quarantine runs before the admission bypass.

**Blocked by:** 020a.

**Status:** shipped · cadc726.

## Shipped

- `unavailableStoredBackend` in `lib/send/send.ts` no longer returns early for `item.admission`. It checks the stored destination's backend first: user-selectable backends deliver normally; a non-selectable backend is quarantined unless settings still select it. The now-unused `item` parameter was removed.
- Regressions: `migrate.test.ts` persists a fake admission after a rejected `commitDeliveredItem` write, migrates the stored backend to `opencode`, and retries. The retry returns the existing quarantine error, keeps the item queued with its admission, writes no Sent entry, and makes no HTTP call. `send.test.ts` recovers an admitted `opencode` receipt with no backend call.

## Divergences

- A stored fake admission is quarantined with the same "no longer offers" error as an unadmitted item, and the admission stays on the queued item. Recovering it requires discard and re-queue.
- Explicitly injected fake destinations still deliver while settings select the fake backend. Only migration away from that backend quarantines them.
- The cleanup-error regression lives in `migrate.test.ts`, next to the 019 F1 migration → send coverage, because the failure only appears after boot migration.

## Seams under test

- Migration then send with WXT `fakeBrowser`, the registered fake backend, a scripted rejected `commitDeliveredItem` write, and injected opencode HTTP that must stay uncalled.
- Send pipeline with an `opencode` destination and a persisted admission: receipt recovery without a backend call.

## Acceptance criteria

- [x] F1a: a stored destination whose backend is not user-selectable is quarantined before `item.admission` is trusted. A fake-backed profile with a persisted admission, a rejected `commitDeliveredItem` cleanup write, and a later migration cannot produce `ok: true`, empty the outbox, or write a Sent entry.
- [x] Retry returns an actionable error, leaves the item queued, and makes no HTTP call.
- [x] Real-backend receipt recovery still works. Explicit fake injection in tests still works.
- [x] Add the cleanup-error → migration → retry regression.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/send/send.ts`; the admission bypass was before the destination check.
- Do not edit the unrelated WIP files.
