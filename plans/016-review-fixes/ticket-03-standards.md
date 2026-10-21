# 016c: Standards cleanup

**What to build:** Resolve the 015 Standards findings that are code/documentation consistency, not behavior.

**Findings:**

- `CONTEXT.md` bans Selection as the unit while the code exports `createPickSelection` and `lib/picker/selection.ts`.
- Four unrequested JSDoc blocks (`capture-budget`, `overlay-visibility`, `pending`, `limits`).
- Two near-identical per-tab tail queues in `pending.ts` with different failure semantics.
- `formatCountLabel` and `elementCountLabel` duplicate the `N element(s)` rule.
- `removeChip` has no production caller.
- `platform.ts` mixes OS detection and pill copy.
- `picker/messages.ts` mixes content senders with the background handler and storage writes.
- `picker/session.ts` and `composer/session.ts` mix state, DOM, and styling; `picker.content.ts` patches lifecycle callbacks after construction.

**Blocked by:** 016b.

**Status:** ready.

## Checklist

- [ ] Rename `selection.ts` / `createPickSelection` / `PickSelection` to `pick-state.ts` / `createPickState` / `PickState`; update imports, tests, and `CONTEXT.md` code names. Keep `pickAction`.
- [ ] Remove the four unrequested JSDoc blocks; keep behavior names and types self-explanatory.
- [ ] Extract one per-tab queue helper with an explicit `continueOnError` policy; use it for capture and pending mutations. Tests for both policies.
- [ ] One shared `formatElementCount` helper for the composer count line and panel meta; remove the duplicate. Tests.
- [ ] Delete `removeChip` and its tests; the composer removes entries directly.
- [ ] Split `platform.ts`: OS/modifier detection vs pill copy; move the count copy to the shared count helper.
- [ ] Split `picker/messages.ts` into client senders and the background handler (e.g. `messages.ts` + `handler.ts`); update `entrypoints/background.ts` and tests.
- [ ] Extract the picker overlay/pill DOM and the composer DOM builder into separate modules; `session.ts` keeps state/event wiring. The 016b tests must stay green.
- [ ] Remove the lifecycle-callback patching in `picker.content.ts` via the 016b wiring module.
- [ ] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- `CONTEXT.md` and code names agree on Element set / Pick state.
- No dead production code or duplicate count/queue helpers.
- `picker/messages.ts` has one layer; `session.ts` files are state/wiring, not DOM builders.
- All 016b tests pass unchanged or with mechanical import updates.

## Outcome

<!-- fill after shipping -->
