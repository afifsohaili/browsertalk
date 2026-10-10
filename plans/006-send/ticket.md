# 006: Send

**What to build:** A queued feedback actually lands in the right opencode session: the session is created or reused through the strategy seam, the prompt renders per the template, delivery is `queue` so a running turn is never interrupted, and the item moves from outbox to sent log.

**Blocked by:** 005 — Composer.

**Status:** done · 0689dd8

- [x] With per-day selected: first feedback of the day creates `Browsertalk · <project> · <date>`; later feedback reuses it (verified once against a live server, manually)
- [x] Prompt renders per `product.md` §Prompt template, extras included when present
- [x] Delivery is `queue`; a send while the agent is mid-turn parks instead of interrupting
- [x] Success moves the item to the sent log (capped); failure keeps it in the outbox with a clear error
- [x] Send path unit-tested against the fake backend
- [x] `bun run compile` passes; one conventional commit; phase doc updated

## Outcome

Shipped:

- Prompt rendering (`lib/send/prompt.ts`): the product.md template, golden-tested char-for-char. Header `## Browser feedback — <project name>` (directory basename); `Comment:` line (empty for URL-only items); Element block with `selector` / `box` / `attrs` plus `component` / `styles` / `aria` lines only when that extra is present (line keys padded to the template's 10-char column); Page block with the full URL and `title`; footer `Sent by Browsertalk · <ISO sentAt>`.
- Screenshot attach (`lib/send/attachments.ts`): a captured crop becomes a `files` entry with the data URL as `uri`, `name: element.png`, a description. Shape checked against the v2 OpenAPI (`PromptInput.FileAttachment`: `uri` required) and verified live — the server decodes a PNG data URL into an inline `image/png` part.
- Send pipeline (`lib/send/send.ts`): `sendQueuedItem(itemId, { now? })` resolves the item's origin → project binding → `resolveActiveSessionStrategy()` → `strategy.resolveSession()` (reuse or create via `persist.ts`) → `renderPrompt` → `backend.sendFeedback({ sessionID, text, delivery: 'queue', files? })`. Sends are serialized through a module promise chain, so two quick feedbacks cannot race a session create; a missing item no-ops. Success removes the item from `outbox`, appends a summary to `sent`, and broadcasts `outbox/changed`. Failure records the message on the item (`setOutboxItemError`) and keeps it queued.
- Trigger (`lib/send/trigger.ts`): `requestSend(itemId)` after each append in `lib/composer/messages.ts` (element, page, and URL-only paths); the default dispatcher is fire-and-forget, the settable dispatcher is the test seam (same pattern as `setOpenCodeFetch`). Older failed items are not auto-retried — that is 007's retry UI.
- Outbox additions: `error?: string` on `OutboxItem` (guard allows it), `removeFromOutbox`, `setOutboxItemError`.
- Sent storage (`lib/storage/sent.ts`): `sent` key, summaries `{ id, comment, sentAt, session: { id, title }, page: { title, url } }`, newest first, capped at `SENT_LIMIT = 50`.
- Real backend (`lib/agent-backend/opencode.ts` + `opencode-api.ts`): `createSession` posts `{ title, location: { directory } }` to `/api/session`; `sendFeedback` posts `{ text, delivery, files? }` to `/api/session/{id}/prompt`; both fail fast with `Not paired` without touching the network. The api module grew a shared `requestJson` (GET/POST), a 404 mapping for prompts (`The session does not exist on the opencode server`), and `SendResult.messageID` from the response `data.id`. `FeedbackSendInput` gained `files?: FeedbackAttachment[]`.
- `broadcastOutboxChanged` moved to `lib/composer/broadcast.ts` (re-exported from `messages.ts`) so `send` can emit it without a cycle.
- Tests: +42 (306 total / 30 files vs 264 in 005): 7 prompt golden, 9 send pipeline (create + reuse + queue delivery, screenshot attach, sent cap, failing backend, unbound origin, unreadable URL, not paired, missing item), 7 sent storage, 5 outbox mutations + guard, 10 opencode-api, 4 opencode backend, plus composer trigger assertions and the dispatcher seam.
- Live check (one manual end-to-end, both sends to `http://127.0.0.1:49374`, scratch directory `/tmp/browsertalk-send-smoke` only): first feedback created `Browsertalk · browsertalk-send-smoke · 2026-10-10`; the second send reused the same `ses_…` id; the session held both prompt texts and the inline `image/png` file; the session was deleted after (204). The second send was issued while the first turn was running and was admitted without conflict.

Divergences:

- The live check ran against the app-owned service on port 49374, not the default 15001: 15001's shared password lives in a policy-blocked env file in this session. Both are opencode 2.0.24; the wire shapes are the same. 15001 was reached unauthenticated (401), confirming it serves.
- `OutboxItem.error` and the `sent` summary shape extend product.md's storage table (which names the keys only); `SENT_LIMIT = 50` is a chosen number — product.md says "capped" without one.
- Prompt edge cases the template does not cover, chosen and pinned in tests: empty comment renders `Comment:` alone; an absent page title omits the `title` line; page-only items have no Element block; extras line format is `component <name>`, `styles    <prop>: <value> · …`, `aria      role=<role> · name=<name>` (only present halves).
- `Comment:` uses the raw comment; multi-line comments stay multi-line.
- Sends attempt only the newly queued item; failures are recorded, not retried (007).
- Queue parking is the server's `delivery: "queue"` semantics: asserted on the wire in tests and exercised live with a back-to-back send into a running turn, but no test observes the mid-turn park state directly.

Pending (007):

- Retry / discard per outbox item (the `error` field is ready for the UI), "+ new session" rollover, sent list view, popup `sent` counter wiring to `countSent()`.
- Stale stored sessions (deleted server-side) are still not pruned; a send to one fails with `The session does not exist on the opencode server` and stays in the outbox.
