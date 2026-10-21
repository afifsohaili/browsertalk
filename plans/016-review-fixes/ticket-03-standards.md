# 016c: Standards cleanup (mechanical)

**What to build:** Resolve the 015 Standards findings that are naming, comments, and duplicated helpers. No behavior change.

**Findings:**

- `CONTEXT.md` bans Selection as the unit while the code exports `createPickSelection` and `lib/picker/selection.ts`.
- Four unrequested JSDoc blocks (`capture-budget`, `overlay-visibility`, `pending`, `limits`).
- Two near-identical per-tab tail queues in `pending.ts` with different failure semantics.
- `formatCountLabel` and `elementCountLabel` duplicate the `N element(s)` rule.
- `removeChip` has no production caller.
- `platform.ts` mixes OS detection and pill copy.

**Blocked by:** 016b.

**Status:** done.

## Checklist

- [x] Rename `selection.ts` / `createPickSelection` / `PickSelection` to `pick-state.ts` / `createPickState` / `PickState`; update imports, tests, and `CONTEXT.md` code names. Keep `pickAction`.
- [x] Remove the four unrequested JSDoc blocks; keep behavior names and types self-explanatory.
- [x] Extract one per-tab queue helper with an explicit `continueOnError` policy; use it for capture and pending mutations. Tests for both policies.
- [x] One shared `formatElementCount` helper for the composer count line and panel meta; remove the duplicate. Tests.
- [x] Delete `removeChip` and its tests; the composer removes entries directly.
- [x] Split `platform.ts`: OS/modifier detection vs pill copy; move the count copy to the shared count helper.
- [x] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- `CONTEXT.md` and code names agree on Element set / Pick state.
- No dead production code or duplicate count/queue helpers.
- Behavior unchanged; all 961 tests stay green or move with mechanical import updates.

## Outcome

Shipped:

- `lib/picker/selection.ts` → `lib/picker/pick-state.ts`; `createPickSelection` / `PickSelection` → `createPickState` / `PickState`; `pickAction` unchanged. The picker session's local is now `picks` and `clearSelection` is `clearPicks`. `CONTEXT.md` code name updated and a Pick state core term added.
- Four JSDoc blocks removed (`capture-budget`, `overlay-visibility`, `pending`, `limits`).
- `lib/per-tab-queue.ts`: `createPerTabQueue({ continueOnError })` with `enqueue` and `settled`. Used for captures and pending mutations; removals and clears still wait on the capture tail via `settled`.
- `lib/element-count.ts`: `formatElementCount` (empty for undefined/0) shared by the composer count line and panel meta. `formatCountLabel` and `elementCountLabel` deleted.
- `removeChip` and its tests deleted.
- `lib/picker/platform.ts` keeps `modifierLabel`; pill copy moved to `lib/picker/pill-copy.ts` (`formatPickCount`).

Tests: `bun run compile` pass; `bun run test` 65 files / 962 tests pass; `bun run build` pass (chrome-mv3). New: `per-tab-queue` 7 (both policies, tab isolation, settle), `element-count` 4; `pill-copy` holds the moved pill test.

Divergences:

- Both queues pass `continueOnError: true`: that is what both old queues did in effect, because each stored a sanitised tail. The `false` policy is implemented and tested, but no production queue uses it; using it for mutations would skip writes queued behind a quota error.
- The commit also carries the 016a/016b plan-status edits and the 016d/016e ticket split that were already uncommitted in the worktree. No 016a/016b code is re-committed.

**Sha:** `5be28b0`.
