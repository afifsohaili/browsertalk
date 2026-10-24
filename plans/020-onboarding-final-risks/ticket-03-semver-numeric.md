# 020c: Strict numeric prerelease

**What to build:** The shared version gate rejects numeric prerelease identifiers with leading zeros while keeping valid prereleases and build metadata.

**Blocked by:** 020b.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] F7a: reject `2.0.32-01` and `2.0.32-beta.01`.
- [ ] Keep accepting `2.0.32`, `2.1.0-beta`, `2.0.0-rc.1+build.5`, and build identifiers with leading zeros (e.g. `2.0.0+build.01`).
- [ ] Test at the status unit, ping, and authenticate/persistence seams. A rejected version persists no token and leaves settings unchanged.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/connection/status.ts`, `lib/connection/status.test.ts`, `lib/agent-backend/opencode.test.ts`, `lib/connection/pairing-feature.test.ts`.
- Do not edit the unrelated WIP files.
