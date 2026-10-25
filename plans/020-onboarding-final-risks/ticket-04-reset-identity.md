# 020d: Reset identity

**What to build:** A reset binds to one connection identity. A delayed config read cannot clear another connection's token or repaint its badge.

**Blocked by:** 020c.

**Status:** shipped · 5551675.

## Acceptance criteria

- [x] F3b-1: hold the first identity read while A is configured. Switch to B, complete a Connected status, release the read. Reset clears A's token only; B's token stays intact; the badge stays cleared.
- [x] F3b-2: reset A, hold the final identity read after it snapshots A. Switch to B and complete a Connected status, then release. The badge stays cleared; B's token stays intact.
- [x] Reset resolves the connection identity once and uses it for token removal and badge checks. No second `getSettings()` read after the async token clear can change the target.
- [x] Add both delayed-read regressions.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Shipped

- Reset resolves the configured identity once in `messages.ts` and passes it to `resetConnection(connection)`. The service canonicalizes that captured identity and clears its token; it no longer resolves the configured connection again.
- The badge check compares the captured key against settings after the token clear, then claims the shared generation only while no newer check exists. An identity read or status check that lands during the reset keeps its authority.
- Regressions: holding the first identity read while A is configured, switching to B and completing Connected, then releasing leaves A's token cleared, B's token intact, and the badge clear. Holding the final identity read after A's token clear across the same switch leaves the badge clear and B's token intact.
- `resetConnection` now takes a `ConnectionIdentity`; its direct callers in `lib/connection/pairing-feature.test.ts` pass the endpoint they configured.

## Divergences

- The reset snapshots the generation before its identity read and claims it only at the end. Claiming up front would let a reset that is still resolving its identity override a newer status check.
- The post-clear `getSettings()` read remains, but only for the badge comparison; the token target is already bound. The documented in-flight badge-write limitation still applies after the claim.

## Seams under test

- Runtime `connection/reset` messaging with a held `storage.local.get`.
- Runtime `connection/status` for the newer connected connection.
- Stored tokens per endpoint and the toolbar badge text.

## Notes

- `lib/connection/messages.ts`, `lib/connection/service.ts`, `lib/connection/messages.test.ts`.
- Do not edit the unrelated WIP files.
