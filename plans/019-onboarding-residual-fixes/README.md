# 019 — Onboarding residual fixes

Source: `plans/018-onboarding-review-fixes/review.md` (2026-10-22). Verdict: changes requested. 0 blocker, 0 high, 4 medium, 3 low.

Scope: all seven residual findings, F1–F7. One subagent per ticket, foreground, sequential. Rerun the review after 019b.

## Subphases

| Subphase | Ticket | Status | Blocked by |
|---|---|---|---|
| 019a | `ticket-01-security-correctness.md` | shipped · F3 · aae5154 | 018 |
| 019b | `ticket-02-test-hardening.md` | shipped · F4 · a858c96 | 019a |

Policy: one ticket = one conventional commit; tests ship with it. `bun run compile` and `bun run test` before each commit.

## Findings map

| Finding | Severity | Ticket |
|---|---|---|
| F1 queued fake destinations deliver false success | medium | 019a |
| F2 stale consent read reopens the panel | medium | 019a |
| F3 stale status probe repaints the badge | medium | 019a |
| F4 tests escape to live loopback | medium | 019b |
| F5 no rendered successful pair/handoff | low | 019b |
| F6 token-preservation test seeds nothing | low | 019b |
| F7 malformed semver suffixes pass | low | 019b |

## Out of scope

- New onboarding features.
- Real-Chrome or store submission.
- Session cleanup.

## Closeout 019a (F1)

F1 shipped 2026-10-22 in `154f1ed`.

- Delivery refuses a stored destination whose backend is no longer user-selectable. It records `This feedback was queued for the "<id>" backend, which this build no longer offers — discard it and queue it again`, leaves the item queued with its frozen destination, writes no Sent entry, and makes no HTTP call.
- The regression runs boot migration first: a stored fake selection becomes opencode, then the queued fake destination is quarantined rather than delivered.
- Divergences: a frozen nonselectable destination still delivers while that same backend is the configured selection, which keeps explicit fake tests working; boot migration makes that state unreachable in production. Already-admitted items skip the quarantine so their receipt can commit without a backend. Two send specs now use two opencode endpoints instead of a captured fake destination under an opencode selection.
- Delivery must-know: the quarantine sits in `route` after destination resolution and applies to any stored nonselectable backend, including unregistered ids. `isUserSelectableBackend` is now the single registry check; `migrate.ts` delegates to it.

## Closeout 019a (F2)

F2 shipped 2026-10-22 in `e494eb8`.

- `useConsent` keeps a generation counter. Every read captures it; a newer read, accept, decline, or consent storage change bumps it. Only the current generation writes `status` and `loaded`. A stale accepted read can no longer overwrite a newer decline.
- The rendered regression delays the initial stored-`accepted` read, completes a newer `declined` refresh, then releases the accepted reply. The gate stays declined, `main.panel` never mounts, no `browser.tabs.query` or tab listener appears, and stored consent remains `declined`.
- Divergences: accept and decline bump the generation before writing, so a read landing during the write cannot overwrite the user's choice; a failed write leaves any outstanding read stale. Accept and decline now also set `loaded` on success. No reconciliation path was added for stale replies.

## Closeout 019a (F3)

F3 shipped 2026-10-22 in `aae5154`. 019a is complete; the SHA lives in the follow-up docs commit.

- The background `connection/status` handler captures a generation and the configured connection before the probe. It writes the badge only when the generation is still the newest and the configured `backendId`/`serverUrl` still match at completion.
- Successful pair and reset bump the generation before their badge write, so older probes cannot repaint afterwards.
- Regressions cover both directions: delayed A-unreachable after B-connected stays clear; delayed A-connected after B-unreachable stays set. Delayed probes after pair and reset are ignored too.
- Divergences: the generation is module scope in `messages.ts`; `use-connection.ts` is unchanged because its refresh generation owns surface refs and cannot undo a background write. The status handler reads settings twice per probe, which exposed a timing assumption in `keeps the surface error from a failed pairing`; that assertion now waits with `vi.waitFor`. A badge write already in flight when a newer generation starts cannot be retracted.
- 019b must-know: the badge generation is not exported as a shared utility. F4–F7 remain in 019b.

## Closeout 019b (F7)

F7 shipped 2026-10-22 in `1580fab`. 019b remains open for F4–F6.

