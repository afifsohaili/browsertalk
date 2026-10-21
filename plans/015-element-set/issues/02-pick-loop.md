# Multi-pick loop and edge cases

Type: grilling
Status: resolved
Blocked by: none

## Question

Lock the remaining rules of the Cmd/Ctrl+click loop.

Settled while charting:

- Arm the picker first; hold Cmd on macOS, Ctrl elsewhere.
- Each click adds an element; the set persists while the picker stays armed.
- Release Cmd/Ctrl, press Enter, or pick the fifth element opens the composer.
- Cmd/Ctrl+click on a selected element toggles it off.
- The set is final after the composer opens, except chip × removal.
- Blur and navigation clear the set; Clear and Escape disarm.
- Max 5 elements; max 4 screenshots.

Remaining:

- During an armed set, what does a plain click do: add and finish, finish without adding, or reset to that element?
- At 5/5, does the sixth click get ignored with a notice, replace the oldest, or block the pass?
- Releasing Cmd/Ctrl with an empty set: disarm silently, with no composer.
- A plain click on an element already in the set: finish without duplicating.
- Nested elements: allowed; exact DOM node identity is the dedupe key.
- Blur: clear the set, keep it, or finish the pass?
- What the count bar says; the platform label (⌘ vs Ctrl).
- Clear during picking versus chip × after the composer opens.
- Selected element removed from the DOM before finish: facts are frozen at pick; the chip stays; the screenshot may be absent.
- Accessibility: Enter finishes, Escape cancels, focus returns to the composer.

Give a recommendation for each.

## Answer

Resolved 2026-10-21 with Afif. The loop:

- Arm the picker; hold Cmd on macOS, Ctrl elsewhere.
- Each modifier-click adds an element and keeps the picker armed.
- Modifier-click on a selected element toggles it off.
- Release Cmd/Ctrl, press Enter, or pick the fifth element: the composer opens with the set; the textarea takes focus.
- Blur during the armed pass clears the set and disarms; an open composer is unaffected. Any route change (`popstate`, `hashchange`, patched `pushState`/`replaceState`) clears and disarms; with the composer open, it closes the composer and discards the set.
- Clear in the count bar empties the set and disarms. Escape cancels and disarms.
- After the composer opens, no adding; chip × removes one.

Edge rules:

- A click without the modifier finishes the pass and does not add the clicked element. This is mostly a missed-keyup fallback; the modifier is the add gesture.
- Releasing with an empty set disarms silently; no composer.
- Nested elements are allowed. Exact DOM node identity is the dedupe key.
- An element removed from the DOM keeps its frozen facts and chip; its badge disappears; its screenshot may be absent.
- The fifth click adds the fifth element and opens the composer immediately. There is no sixth click.
- Count bar: `N selected · release ⌘/Ctrl to comment`, a Clear button, and the platform modifier (⌘ on macOS, Ctrl elsewhere).
- Focus moves to the composer textarea when it opens. Enter finishes during picking; Escape cancels.
- Hide the picker overlay around each screenshot capture (from the screenshot research).

No new tickets. Visual copy and layout go to the prototype ticket.
