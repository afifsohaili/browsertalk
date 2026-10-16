# 013: Panel comment box — one place to comment on the page

**What to build:** The side panel gets one comment box (textarea + Send). Submitting sends a page-mode feedback for the active tab: the comment plus page URL/title; an empty box sends the URL only. It replaces both "Comment on page" (button retired; the in-page page-mode overlay goes with it) and "Send page URL only" (folded in). The in-page overlay stays for element comments ("Point at element").

Owner decisions (2026-10-16 question round): retire "Comment on page" and its in-page page mode; fold "Send page URL only" into the box (empty comment = URL-only send). Details: Enter sends, Shift+Enter newline; the button label flips to "Send URL only" when the box is empty; a send clears the active tab's stale pick, matching the retired page-comment spec.

**Blocked by:** none.

**Status:** done (sha recorded by the follow-up docs commit)

## Checklist

- [x] `composer/protocol.ts`: `composer/queue` drops `mode` (element-only, `captureID` required); `outbox/url-only` → `outbox/page-comment { comment }` (empty allowed); `composer/open` + `ComposerMode` + `ComposerOpenResult` removed; guards and tests updated
- [x] `composer/messages.ts`: one `queueActivePage(comment)` behind `outbox/page-comment` (active tab url/title, destination capture, queue + `requestSend`, clears the active tab's pending pick); element queue untouched otherwise; open helpers (`openComposerOnActiveTab` / `openComposerOnTab` / `requestOpenComposer`) removed; `requestPageComment(comment)` added; tests converted (no assertion dropped without replacement)
- [x] `composer/session.ts` + `entrypoints/picker.content.ts`: overlay opens for elements only; `composer/open` listener removed
- [x] `components/CommentBox.vue` (new): textarea, Enter/Shift+Enter, busy state, "Queued"/error, clears on success; delete `CommentOnPageButton.vue` + `SendUrlOnlyButton.vue`; `App.vue` renders the box
- [x] Docs: `product.md`, `README.md`, `CHROMEWEBSTORE.md` (grep for the retired button names), `CONTEXT.md` (Comment box term)
- [x] `bun run compile` + `bun run test` + `bun run build` pass; CDP smoke against the live server (comment send + empty URL-only send admitted); one conventional commit

## Outcome

Shipped in the phase commit (`feat(panel): comment box; retire the page-comment paths`; sha recorded by the follow-up docs commit). `bun run compile` exit 0; `bun run test` 49 files / 728 tests; `bun run build` exit 0. CDP smoke against the live server: all steps green, server admissions verified.

**Shipped**

- `composer/protocol.ts`: `composer/queue` is element-only (no `mode`; `captureID` required); `outbox/page-comment { comment }` (empty allowed) replaces `outbox/url-only`; `composer/open`, `ComposerMode`, and `ComposerOpenResult` are gone.
- `composer/messages.ts`: one `queueActivePage(comment)` behind `outbox/page-comment` — reads the active tab (url/title), freezes the destination, queues, triggers the send, and clears the active tab's stale pick; the element queue is otherwise untouched; `requestPageComment(comment)` client fn; the open helpers removed.
- `composer/session.ts` + `entrypoints/picker.content.ts`: the overlay is element-only (`openPage` and the `composer/open` listener removed).
- `components/CommentBox.vue`: textarea + footer (hint, error, "Queued", busy); Enter sends with IME and Shift+Enter guards; the button label flips "Send URL only" ↔ "Send"; clears on success. `CommentOnPageButton.vue` and `SendUrlOnlyButton.vue` deleted; `App.vue` renders the box above "Point at element".
- Docs: `product.md` (surfaces, overlay row, workflow paragraph), `README.md`, `CHROMEWEBSTORE.md` (sidePanel row), `CONTEXT.md` (Comment box term).

**Live check** (throwaway script `~/.cache/opencode-tmp/browsertalk-013-smoke/smoke13.mjs`, not committed)

- Panel renders the comment box; "Comment on page" and "Send page URL only" are gone; the label flips from "Send URL only" to "Send" after typing.
- Comment send through the adopted session: textarea cleared, "Queued", sent entry with the session title; empty send queued a second entry.
- Server: the comment feedback appears in the session context (`Comment: Layout jumps at 1280px`); the URL-only feedback is durably parked in the session inbox with `delivery: "queue"` — the script's context-only assertion could not see the parked one, so this was re-verified by direct `GET /api/session/{id}/context` + `/inbox` after the run. Throwaway session deleted (204).

**Divergences / decisions**

- The folded send clears the active tab's stale pick: the retired page-comment path did this, the old URL-only path did not. The merged spec keeps the stronger hygiene (tested).
- The element queue request still carries `page` although the handler builds from the pending pick — left untouched to keep the element path unchanged.
- Five specs were retired with the open-composer surface; every other existing assertion was converted, not dropped.

**Next-phase must-know**

- `composer/queue` no longer has a mode; page-level sends go through `outbox/page-comment` only.
- A queued feedback can sit in the session inbox until the running turn goes idle; a context-only server assertion will miss it.
