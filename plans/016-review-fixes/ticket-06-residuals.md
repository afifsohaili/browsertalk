# 016f: Final review residuals

**What to build:** Close the remaining hard Standards finding and the cheap residuals from the final 016 re-review. No feature changes beyond error surfacing.

**Findings:**

- **Hard:** `lib/picker/wiring.ts` discards removal and clear failures (`void submission.remove(index)`, `void deps.notifyCleared(setID)`). Global contract: never silently suppress errors. A failed badge removal leaves pending ahead of the composer count; a failed clear leaves storage behind.
- `CONTEXT.md` Pick state says "while armed; finish turns it into the composer's element set", but finish leaves picks alive and opens the composer.
- `PickClick.limit` has no caller.
- The clear sequence is duplicated three times in `picker/session.ts`; `session.ts` re-finds a pick instead of using `PickState.indexOf`.
- `sendSafely` / `BACKGROUND_UNAVAILABLE` are duplicated in `composer/messages.ts` and `picker/messages.ts`.
- The route bridge test runs in one realm; no test asserts the entrypoint is `world: 'MAIN'` / `document_start`.
- `product.md` still says the 015 live run attached 2 shots without the 016e 4-shot result; no reproducible 016 smoke procedure.
- Accepted/deferred: page can dispatch the route event (nuisance); `App.vue` row rendering (pure helpers are the seam); `continueOnError: false` test-only; `PickerWiring` test handles.

**Blocked by:** 016e.

**Status:** done.

## Checklist

- [x] `wiring.ts`: surface `submission.remove` failures (warn/toast; do not drop silently) and `notifyCleared` failures (catch/warn). Composer removal keeps the chip on failure or shows the error. Tests.
- [x] `CONTEXT.md`: Pick state definition spans arm → finish → composer; cleared on send/cancel.
- [x] Remove `PickClick.limit` if unused; update tests.
- [x] Extract the shared clear sequence in `picker/session.ts`; use `PickState.indexOf` instead of re-finding.
- [x] One shared `sendSafely` + `BACKGROUND_UNAVAILABLE` for composer and picker messages; tests.
- [x] Test `entrypoints/picker-route.content.ts` options: `world: 'MAIN'`, `runAt: 'document_start'`.
- [x] Docs: update the 4-shot live result; add `plans/016-review-fixes/smoke.md` with the reproducible CDP procedure; note the page-dispatchable route event as accepted nuisance.
- [x] `bun run compile` + `bun run test` + `bun run build`; one conventional commit.

## Acceptance

- Removal/clear failures are observable; no `void` promise with a result.
- Names and docs match behavior; no dead `PickClick.limit`.
- The MAIN-world entrypoint shape is asserted.
- All tests pass; docs state what the live smoke did and did not exercise.

## Outcome

**Shipped.**

Code:

- `lib/picker/wiring.ts`: `onRemove` and `onClear` consume their promises. A failed removal warns `Browsertalk: couldn't remove the element — <reason>`; a failed or rejected clear warns `Browsertalk: couldn't clear the pending set — <reason>`. No `void` on a promise that carries a result. The `notifyCleared` dep is now typed `Promise<CaptureResult>`, so `ok: false` is checked, not only rejections.
- Composer chip removal needed no change: `composer/session.ts` already awaited the result, kept the chip, and showed `errorLine`. The wiring test now covers that path end to end.
- `lib/runtime-message.ts`: one `sendSafely` + `BACKGROUND_UNAVAILABLE`. `composer/messages.ts` and `picker/messages.ts` import it; both local copies are gone.
- `lib/picker/pick-state.ts`: `PickClick.limit` and the local `limit` fallback removed; `pickAction` reads `MAX_PICKED_ELEMENTS`.
- `lib/picker/session.ts`: one `clearSet()` shared by `disarm`, `end`, and the route change (nulls the set id, clears picks, stops picking and the route watch, returns the cleared id). Line count 262 → 258.
- `CONTEXT.md`: Pick state spans arm → finish → composer; cleared on send, dismiss, route change, or composer close.
- `product.md`: the 4-shot live result (five picks 1.5 s apart → 4 shots; the 015 burst → 2) and the page-dispatchable route event as an accepted nuisance.
- `plans/016-review-fixes/smoke.md`: the reproducible CDP procedure (`Extensions.loadUnpacked`, no `--load-extension`), the six cases with the 016e results, what was not exercised, and the nuisance note.

Tests (new):

- `lib/picker/wiring.test.ts`: picker modifier removal warns on `ok: false` and on a rejection; a composer chip removal failure keeps both chips and shows the error; clear failures warn on `ok: false` and on a rejection.
- `lib/runtime-message.test.ts`: pass-through, `null` when the background is gone, one shared message constant.
- `lib/picker/route-entry.test.ts`: `picker-route.content.ts` is `world: 'MAIN'`, `runAt: 'document_start'`, `matches: ['<all_urls>']`.

Checks:

- `bun run compile` exit 0.
- `bun run test`: 67 files, 972 tests passed.
- `bun run build` exit 0, chrome-mv3 210.68 kB, `content-scripts/picker-route.js` 888 B.

Divergences:

- `PickState.indexOf` stays unused by `session.ts`. The session looks a pick up by DOM element; `indexOf` compares tracked `PickerPick` identity, so it cannot express that lookup without reshaping the state. The duplicated clear sequence was extracted instead.
- 016f did not re-run the live smoke; `smoke.md` records the 016e run and the procedure to repeat it. The quota multi-drop loop remains unit-tested only.
- The composer removal path was already correct; only its test is new.

**Sha:** this commit (`fix(picker): surface removal and clear errors`).
