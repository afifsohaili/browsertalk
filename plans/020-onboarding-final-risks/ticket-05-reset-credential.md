# 020e: Credential-scoped reset invalidation

**What to build:** After reset removes a connection's token, an in-flight startup or status probe for that same connection cannot clear the badge. A newer check for another connection stays authoritative.

**Blocked by:** 020d.

**Status:** shipped · 051f1bf.

## Acceptance criteria

- [x] Start reset A and hold its first config snapshot. Start a status A probe and hold `/api/info` after its token snapshot. Release the reset and await token removal. Release `/api/info` with `2.0.32`. The badge stays `1`, because A is now unpaired.
- [x] The same ordering for a startup check keeps the badge `1`.
- [x] A newer B check remains authoritative. B Connected still clears the badge.
- [x] Invalidate probes using the removed credential when reset commits, scoped to that connection. Do not globally reject all probes.
- [x] Add both reset-first regressions.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Shipped

- `lib/onboarding/badge.ts` keeps a per-connection generation ceiling. `connection/reset` stamps the cleared connection as soon as `resetConnection` reports the token removal, and `writeBadgeIfCurrent` rejects a check whose generation is at or before that stamp for the same key. Checks for another connection, and checks that begin later, keep their authority.
- Regressions in `lib/connection/messages.test.ts`: reset A held at its first config read, an A status check held at `/api/info` after its token snapshot, then reset release followed by `2.0.32` leaves the badge `1`. The same ordering through a real `onStartup` trigger also leaves it `1`. A held B check across the reset commit still clears the badge.
- Both reset-first regressions failed against the pre-fix tree with `expected '' to be '1'`; the B-authority regression passes with and without the stamp.

## Divergences

- The stamp is a generation ceiling for the connection, not a token comparison. A check that begins during the token removal itself is also rejected, since it cannot be told apart from one that read the removed credential.
- A badge write already in flight when the reset commits still cannot be retracted; the guard blocks later writes, as in 020a.

## Seams under test

- Runtime `connection/reset` and `connection/status` with a held `storage.local.get` and an injected `/api/info`.
- Real `onStartup` trigger with the same held read and response.
- Stored token per endpoint and toolbar badge text.

## Notes

- `lib/connection/messages.ts`, `lib/onboarding/badge.ts`, `lib/connection/messages.test.ts`.
- Do not edit the unrelated WIP files.
