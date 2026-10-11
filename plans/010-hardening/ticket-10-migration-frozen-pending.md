# 010-10: Migration ownership + frozen-input accounting + pending fallback

**What to build:** Fix verify2 issues 2, 4, and 6 (`/tmp/opencode/verify2-pre-009.md`): migration claims are safe under failure, frozen admission input never renders accepted feedback unsendable, and pending quota recovery cannot overwrite a newer capture.

**Blocked by:** 010-09 — Atomic admission reservation + legacy attempt gating.

**Status:** done · 5da52cf

- [x] Migration persists its owning connection before claiming/removing legacy data; after a rejected removal, the legacy key can never be claimed by another endpoint (reproduce verify2 probe 4)
- [x] Accepted feedback always fits its frozen admission input: budget the delivery-ready representation at queue time (or persist frozen input without duplicating large data), with receipt/error metadata headroom reserved (reproduce probes 1–2)
- [x] Pending screenshot quota recovery is one per-tab mutation and can never overwrite a newer capture (reproduce probe 6)
- [x] The verify2 reproduction probes are converted into repo tests with corrected expectations
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify2-pre-009.md` remaining errors 2, 4, 6; probes at `/tmp/opencode/verify2-pre-009.probes.test.ts`.

## Outcome

Shipped in `5da52cf` (`fix(storage): durable migration ownership, frozen-input accounting, pending fallback safety`). `bun run compile`, `bun run test` (49 files, 666 tests), and `bun run build` pass.

**Shipped**

- Migration ownership (`lib/connection/migrate.ts`, `lib/storage/keys.ts`): a new `migration.owner` record persists `{ backendId, endpoint }` **before** the first claim/removal, and only when legacy data actually exists (legacy token, flat bindings, or the configured backend's session bucket). Every later pass resumes only against that recorded owner — a settings change can never re-target the claim. An unreadable owner record stops migration (no claim) instead of falling back to the configured connection. Probe 4 converted: scoped token plus legacy data, a rejected `remove`, then an endpoint change → the new endpoint claims nothing; the interrupted pass resumes for the original owner and consumes its leftovers there.
- Frozen-input accounting (`lib/storage/budgets.ts`, `lib/storage/writer.ts`): `deliveryReadySize` = stored bytes + the rendered prompt the freeze would duplicate + the attachment duplication + `OUTBOX_METADATA_HEADROOM_BYTES` (4096) per item. `appendToOutbox` checks it, so an item that could never fit its own frozen admission input is rejected at queue time (probe 1: a lone 2,600,000-char comment now rejects with `OutboxFullError` while its raw size stays under 5 MB). `updateOutboxItem` no longer enforces the budget: attempt/admission/error/destination writes are delivery bookkeeping, so post-acceptance metadata can never reject an item (010-09's reservation precedent). An accepted comment at the delivery-ready limit stays sendable end to end (probe 1 conversion).
- Pending fallback (`lib/storage/pending.ts`, `lib/picker/messages.ts`): `setPendingFeedback(tabId, feedback, fallback?)` runs the quota fallback inside the same per-tab mutation; `persistPendingCapture` passes the screenshot-free feedback as that fallback. Probe 6 converted: the fallback completes before a replacement write queued behind it, so a newer same-tab capture is never overwritten (`lib/picker/messages.test.ts`, plus a pending-level ordering pin).
- Budget units (`lib/storage/budgets.test.ts`): double counting of comment and attachment duplication, no double counting for items that already carry their frozen input, and the reserved metadata headroom.

**Divergences / decisions**

- Queue-time rejection (rather than "remain sendable") chosen for over-limit comments: the 5 MB outbox budget now counts the duplicated frozen representation, keeping actual stored bytes truthful. The alternative reverses ticket 06's verbatim frozen-text decision.
- The migration owner record is kept after a completed migration. It is inert once the legacy data is consumed, and it keeps any later-appearing pre-scoping leftovers bound to the original owner.
- Metadata writes can theoretically exceed the 5 MB budget beyond the reserved headroom (e.g. a pathological backend session title); the invariant that matters — a receipt or error can never make an accepted item unsendable — is structural, not estimated.
- `deliveryReadySize` estimates the prompt with a 255-byte placeholder project name and a 24-char ISO `sentAt` (upper bounds for real values); the 4096-byte headroom covers ids, session title, receipt, error, and destination metadata.
- Probe 2 (sent bounds) is left to 010-11 per ticket 11. Re-running `/tmp/opencode/verify2-pre-009.probes.test.ts` now fails exactly probes 1, 3, 4, 6, and 7 (corrected behavior); probes 2 and 5 remain for 010-11.

**Pending / cannot close locally**

- Real Chrome quota shapes and MV3 worker-termination durability of the `migration.owner` record were exercised only through `fakeBrowser` and injected errors; no live server or real browser was used.
