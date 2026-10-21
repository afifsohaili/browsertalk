# 016d: Structural seams

**What to build:** Split the two large modules and the mixed picker messages module, with the 016b tests as the safety net.

**Findings:**

- `picker/messages.ts` mixes content senders with the background handler and storage writes.
- `picker/session.ts` (470 lines) and `composer/session.ts` (332) mix state, DOM, and styling.
- `picker/wiring.ts` still patches `withOverlayHidden` / `endSet` after construction (temporal coupling).

**Blocked by:** 016c.

**Status:** ready.

## Checklist

- [ ] Split `lib/picker/messages.ts` into client senders and the background handler (e.g. `messages.ts` + `handler.ts`); update `entrypoints/background.ts` and tests.
- [ ] Extract the picker overlay/pill DOM from `picker/session.ts` into a module; the session keeps state/event wiring.
- [ ] Extract the composer DOM builder from `composer/session.ts`; the session keeps state/queue wiring.
- [ ] Remove the lifecycle-callback patching in `wiring.ts` via explicit handles or a controller; no `let` callbacks assigned after construction.
- [ ] `bun run compile` + `bun run test` pass; one conventional commit.

## Acceptance

- `picker/messages.ts` has one layer.
- `picker/session.ts` and `composer/session.ts` are state/wiring, not DOM builders.
- No post-construction callback patching.
- All 016b tests pass unchanged or with mechanical import updates.

## Outcome

<!-- fill after shipping -->