- `isSupportedOpenCodeVersion` now requires non-empty, dot-separated prerelease and build identifiers. `2.0.32-.`, `2.0.32-beta..1`, and `2.0.32+.` reject; `2.0.0-rc.1+build.5` still passes.
- Coverage lands at the status unit, paired `ping`, `authenticate` after redemption, and `pairWithServer` persistence. The persistence case seeds nondefault settings plus saved-endpoint and unrelated tokens, then asserts the full settings snapshot and every token are unchanged after a malformed suffix.
- Divergence: numeric prerelease identifiers with leading zeros (for example `2.0.32-01`) remain accepted. Strict semver forbids them; the finding required non-empty dot-separated identifiers.
- 019b must-know: the gate is one module-level regex. Both ping branches and authenticate call it, so a change there needs all four seams rerun.

## Closeout 019b (F6)

F6 shipped 2026-10-22 in `eda7d80`. 019b remains open for F4–F5.

- The post-redemption case now seeds server `http://127.0.0.1:4096`, `allowRemote: true`, a `sticky` strategy, saved-endpoint and unrelated tokens, and a target-endpoint token.
- Rejected (401) and unreachable `/api/info` both assert the full `getSettings()` snapshot, the complete raw `storage.local` snapshot, and all three tokens. The fetch log proves redemption ran, then the lookup failed.
- A third case seeds no target token and asserts the same snapshots plus no target key, covering accidental token creation.
- Sensitivity was checked by temporarily clearing the target token in the `pairWithServer` catch: both seeded cases failed, then the change was reverted. No production change shipped.
- Divergence: none. Must-know: the raw-storage equality is exact; any new write on the lookup-failure path will fail it by design.

## Closeout 019b (F5)

F5 shipped 2026-10-22 in `6eb2e62`. 019b remains open for F4.

- The welcome mount now attaches to `document.body`. A detached DOM swallowed the submit button's click, so the rendered specs submit through a real click.
- Local success: paste `http://127.0.0.1:29422/auth/connect/local123`, click Pair, then assert `Connected: opencode 2.0.32 at 127.0.0.1:29422`, the project-handoff copy, the hidden form, the redemption call, the `opencode@http://127.0.0.1:29422` token, and the persisted `serverUrl`. No token is seeded.
- Remote success: enter a non-loopback link, see the warning, click “Pair this server”, then assert the handoff, `serverUrl` + `allowRemote: true`, and the keyed token. Cancel now also asserts no fetch and `allowRemote: false`.
- Upgrade recovery: seed an incompatible saved token/status, paste a supported `2.0.32` link, click Pair, and assert the handoff, token, and endpoint. No Check again.
- Red check: replacing `@submit.prevent="submit"` and `@click="confirmRemote"` with no-ops failed the three new specs and the two existing remote specs; the file was restored. Full suite: 80 files, 1,106 tests.
- Divergence: none. Must-know: `mountWelcome` needs `attachTo` for any future click-driven submit; detaching the form silently drops the submit.

## Closeout 019b (F4)

F4 shipped 2026-10-22 in `a858c96`. 019b is complete.

- `test/setup/deny-network.ts` is registered in `vitest.config.ts` as a setup file. It replaces `globalThis.fetch` (and `window.fetch` where defined) with a throw naming the URL and the next action: inject with `setOpenCodeFetch()` or pass `fetchFn`.
- Injection still wins because `requestJson` prefers its `fetchFn` argument, then the `setOpenCodeFetch` override, then native fetch. Production `defaultFetch` is unchanged.
- The two inherited cases now inject `{ version: '2.0.32' }` before `useConnection`: the onboarding-copy case and the backend-change case. Both assert the same unpaired state as before.
- `test/deny-network.test.ts` proves the guard blocks native fetch and that an injected `probeServer` response resolves. Removing `setupFiles` fails the guard spec; the config was restored.
- Red proof: the review preload ran the targeted file at 10 passed, 1 failed (`reads the connection again when the backend changes`) before the fix. After it: 11/11 pass under the same preload.
- Verification: `bun run compile` exit 0. `bun run test` 81 files, 1,108 tests pass. Review preload full run 81 files, 1,108 tests pass, zero `REVIEW_BLOCKED_NETWORK` lines.
- Divergence: one extra spec file over the 80-file baseline, the guard self-test. No other test needed native fetch.
- Must-know: a test that genuinely needs native fetch must stub it locally and restore it; do not remove the setup file or add an exemption list. The guard throws synchronously, so assert with `expect(() => fetch(...)).toThrow(...)`.
