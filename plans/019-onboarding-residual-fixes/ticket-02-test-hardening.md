# 019b: Test isolation and hardening

**What to build:** The suite cannot reach a live server. The welcome surface has a rendered successful pairing and handoff. Token-preservation tests seed real values. The version gate rejects malformed semver suffixes.

**Blocked by:** 019a.

**Status:** in progress · F7 shipped in `1580fab`; F4–F6 remain.

## Acceptance criteria

- [ ] F4: every connection test injects an explicit fetch response before creating `useConnection`. Add a deny-network guard so an omitted injection fails instead of reaching loopback.
- [ ] F4: `bun run test` passes with native fetch denied.
- [ ] F5: rendered welcome spec clicks Pair with a real link and asserts Connected text, keyed token, and the project handoff.
- [ ] F5: rendered remote flow clicks “Pair this server” and asserts origin warning, policy, token, and handoff. Upgrade recovery by a supported link is rendered.
- [ ] F6: seed saved-endpoint, target-endpoint, and unrelated tokens plus nondefault config. After successful redemption followed by a rejected or unreachable `/api/info`, assert the complete snapshots are unchanged.
- [x] F7: version gate accepts `2.0.32`, `2.1.0-beta`, and `2.0.0-rc.1+build.5`; rejects `2.0.32-.`, `2.0.32-beta..1`, and `2.0.32+.`.
- [x] F7: malformed suffixes are tested through ping and authenticate/persistence seams.
- [ ] `bun run compile` and `bun run test` pass, including the network-denied run.
- [ ] One conventional commit; ticket status, 019 README, and `plans/README.md` updated with the SHA.

## Notes

- F4: `lib/connection/use-connection.test.ts:95-105,124-130`; `vitest.config.ts`. Use a setup file or a preload guard; do not weaken real fetch behavior in production.
- F5: `entrypoints/welcome/App.test.ts` already has the harness. Reuse it.
- F6: `lib/connection/pairing-feature.test.ts`.
- F7: `lib/connection/status.ts`; keep supported prerelease/build positives.
