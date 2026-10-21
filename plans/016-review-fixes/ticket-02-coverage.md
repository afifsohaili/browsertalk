# 016b: DOM and wiring coverage

**What to build:** Cover the DOM glue the 015 review found smoke-only, and make the content-script wiring testable.

**Findings:**

- `lib/picker/session.ts` and `lib/composer/session.ts` have no test files.
- `entrypoints/picker.content.ts` is untested; the `endSet`/`notifyCleared` split hid the pending leak.
- `route.test.ts` uses a same-world fake history and masked the real `pushState` gap.

**Blocked by:** 016a.

**Status:** ready.

## Checklist

- [ ] Add `happy-dom` as a dev dependency; use `// @vitest-environment happy-dom` for DOM test files, or the vitest environment config. Do not change the existing node tests.
- [ ] `lib/picker/session.test.ts`: arm, modifier add/toggle, plain click, release/Enter/fifth finish, badges and count pill, Clear, Escape, blur, route event, overlay hide/restore.
- [ ] `lib/composer/session.test.ts`: `openSet` with 1 and 3, chips, × removal, empty state, Queue disabled, focus, close, queue count.
- [ ] Extract `createPickerWiring` (or equivalent) from `entrypoints/picker.content.ts`; test composer close clears the submission and the background pending, and arm/finish wiring.
- [ ] `lib/picker/route` tests: main-world emitter + isolated listener; remove the fake-history masking.
- [ ] Add: `SentItem.elementCount` N>1, multi-drop quota, chip removal racing an in-flight capture.
- [ ] `bun run compile` + `bun run test` pass; `bun run build` once; one conventional commit.

## Acceptance

- DOM sessions have direct tests for every ticket acceptance behavior, not only a live smoke.
- The content wiring has a unit test for the close/clear path.
- The route test exercises the real bridge shape, not a same-world fake.
- Existing 902 tests stay green.

## Outcome

<!-- fill after shipping -->
