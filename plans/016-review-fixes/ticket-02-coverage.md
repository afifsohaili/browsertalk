# 016b: DOM and wiring coverage

**What to build:** Cover the DOM glue the 015 review found smoke-only, and make the content-script wiring testable.

**Findings:**

- `lib/picker/session.ts` and `lib/composer/session.ts` have no test files.
- `entrypoints/picker.content.ts` is untested; the `endSet`/`notifyCleared` split hid the pending leak.
- `route.test.ts` uses a same-world fake history and masked the real `pushState` gap.

**Blocked by:** 016a.

**Status:** done.

## Checklist

- [x] Add `happy-dom` as a dev dependency; use `// @vitest-environment happy-dom` for DOM test files, or the vitest environment config. Do not change the existing node tests.
- [x] `lib/picker/session.test.ts`: arm, modifier add/toggle, plain click, release/Enter/fifth finish, badges and count pill, Clear, Escape, blur, route event, overlay hide/restore.
- [x] `lib/composer/session.test.ts`: `openSet` with 1 and 3, chips, × removal, empty state, Queue disabled, focus, close, queue count.
- [x] Extract `createPickerWiring` (or equivalent) from `entrypoints/picker.content.ts`; test composer close clears the submission and the background pending, and arm/finish wiring.
- [x] `lib/picker/route` tests: main-world emitter + isolated listener; remove the fake-history masking.
- [x] Add: `SentItem.elementCount` N>1, multi-drop quota, chip removal racing an in-flight capture.
- [x] `bun run compile` + `bun run test` pass; `bun run build` once; one conventional commit.

## Acceptance

- DOM sessions have direct tests for every ticket acceptance behavior, not only a live smoke.
- The content wiring has a unit test for the close/clear path.
- The route test exercises the real bridge shape, not a same-world fake.
- Existing 902 tests stay green.

## Outcome

**Shipped.** The DOM sessions, the content wiring, and the route bridge now have direct tests. No feature behavior changed.

- `lib/picker/session.ts` tests (`session.test.ts`, 24): arm/overlay/cursor, modifier add with numbered badges and count pill, toggle off, plain click with and without a set, modifier release, Enter, fifth pick finishing, sixth ignored, Clear, Escape, blur, `popstate` and `browsertalk:picker-route`, route watcher alive after finish, badge geometry from a stubbed `getBoundingClientRect`, hover label, zero-size element, overlay hide/restore with overlapping holds and a throwing capture, `⌘`/`Ctrl` label.
- `lib/composer/session.test.ts` (new, 16): `openSet` with 1 and 3, chips and their `aria-label`s, empty state, Queue disabled for an empty set and while busy, focus on the textarea and after a removal, Escape and `isComposing`, queue count from the actual entry count, screenshot-dropped notice, × removal and the last-chip empty state, refused removal keeps the chip, double click on ×.
- `lib/picker/wiring.ts` (new): `createPickerWiring(deps)` owns the submission, composer, and picker and returns `{ session, composer, submission, arm }`. `entrypoints/picker.content.ts` is now only the message listener plus the dependency wiring.
- `lib/picker/wiring.test.ts` (new, 9): arm toggles, arm closes a stale composer and clears its set, overlay hidden during the capture message, finish opens chips in pick order and tracks each index, queue carries page and count, chip removal through the background request, composer close clears the submission and names the set on `notifyCleared`, route change and Escape close the composer.
- `lib/picker/route-bridge.test.ts` (new, 4): the main-world emitter and the isolated watcher over the real `window.history`, for `pushState`, `replaceState`, joint stop, and back/forward.
- `lib/composer/multi-pick.test.ts` (+1): a chip removal issued during an in-flight capture waits for it and reports the remaining count of 1.

**Tests.** 961 pass across 62 files (from 910/59). `bun run compile` clean. `bun run build` clean once: chrome-mv3, 209.77 kB, `content-scripts/picker.js` 27.04 kB.

**Divergences.**

- The route bridge case sits in `route-bridge.test.ts` with `// @vitest-environment happy-dom`, not in `route.test.ts`, so the node emitter/listener tests keep their node environment.
- `SentItem.elementCount` for N>1 was already asserted (`send.test.ts`, `elementCount: 3`), and the multi-drop quota loop was already covered by 016a in `composer/messages.test.ts`. Neither needed a new test.
- "Composer close clears the submission" is asserted through `wiring.submission.submit` returning `NO_PICKED_ELEMENT_ERROR` after the close. Re-arming also clears, so a re-arm probe cannot isolate the close path. Confirmed red with `submission.clear()` removed and green with it restored.
- `createPickerWiring` returns `submission` and `composer` alongside `session`. The entrypoint uses only `session` and `arm`; the other two are the composition root's handles for tests.

**Sha:** recorded by 016e.

