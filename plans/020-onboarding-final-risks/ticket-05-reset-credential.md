# 020e: Credential-scoped reset invalidation

**What to build:** After reset removes a connection's token, an in-flight startup or status probe for that same connection cannot clear the badge. A newer check for another connection stays authoritative.

**Blocked by:** 020d.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Start reset A and hold its first config snapshot. Start a status A probe and hold `/api/info` after its token snapshot. Release the reset and await token removal. Release `/api/info` with `2.0.32`. The badge stays `1`, because A is now unpaired.
- [ ] The same ordering for a startup check keeps the badge `1`.
- [ ] A newer B check remains authoritative. B Connected still clears the badge.
- [ ] Invalidate probes using the removed credential when reset commits, scoped to that connection. Do not globally reject all probes.
- [ ] Add both reset-first regressions.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/connection/messages.ts`, `lib/onboarding/badge.ts`, `lib/connection/messages.test.ts`.
- Do not edit the unrelated WIP files.
