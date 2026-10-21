# 015d: Panel element counts

**What to build:** Outbox and Sent rows say how many elements a feedback carries. Page-only sends show no count; old sent records without `elementCount` show none.

**Owner decisions (2026-10-21):** [Element set data shape and prompt](issues/01-data-and-prompt.md). `3 elements · 14:02 · Page title`; no expansion.

**Blocked by:** 015a.

**Status:** ready.

## Checklist

- [ ] `lib/panel/use-panel.ts`: `elementCountLabel(count)` → `''` or `N elements`; tests.
- [ ] `entrypoints/sidepanel/App.vue`: outbox meta uses `item.facts.elements?.length`; sent meta uses `entry.elementCount`; join with the existing meta.
- [ ] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- A 3-element outbox row reads `3 elements · <time> · <title>`.
- A page-only outbox/sent row has no count.
- An old sent record without `elementCount` has no count.

## Outcome

<!-- fill after shipping -->
