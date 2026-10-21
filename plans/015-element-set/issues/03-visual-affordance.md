# Multi-pick visual affordance

Type: prototype
Status: resolved
Blocked by: 02

## Question

What do selected elements look like while picking, and how do the count bar and composer chips communicate the set? Build a cheap static HTML prototype, no extension wiring:

- Hover highlight versus selected outline; numbered badges 1..5.
- Cap state: picking the fifth element opens the composer immediately; there is no sixth click and no 5/5 armed state.
- A fixed count bar: "3 selected · release ⌘ to comment", with Clear (disarms).
- The composer with a textarea, element chips (label + ×), overflow for five, and empty state.
- Light and dark page backgrounds; the composer uses light-dark panel colors today.
- Optional: a transient notice for a blur or route-change clear.

Link the artifact from this ticket. React to it before the plan locks the composer layout.

## Prototype

Open [prototype.html](../prototype.html) directly — the single file runs standalone. For `?variant=` URLs, run `python3 -m http.server 5188 --directory plans/015-element-set` and use `http://127.0.0.1:5188/prototype.html?variant=A`.

Variants: A anchored card · B right dock · C bottom sheet. The PROTOTYPE panel switches variants and collapses via `controls`; the URL param is optional.

Try: Arm picker → hold ⌘/Ctrl → click three cards → release. Then flip variants, remove a chip, and pick five in one pass.

## Answer

**Variant A — anchored card** wins. B (right dock) and C (bottom sheet) are rejected.

Keep from A:

- Numbered indigo badges and persistent outlines while picking.
- Fixed bottom-centre count pill: `N selected · release ⌘/Ctrl to comment`, with Clear.
- The count pill is its own fixed element, not a header inside the composer.
- Composer card anchored to the last picked element and clamped to the viewport, with chips (label + ×), textarea, hint, and Queue.
- The transient toast for blur and route clears; the set is already discarded.

The prototype stays at `../prototype.html`; A is the default variant.
