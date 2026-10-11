# 010-09: Atomic admission reservation + legacy attempt gating

**What to build:** Fix verify2 issues 1 and 3 (`/tmp/opencode/verify2-pre-009.md`): a successful discard and a transmission can never both happen, and ambiguous legacy attempts can never re-resolve and transmit.

**Blocked by:** 010-08 — Migration leftovers + connection-bound selection.

**Status:** done · b9b4f44

- [x] Admission reservation is atomic in the serialized writer: before reservation, a successful discard means no transmission and no sent summary; after reservation, a later discard cannot succeed silently (refuse it, or an equivalent contract that closes the race) — both interleavings pinned by tests, reproducing verify2 probe 3
- [x] Ambiguous legacy attempts (no frozen admission input) are blocked pending explicit recovery with a clear error state; their missing input is never invented; no retry can re-resolve a session (reproduces verify2 probe 7)
- [x] A retried request never lands in a different session than its sent receipt records
- [x] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 1 and 3; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.

## Outcome

Shipped in `b9b4f44` (`fix(send): atomic admission reservation, gate ambiguous legacy attempts`). `bun run compile`, `bun run test` (49 files, 658 tests), and `bun run build` pass.

**Shipped**

- Reservation (`lib/storage/writer.ts`, `lib/storage/outbox.ts`): `reserveOutboxItem(id, now)` is one writer-queue read/mark that both confirms the item and holds it; `OutboxItem.reservedAt` persists the reservation (guard-checked). `removeFromOutbox` refuses a reserved item with `OutboxReservedError` ("This feedback is being sent and cannot be discarded"); `setOutboxItemError` clears the reservation when an attempt ends. `hasQueuedOutboxItem` was replaced by the reservation and removed.
- Admission ordering (`lib/send/send.ts`): every async read (frozen input, token, consent) finishes before `reserveOutboxItem`, which is the last serialized transition before `sendFeedback`. A discard during the final consent read now transmits nothing and leaves no sent summary (`The item is no longer in the outbox`); a discard after the reservation is refused instead of racing the in-flight request; the delivery still commits the sent summary.
- Legacy gate (`lib/send/send.ts`): an attempt without `admissionInput` and without an admission receipt throws `LEGACY_ATTEMPT_ERROR` ("Browsertalk did not record the original send details for this feedback — discard it and queue it again") before any resolve, token, or backend work; the stored attempt is left untouched. Items carrying an admission receipt still commit first, so receipt resume keeps working.
- Tests (`lib/send/send.test.ts`, `lib/storage/writer.test.ts`, `lib/panel/messages.test.ts`, `lib/storage/outbox.test.ts`): converted probe 3 into the pre-reservation discard test plus the new post-reservation refusal test; converted probe 7 into a blocked-retry test (request id never reused against another session, nothing sent, nothing logged, attempt unchanged) plus a discard-and-re-queue recovery test; a definite-failure retry after rollover stays on the frozen session with a matching receipt; writer reservation race semantics both ways; panel discard refusal; reservation guard round-trip.

**Divergences / decisions**

- The reservation timestamp comes from the delivery's `now` (`options.now` in tests), so it is deterministic and shares the attempt clock.
- Re-reservation overwrites an existing `reservedAt`: a retry after a worker crash between reservation and commit is the recovery path. No stale-reservation TTL — a TTL would re-open the race for slow sends.
- `reserveOutboxItem` skips the outbox byte-budget check; it is delivery bookkeeping, not user data. Metadata headroom is 010-10's scope.
- Legacy recovery is discard + re-queue only. No automatic path invents the missing input, and a retry stays blocked until the item is replaced.
- Refusal shape: the storage seam throws; the panel's discard handler reports `{ ok: false, error }` with the message above.

**Pending / cannot close locally**

- A worker crash between reservation and commit leaves `reservedAt` set until the next attempt overwrites it; a discard issued before that retry is refused. Real MV3 termination behavior stays unconfirmed.
- Live probes 1, 2, 4, 5, 6 still reproduce 010-10/010-11 issues; re-running `/tmp/opencode/verify2-pre-009.probes.test.ts` now fails exactly probes 3 and 7, which is the corrected behavior.
- No live server or real browser was used; all checks run through `fakeBrowser` and the fake backend.
