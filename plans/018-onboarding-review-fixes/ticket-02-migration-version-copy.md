# 018b: Migration, version, copy, negatives

**What to build:** A stored test-only backend cannot reach the connection or delivery paths. The version gate rejects malformed versions. The disclosure and store copy stop presenting `15001` as the default. The parser and cancel/version-failure negatives are tested.

**Blocked by:** 018a.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A stored `fake` backend resolves to `opencode` before ping, pairing, or delivery, without a settings-page visit. Explicit fake injection in tests keeps working.
- [ ] The normalization lives at a production boundary (boot migration or settings boundary), not a global fallback that breaks the existing fake-backed tests.
- [ ] The version gate accepts documented 2.x forms and rejects `2.` and `2.garbage`.
- [ ] `ConsentGate.vue`, README, and the store packet no longer present `http://127.0.0.1:15001` as the default. Loopback wording is qualified by the remote policy.
- [ ] Parser negatives: malformed percent escape, IPv6 loopback, lookalike localhost host, multiple URLs, punctuation wrapper, unsupported scheme.
- [ ] Cancel asserts no fetch, no URL/policy/token change. A failed version lookup after redemption persists nothing.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status and phase README updated with the SHA.

## Notes

- R4: `useSettingsPage` migrates only when the options page loads. Prefer a boot migration in `migrateLegacyConnectionStorage`, not a connection-wide fallback that broke 77 tests.
- R8: `isSupportedOpenCodeVersion` uses `/^2\./`.
- R9: keep `15001` documented as a legacy fallback only.
