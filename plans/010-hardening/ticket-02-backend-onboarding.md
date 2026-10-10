# 010-02: Backend-independent onboarding + six-axis contract

**What to build:** Fix review findings 1, 3, and 11: pairing/onboarding is dispatched through the selected backend (opencode pairing code vs pi token/bridge), project discovery respects capabilities with manual directory binding when absent, deterministic creation distinguishes reuse from rollover, and the seam contract carries the six axes truthfully.

**Blocked by:** 010-01 — Connection identity + transport security.

**Status:** ready-for-agent

- [ ] Pairing/auth dispatched via the backend: each adapter exposes its onboarding (instructions + credential handling); the connection panel renders backend-specific copy; no opencode strings leak into generic surfaces
- [ ] `capabilities.projects = false` → panel offers manual directory binding (origin → directory + name); empty discovery lists stay honest
- [ ] Deterministic creation: `createSession` receives a stable creation intent (strategy identity + persisted rollover generation or explicit fresh flag) so same-day rollover and reuse differ for deterministic-id backends
- [ ] Contract: registry-derived backend ids (no hardcoded union edit needed for a new adapter), optional `listSessions` + session refresh, truthful capability flags (named creation, delivery modes, images), generic error codes (unauthorized / missing-session / busy / ambiguous-admission)
- [ ] Tests with fake + opencode fixtures pinning the conformance-shaped inputs
- [ ] `bun run compile` + full suite pass; one conventional commit; plans updated

Details: `/tmp/opencode/review-pre-009.md` findings 1, 3, 11.
