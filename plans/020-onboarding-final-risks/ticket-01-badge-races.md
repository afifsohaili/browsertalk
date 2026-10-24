# 020a: Badge races

**What to build:** Startup and reset badge writes obey the same generation and connection guard as status probes. A stale startup probe or an obsolete reset cannot repaint the badge for a newer connection.

**Blocked by:** 019.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] F3a: `syncSetupBadge` on startup participates in the status generation and connection guard. A held startup `/api/info` for endpoint A, followed by a newer Connected check for B and then a startup transport error, leaves the badge cleared.
- [ ] F3a: pair and reset invalidate an in-flight startup check. Add startup → pair and startup → reset regressions.
- [ ] F3b: `connection/reset` binds its badge write to the connection actually reset. An obsolete reset for A that completes after B is Connected leaves the badge cleared and B's token intact.
- [ ] Add the reset interleaving regression.
- [ ] Do not edit `entrypoints/background.ts` or `lib/background.test.ts`; they contain unrelated WIP.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- F3a: `lib/onboarding/install.ts`, `lib/onboarding/badge.ts`, `lib/connection/messages.ts`.
- F3b: `lib/connection/messages.ts`.
