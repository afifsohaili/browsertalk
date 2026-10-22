# 018a: Blocking review fixes

**What to build:** Every remote pairing link shows its origin and warning, even when “Allow a remote server” is already on. The upgrade state keeps the pairing form and a recheck. The badge follows every status check.

**Blocked by:** 017.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A non-loopback link always returns a remote confirmation with its origin, regardless of the saved `allowRemote` value.
- [ ] No fetch and no persistence happen before the user confirms. Cancel leaves the server URL, policy, and tokens unchanged.
- [ ] Confirming reuses the same credential and endpoint. A second link to a different remote server confirms again.
- [ ] `upgrade` keeps the pairing form visible and shows “Check again”. A link for a supported 2.x server recovers from this state.
- [ ] Every `connection/status` response applies its state to the badge. Down → connected clears `1`; connected → down sets `1`.
- [ ] Unit/feature tests cover remote A → B with `allowRemote: true`, upgrade recovery, and both badge directions. No live network.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status and phase README updated with the SHA.

## Notes

- R1: `lib/connection/service.ts` currently confirms only when `credential.remote && !allowRemote`.
- R2: `showsPairForm` excludes `upgrade`; the welcome template hides “Check again” there.
- R3: the `connection/status` handler returns the probe result without applying it to the badge.
