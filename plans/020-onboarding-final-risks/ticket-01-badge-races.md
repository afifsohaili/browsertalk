# 020a: Badge races

**What to build:** Startup and reset badge writes obey the same generation and connection guard as status probes. A stale startup probe or an obsolete reset cannot repaint the badge for a newer connection.

**Blocked by:** 019.

**Status:** shipped · d93dca5.

## Shipped

- The badge check generation and configured-connection guard now live in `lib/onboarding/badge.ts`. `connection/status` and startup `syncSetupBadge` claim a generation, capture the configured `backendId`/`serverUrl`, and paint only while both still hold.
- Pair and reset claim a new generation before their badge write, so an in-flight startup check cannot repaint afterwards.
- `connection/reset` captures the connection before clearing the token and writes the badge only when that connection is still configured. An obsolete reset for A cannot repaint while B is connected; B's token stays intact.
- Regressions: held startup A + newer connected B + stale startup transport error leaves the badge clear; held startup + settings switch without a newer probe also stays clear; held startup + pair leaves it clear; held startup + reset leaves it set; reset A held at the token write + connected B leaves the badge clear and `tok_b` intact.

## Divergences

- The generation moved from `messages.ts` module scope to `badge.ts` so startup and messaging share one counter. `nextStatusGeneration`, `configuredConnectionKey`, and `writeBadgeIfCurrent` are exported from `badge.ts`.
- Reset claims a generation only when the configured connection is still the one it reset. When the connection moved, newer checks stay authoritative.
- A badge write already in flight when a newer check starts still cannot be retracted; the guard blocks later writes.

## Seams under test

- Background messaging with injected HTTP and a real `onStartup` trigger: stale startup probe against a newer status, a successful pair, and a reset.
- Background messaging with a held `storage.local.set` for `auth.tokens`: obsolete reset A against connected B.

## Acceptance criteria

- [x] F3a: `syncSetupBadge` on startup participates in the status generation and connection guard. A held startup `/api/info` for endpoint A, followed by a newer Connected check for B and then a startup transport error, leaves the badge cleared.
- [x] F3a: pair and reset invalidate an in-flight startup check. Add startup → pair and startup → reset regressions.
- [x] F3b: `connection/reset` binds its badge write to the connection actually reset. An obsolete reset for A that completes after B is Connected leaves the badge cleared and B's token intact.
- [x] Add the reset interleaving regression.
- [x] Do not edit `entrypoints/background.ts` or `lib/background.test.ts`; they contain unrelated WIP.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- F3a: `lib/onboarding/install.ts`, `lib/onboarding/badge.ts`, `lib/connection/messages.ts`.
- F3b: `lib/connection/messages.ts`.
