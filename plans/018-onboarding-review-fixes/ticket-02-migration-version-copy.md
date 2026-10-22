# 018b: Migration, version, copy, negatives

**What to build:** A stored test-only backend cannot reach the connection or delivery paths. The version gate rejects malformed versions. The disclosure and store copy stop presenting `15001` as the default. The parser and cancel/version-failure negatives are tested.

**Blocked by:** 018a.

**Status:** shipped · 5175153

## Acceptance criteria

- [x] A stored `fake` backend resolves to `opencode` before ping, pairing, or delivery, without a settings-page visit. Explicit fake injection in tests keeps working.
- [x] The normalization lives at a production boundary (boot migration or settings boundary), not a global fallback that breaks the existing fake-backed tests.
- [x] The version gate accepts documented 2.x forms and rejects `2.` and `2.garbage`.
- [x] `ConsentGate.vue`, README, and the store packet no longer present `http://127.0.0.1:15001` as the default. Loopback wording is qualified by the remote policy.
- [x] Parser negatives: malformed percent escape, IPv6 loopback, lookalike localhost host, multiple URLs, punctuation wrapper, unsupported scheme.
- [x] Cancel asserts no fetch, no URL/policy/token change. A failed version lookup after redemption persists nothing.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit; ticket status and phase README updated with the SHA.

## Closeout

Shipped 2026-10-22 in `5175153`.

- Stored `fake` (or any unregistered/non-selectable backend) moves to `opencode` at boot in `migrateLegacyConnectionStorage`, before ping, pairing, or delivery. Explicit fake injection in tests is untouched.
- A stored migration owner with a test-only backend is normalized to the same default, so legacy tokens cannot be stranded under `fake`.
- `isSupportedOpenCodeVersion` now requires `2.<major>.<minor>` with optional prerelease/build metadata.
- The parser rejects multi-URL pastes and unsupported schemes, strips wrapper punctuation, and marks lookalike localhost hosts as remote (confirmation still runs).
- ConsentGate, README, and the recorded store disclosure use pairing-endpoint and loopback-by-default wording; `15001` remains only the legacy saved fallback.

## Notes

- R4: `useSettingsPage` migrates only when the options page loads. Prefer a boot migration in `migrateLegacyConnectionStorage`, not a connection-wide fallback that broke 77 tests.
- R8: `isSupportedOpenCodeVersion` is now strict 2.x semver-ish (`2.<major>.<minor>` plus optional prerelease/build), not `/^2\./`.
- R9: keep `15001` documented as a legacy fallback only.
