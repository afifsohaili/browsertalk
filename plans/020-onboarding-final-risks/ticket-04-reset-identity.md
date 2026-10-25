# 020d: Reset identity

**What to build:** A reset binds to one connection identity. A delayed config read cannot clear another connection's token or repaint its badge.

**Blocked by:** 020c.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] F3b-1: hold the first identity read while A is configured. Switch to B, complete a Connected status, release the read. Reset clears A's token only; B's token stays intact; the badge stays cleared.
- [ ] F3b-2: reset A, hold the final identity read after it snapshots A. Switch to B and complete a Connected status, then release. The badge stays cleared; B's token stays intact.
- [ ] Reset resolves the connection identity once and uses it for token removal and badge checks. No second `getSettings()` read after the async token clear can change the target.
- [ ] Add both delayed-read regressions.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/connection/messages.ts`, `lib/connection/service.ts`, `lib/connection/messages.test.ts`.
- Do not edit the unrelated WIP files.
