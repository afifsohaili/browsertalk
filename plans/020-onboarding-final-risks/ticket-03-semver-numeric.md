# 020c: Strict numeric prerelease

**What to build:** The shared version gate rejects numeric prerelease identifiers with leading zeros while keeping valid prereleases and build metadata.

**Blocked by:** 020b.

**Status:** shipped · 1b5f58f.

## Shipped

- `isSupportedOpenCodeVersion` in `lib/connection/status.ts` now applies semver's numeric prerelease rule: an all-digit prerelease identifier must be `0` or start with `1-9`. Alphanumeric and hyphen-containing identifiers stay valid. Build metadata still accepts any non-empty identifier, leading zeros included.
- Regressions: the status unit rejects `2.0.32-01` and `2.0.32-beta.01` and accepts `2.0.0+build.01`; a paired `ping` rejects both forms; `authenticate` after redemption rejects both; `pairWithServer` with a seeded profile rejects both without writing a token, and the full settings plus raw `storage.local` snapshots stay unchanged.

## Divergences

- The prerelease grammar lives in one `PRERELEASE_IDENTIFIER` fragment shared by the regex, rather than a single inline literal. The gate remains module-level; every ping branch and authenticate call it.
- Only prerelease numeric identifiers changed. Main-version leading zeros (`2.00.1`) remain accepted, outside F7a's scope.

## Seams under test

- Status unit: the exported `isSupportedOpenCodeVersion` gate.
- Paired `ping` with stored credentials and injected HTTP.
- `authenticate` after a successful `/auth/connect/` redemption.
- `pairWithServer` persistence with seeded settings, saved-endpoint and unrelated tokens, and exact raw-storage equality.

## Acceptance criteria

- [x] F7a: reject `2.0.32-01` and `2.0.32-beta.01`.
- [x] Keep accepting `2.0.32`, `2.1.0-beta`, `2.0.0-rc.1+build.5`, and build identifiers with leading zeros (e.g. `2.0.0+build.01`).
- [x] Test at the status unit, ping, and authenticate/persistence seams. A rejected version persists no token and leaves settings unchanged.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status, 020 README, and `plans/README.md` updated with the SHA.

## Notes

- `lib/connection/status.ts`, `lib/connection/status.test.ts`, `lib/agent-backend/opencode.test.ts`, `lib/connection/pairing-feature.test.ts`.
- Do not edit the unrelated WIP files.
