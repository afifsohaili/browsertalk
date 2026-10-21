# Element set data shape and prompt

Type: grilling
Status: resolved
Blocked by: none

## Question

How does one feedback carry N elements end to end, and how does the prompt render them? Decide:

- `PickerFeedback`: replace `element: PickerElementFacts` plus `extras?: PickerExtras` with an ordered `elements: { element, extras? }[]`, or keep parallel arrays. Recommendation: the ordered array; N=1 serializes the same facts with no user-visible change.
- `OutboxFacts`: `elements[]`; `isOutboxFacts` accepts the old `element` on read and normalizes, or migrate once. Recommendation: accept both on read, write only the new shape.
- `pending`: one `PickerFeedback` with N elements per tab; `captureID` stays the feedback id. Merge by element order, not capture-completion order; finish awaits all in-flight captures.
- `picker/captured`: settled by the screenshot research — one message per element as picked, so each crop uses the click-time frame. This ticket records the merge rule and the final pending shape.
- Prompt: one compact shape for every N; N=1 uses `Element:`, N>1 uses `Elements (N):` and numbered lines. Confirm the exact wording and whether to keep the `Sent by Browsertalk` footer.
- Attachments: names `element-1.png` …; the byte budget counts all; a screenshot drop strips from the last element first.
- Panel rows: outbox and sent rows show the element count.
- Tests: `assembleFeedback`, protocol guards, prompt snapshots, outbox validation, budget estimates.

## Answer

Resolved 2026-10-21 with Afif. The compact prompt wins for N=1 and N>1.

**Data shape**

- `PickerFeedback` becomes an ordered `elements: { element, extras? }[]`. N=1 is one entry; the single-element path serializes the same facts.
- `OutboxFacts` becomes `elements[]`. `isOutboxFacts` accepts the old `element` on read and normalizes to a one-entry array; writes use only `elements`.
- `pending` holds one feedback with N elements per tab; `captureID` stays the feedback id. Merge by element order, not capture-completion order; finish awaits all in-flight captures.
- `picker/captured` stays one message per element (screenshot research); the background merges.
- `SentItem` gains optional `elementCount`: 0 for page-only, N for element sets. Old records have no count and render none.

**Prompt** (compact for every N)

N=1:

```text
## Browser feedback — <project>

Comment: <text>

Element: <tag>.<classes> — "<text>" · <selector> · <attrs>
  extras    <component/aria/styles, only when present>

Page: <url>
  title     <title>
```

N>1:

```text
## Browser feedback — <project>

Comment: <text>

Elements (<N>):
1. <tag>.<classes> — "<text>" · <selector> · <attrs>
2. <tag>.<classes> — "<text>" · <selector> · <attrs>
   extras    <component/aria/styles, only when present>

Page: <url>
  title     <title>
```

- No box, viewport, or scroll line.
- Attrs go on the element line; omit the segment when empty.
- Component, computed styles, and ARIA go on one indented `extras` line, only when captured.
- No `Sent by Browsertalk · <timestamp>` footer. Remove the now-unused `sentAt` from `RenderPromptInput` and its callers; `SentItem.sentAt` stays for the panel.

**Panel rows**

- Outbox and Sent rows keep the comment as the title; the meta gains `N elements` (e.g. `3 elements · 14:02 · Page title`) when `elementCount` is known. Page-only sends show no count.
- No expansion.

**Attachments**

- `element-1.png` … in element order.
- The byte budget counts every attachment; a storage-quota drop strips screenshots from the last element backward.

**Tests**

- `assembleFeedback` with N entries; `isPickerFeedback` and `isOutboxFacts` accept old and new shapes.
- Prompt snapshots: N=1 compact, N=3 compact, extras present and absent, no footer, page-only.
- `SentItem` count defaults; outbox and sent row meta.
- Budget estimates with N attachments.
