# 005: Composer

**What to build:** After picking an element, a composer opens next to it. The user types the comment; it queues to the outbox. Two lighter paths exist: comment on the page without picking an element, and send just the page URL from the popup.

**Blocked by:** 004b — Picker extras.

**Status:** ready-for-agent

- [ ] Composer renders inline next to the selected element; keyboard-first (type, Enter queues, Escape dismisses)
- [ ] Queued items persist in extension storage and survive a browser restart
- [ ] Page-comment and URL-only paths both produce queued items, with core facts when available
- [ ] Minimal visible confirmation that an item is queued (count/badge); full lists land in 007
- [ ] No server calls yet — sending is 006; the UI says "queued", not "sent"
- [ ] Tests with fake extension APIs; `bun run compile` passes
- [ ] One conventional commit; phase doc updated
