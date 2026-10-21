# 015e: Panel element counts

**What to build:** Outbox and Sent rows say how many elements a feedback carries. Page-only sends show no count; old sent records without `elementCount` show none.

**Owner decisions (2026-10-21):** [Element set data shape and prompt](issues/01-data-and-prompt.md). `3 elements · 14:02 · Page title`; no expansion.

**Blocked by:** 015a.

**Status:** done.

## Checklist

- [x] `lib/panel/use-panel.ts`: `elementCountLabel(count)` → `''` or `N elements`; tests.
- [x] `entrypoints/sidepanel/App.vue`: outbox meta uses `item.facts.elements?.length`; sent meta uses `entry.elementCount`; join with the existing meta.
- [x] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- A 3-element outbox row reads `3 elements · <time> · <title>`.
- A page-only outbox/sent row has no count.
- An old sent record without `elementCount` has no count.

## Outcome

Shipped 2026-10-21. Outbox and Sent meta lead with `N elements`; page-only and old sent records show no count. Rows, titles, and styles unchanged.

**Shipped**

- `lib/panel/use-panel.ts`: `elementCountLabel(count)` → `''` below 1 or absent, `1 element`, `N elements`; `outboxMeta(item, now?)` reads `item.facts.elements?.length`; `sentMeta(entry, now?)` reads `entry.elementCount`; both join `[count, timestamp, title]` with ` · `.
- `entrypoints/sidepanel/App.vue`: both `.item-meta` spans call the helpers; `formatTimestamp` import dropped.
- Titles stay the comment; the sent title stays the session title, the outbox title the page title or URL.

**Tests**

- `lib/panel/use-panel.test.ts`: `elementCountLabel` for 0, 1, 3, 5, undefined (5). `panel row meta` (6): 3-element outbox → `3 elements · 09:05 · Cart`; 3-element sent → `3 elements · 09:05 · Browsertalk · example`; page-only outbox; page-only sent (`0`); old sent record (absent); empty page title falls back to URL.
- `bun run compile` clean. `bun run test`: 58 files, 902 passed. `bun run build`: chrome-mv3, 208.86 kB.

**Divergences**

- Meta assembly lives in `outboxMeta` / `sentMeta`, not inline template expressions. No `@vue/test-utils` in the repo, so the row string is only testable at a pure seam; the template now calls one helper per row.
- `1 element` singular, matching the prototype count pill. The ticket says `N elements` only; the ticket's own edge list asks for count 1, so it needed a decision.

**Next phase must know**

- `sha recorded by 015f`.

