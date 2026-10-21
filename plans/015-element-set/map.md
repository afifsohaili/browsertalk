# Element set — wayfinder map

## Destination

A ready-to-implement `plans/015-element-set/` phase plan for one comment attached to up to five elements on the same page, picked with Cmd/Ctrl+click and sent as one feedback to the active session. The plan locks the data shape, prompt, picker loop, composer, screenshots, tests, and subphase split.

## Notes

- Tracker: local markdown, repo convention. The map is this file; tickets are `issues/NN-*.md`.
- Domain: WXT + Vue 3 + TypeScript Chrome extension. Picker content script, composer overlay, background router, outbox/sent storage.
- Current shape: `lib/picker/facts.ts` has `PickerFeedback.element` singular; `lib/storage/pending.ts` holds one feedback per tab; `lib/picker/messages.ts` captures one screenshot per `picker/captured`; `lib/send/prompt.ts` renders one `Element:` block.
- Locked while charting, each ticket owns its detail: one comment + N elements; N=1 keeps today's flow; same page, same session; hold Cmd (macOS) / Ctrl elsewhere; clicks add; release, Enter, or the fifth click finishes; modifier-click toggles; set final after the composer opens except chip ×; screenshots best effort per element, max 4 (the 2-per-1s quota skips fast picks); blur and route changes clear; Clear disarms.
- Skills every session: `grilling`, `domain-modeling`; `tdd` for the plan's test matrix. Read `CONTEXT.md` and `product.md` first.

## Decisions so far

- [Screenshot capture under rapid multi-pick](issues/04-screenshot-capture.md): capture at pick time on a 2-per-1s budget; skip the shot for faster picks and keep the element. One frame at finish cannot cover other scroll positions.
- [Multi-pick loop and edge cases](issues/02-pick-loop.md): Cmd/Ctrl+click accumulates; release, Enter, or the fifth pick opens the composer; blur and route changes clear and disarm; Clear disarms; chip × is the only post-open change.
- [Element set data shape and prompt](issues/01-data-and-prompt.md): ordered `elements[]` with per-element extras; compact prompt for N=1 and N>1, attrs on the element line, one extras line, no box, no Browsertalk footer; panel rows show the element count.
- [Multi-pick visual affordance](issues/03-visual-affordance.md): variant A wins — numbered badges, bottom-centre count pill, composer card anchored to the last element, chips with ×, transient clear toast. B (right dock) and C (bottom sheet) rejected.
- [Assemble the 015 phase plan](issues/05-phase-plan.md): five subphases (data/prompt, multi-pick composer, capture budget, panel counts, docs/verification); plan at `README.md`.

## Not yet specified

None — the way to the plan is clear.

## Out of scope

- Cross-page pick sets, cross-tab collection, per-element session routing.
- Marquee, area, or text-range selection.
- More than five elements, or more than four screenshots, per feedback.
- Adding elements after the composer opens.
- Page-level feedback sharing an element set; the panel comment box stays page-only.
- Reordering the element set; click order is kept.
- Firefox and Safari builds.
- Changing delivery; `queue` stays the default.
