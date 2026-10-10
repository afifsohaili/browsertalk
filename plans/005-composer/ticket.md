# 005: Composer

**What to build:** After picking an element, a composer opens next to it. The user types the comment; it queues to the outbox. Two lighter paths exist: comment on the page without picking an element, and send just the page URL from the popup.

**Blocked by:** 004b — Picker extras.

**Status:** done · a78df0e

- [x] Composer renders inline next to the selected element; keyboard-first (type, Enter queues, Escape dismisses)
- [x] Queued items persist in extension storage and survive a browser restart
- [x] Page-comment and URL-only paths both produce queued items, with core facts when available
- [x] Minimal visible confirmation that an item is queued (count/badge); full lists land in 007
- [x] No server calls yet — sending is 006; the UI says "queued", not "sent"
- [x] Tests with fake extension APIs; `bun run compile` passes
- [x] One conventional commit; phase doc updated

## Outcome

Shipped:

- Inline composer (`lib/composer/session.ts`, content script): after a pick it renders next to the element — below when it fits, above otherwise, clamped to the viewport — and follows scroll/resize. "Comment on page" opens the same composer in the bottom-right corner. Light DOM host `#browsertalk-composer` with inline styles, matching the picker overlay. Keyboard-first: focus lands in the textarea, Enter queues, Shift+Enter is a newline, Escape dismisses; a window-capture keydown listener keeps page hotkeys out and skips IME composition. A "Queue" button mirrors Enter; the hint reads "Enter queues · Esc dismisses"; success shows "Queued" for ~900 ms then tears down. The UI never says "sent".
- Submit logic is separated from the DOM in `lib/composer/controller.ts` (the use-settings-page pattern): trims the comment, refuses blanks with `Write a comment first`, allows one in-flight submit, surfaces background errors, resets per open. 7 unit tests.
- Queue path: the content script sends `composer/queue` (mode + page facts, guarded in `lib/composer/protocol.ts`); the background reads `pending.feedback`, assembles ONE item (`lib/composer/assemble.ts`), appends to the outbox, clears pending, broadcasts `outbox/changed`, and returns the count. Element items keep the picked page/element/extras (screenshot data URL included) and the pick's `capturedAt`; page/URL-only items carry page facts only with queue-time `capturedAt`. Element-mode submits wait for the capture ack first, so a fast Enter cannot outrun the screenshot capture.
- Outbox storage (`lib/storage/outbox.ts`): items are `{ id, comment, capturedAt, status: 'queued', facts: { page, element?, extras? } }` under the `outbox` key in `storage.local` — survives a browser restart, pinned against `storage.session` in tests. Appends preserve queue order; reads drop malformed entries via `isOutboxItem`, which reuses the picker's page/element/extras guards (now exported from `lib/picker/facts.ts`).
- Comment-on-page path: panel/popup "Comment on page" → background → active tab content script (`composer/open`) → corner composer → page-only item; a missing content script or missing active tab reports clearly.
- URL-only path: popup "Send page URL only" queues url + title from `tabs.query` immediately, no composer, empty comment.
- Confirmation: outbox count in the popup meta line and in the panel's Outbox section, live-refreshed through the `outbox/changed` broadcast (`lib/composer/use-outbox.ts`); popup shows "Queued" after URL-only.
- No server calls anywhere in the phase.
- Tests: +48 (264 total / 27 files vs 216 in 004b): 10 outbox storage, 4 assembly, 9 protocol, 7 controller, 14 messages/background, 4 useOutboxCount.
- Live check (headless Chromium 152 + CDP, built extension, 23/23): arm → hover label → click → composer next to the button (left/top match the rect + 8, textarea focused); typed + Enter → "Queued" → one `storage.local` item with page/element facts, `pending.feedback` cleared; Escape dismisses and queues nothing; page composer in the corner queues page-only facts; popup counts render and refresh via broadcast; URL-only queues an empty-comment page item.

Divergences:

- Escape dismisses the composer but leaves `pending.feedback`; the next pick overwrites it and every composer queue clears it. Re-clearing on dismiss was not required by the ticket.
- URL-only does not clear a stale pending pick (it never reads one); composer queues clear it in both modes, per the ticket's "clear after queueing".
- Dismissal is Escape/queue only — no click-outside close — per the keyboard-first ticket.
- The DOM shell has no headless unit tests (the repo has no DOM test environment); the submit-state logic is tested via the controller and the shell was exercised in the live check.
- No toolbar action badge; the popup and panel counts are the visible confirmation the ticket allows ("count/badge is enough").

Pending (006+):

- 006 consumes `outbox` items: beware `storage.local` quota — a screenshot data URL can be ~1.5 MB per item against the 10 MB default quota.
- The popup's `sent 0` counter and the panel's "Sent" section stay stubs for 007.
- `pending.feedback` stays transient in `storage.session`; the outbox is the durable half.
