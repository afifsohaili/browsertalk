# 010-07: Byte-accurate budgets + pending/binding serialization

**What to build:** Fix verification issues 4, 5, and 8 (from `/tmp/opencode/verify-pre-009.md`): budgets are byte-accurate and bound retained data, pending-capture mutations are race-free per tab, and binding writes go through the serialized writer.

**Blocked by:** 010-06 — Admission integrity + delivery bounds.

**Status:** done · 18e21b2

- [x] Budgets measure UTF-8 bytes (not string length); sent history is byte-bounded; metadata updates pass budget checks; pending capture writes have screenshot-free quota recovery
- [x] Pending-capture mutations serialized per tab (or captures stored separately) — a cleanup can never delete a newer concurrent capture
- [x] Binding mutations route through the background serialized writer; concurrent bindings for two origins both survive
- [x] Tests: CJK byte case exceeding the old char-based limit, concurrent replacement cleanup, concurrent bindings
- [x] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/verify-pre-009.md` regressions 4, 5, 8.

## Outcome

Shipped in `18e21b2` (`fix(storage): byte-accurate budgets, serialized pending and binding writes`). `bun run compile`, `bun run test` (49 files, 633 tests), and `bun run build` pass.

**Shipped**

- Byte budgets (`lib/storage/budgets.ts`): `outboxSize` measures the UTF-8 bytes of the JSON via new `utf8ByteLength` / `jsonByteSize` helpers (`TextEncoder`), not UTF-16 code units. The 3,500,000 CJK reproduction now exceeds `MAX_OUTBOX_BYTES` (10.5 MB UTF-8 vs 3.5 M chars) and `appendToOutbox` rejects it with `OutboxFullError`.
- Sent history byte cap: `MAX_SENT_BYTES` (1,000,000) trims retained sent summaries in both `commitDeliveredItem` and `appendToSent` via `retainSent`, on top of the existing `SENT_LIMIT` count cap.
- Metadata updates pass budget checks: `updateOutboxItem` (attempt, admission, destination, error) re-checks `outboxSize(next)` and rejects with `OutboxFullError` instead of bypassing the budget, so the frozen admission text can no longer push the outbox past its bound.
- Pending capture safety (`lib/storage/pending.ts`): `setPendingFeedback` and `clearPendingFeedback` serialize on a per-tab promise chain (`enqueuePendingMutation`); the clear's check-then-remove now runs inside the queue, so a cleanup that read an older capture cannot delete a replacement written concurrently.
- Pending quota recovery (`lib/picker/messages.ts`): `persistPendingCapture` retries without the screenshot when `storage.session.set` rejects for quota; when the bare feedback also fails, the error still surfaces.
- Bindings (`lib/storage/projects.ts`): `bindProject` runs on `enqueueStorageWrite`, the same serialized writer queue as outbox/session/sent writes; reads stay direct (`getOriginBindings` / `getBoundProject`). Two concurrent bindings for different origins on one connection both persist.
- Tests: 3.5 M CJK append rejection (with an independent `Buffer.byteLength` assertion), `outboxSize` UTF-8 equality, metadata-update budget rejection, sent-history byte cap on both write paths, gated replacement-during-cleanup (controlled session-storage mock), concurrent two-origin bindings, screenshot-free pending capture recovery and its failure floor.

**Divergences / decisions**

- `retainSent` always keeps the newest summary even if it alone exceeds `MAX_SENT_BYTES`, so an admitted feedback's sent record is never silently dropped; the outbox budget already bounds what can reach delivery, and later writes trim the backlog.
- `MAX_SENT_BYTES` is 1,000,000: outbox (5 MB) + sent (1 MB) leaves ~4 MB headroom under Chrome's 10 MB local quota for sessions/settings.
- Screenshot-free pending-capture recovery is silent; the only drop notice surface (`Queued without the screenshot`) belongs to outbox queueing, which this path does not reach.
- The metadata budget check applies uniformly, including the admission receipt write; if the outbox is exactly at budget, that write rejects and the retry reuses the request id (opencode dedups), with the error telling the user to discard queued feedback.

**Pending**

- Live Chrome quota rejection shapes and MV3 worker lifetime around pending/outbox writes remain unconfirmed; exercised via `fakeBrowser` and injected fakes only.
