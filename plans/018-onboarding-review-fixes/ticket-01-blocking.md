# 018a: Blocking review fixes

**What to build:** Every remote pairing link shows its origin and warning, even when “Allow a remote server” is already on. The upgrade state keeps the pairing form and a recheck. The badge follows every status check.

**Blocked by:** 017.

**Status:** shipped · 0ecd272.

## Shipped

- A non-loopback pairing link always returns the remote confirmation with its origin, even when "Allow a remote server" is already on. No fetch or persistence happens before confirmation.
- Confirm reuses the same pasted credential and link endpoint; cancel keeps the server URL, policy, and tokens unchanged.
- `upgrade` keeps the pairing form visible and offers "Check again". Pasting a link for a supported 2.x server recovers to `project`.
- Every `connection/status` response applies its state to the toolbar badge: down → connected clears `1`; connected → down sets `1`.

## Divergences

- The commit SHA is recorded in the follow-up docs commit; a commit cannot contain its own hash.
- "Check again" visibility lives in a new `showsRecheck(step)` helper so the template and its unit test cannot drift. The rendered welcome spec remains 018c work.

## Seams under test

- Connection service: remote A → B with `allowRemote: true`, no fetch or persistence before confirmation.
- Connection messages: remote confirmation with `allowRemote: true`; badge on both status directions.
- `useConnection`: cancel keeps the old endpoint and tokens; confirm pairs the new one.
- Setup composable: upgrade keeps the form and recheck; a supported link recovers.

## Acceptance criteria

- [x] A non-loopback link always returns a remote confirmation with its origin, regardless of the saved `allowRemote` value.
- [x] No fetch and no persistence happen before the user confirms. Cancel leaves the server URL, policy, and tokens unchanged.
- [x] Confirming reuses the same credential and endpoint. A second link to a different remote server confirms again.
- [x] `upgrade` keeps the pairing form visible and shows “Check again”. A link for a supported 2.x server recovers from this state.
- [x] Every `connection/status` response applies its state to the badge. Down → connected clears `1`; connected → down sets `1`.
- [x] Unit/feature tests cover remote A → B with `allowRemote: true`, upgrade recovery, and both badge directions. No live network.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status and phase README updated with the SHA.

## Notes

- R1: `resolvePairingEndpoint` confirms on `credential.remote` alone; `allowRemote` no longer skips the confirmation.
- R2: `showsPairForm` and `showsRecheck` include `upgrade`; the welcome form and Check again use them.
- R3: the `connection/status` handler applies the probe result with `applySetupBadge`.
