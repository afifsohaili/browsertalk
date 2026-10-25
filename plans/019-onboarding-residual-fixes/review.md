CHANGES REQUESTED

# 019 — Onboarding residual fixes: final review

## Spec findings

- **F3a — risk — startup probes bypass the new badge guard.** `lib/connection/messages.ts:37-51`; `lib/onboarding/badge.ts:35-39`; `lib/onboarding/install.ts:34`. Start `onStartup` against `http://127.0.0.1:15001`, holding its `/api/info` response. Switch to `http://127.0.0.1:4096`; complete a Connected `connection/status` response. Release the startup response with a transport error. The executed probe observed badge `''` become `'1'`, despite the current connection remaining Connected. `syncSetupBadge` never participates in `statusGeneration` or the connection check. Fix: route startup checks through the same generation/connection guard. Add startup → newer status and startup → pair/reset regressions.

- **F3b — risk — an obsolete reset repaints another connection's badge.** `lib/connection/messages.ts:76-80`. Start `connection/reset` at `http://127.0.0.1:15001`; hold its token-removal storage write. Switch to `http://127.0.0.1:4096`; complete a Connected status. Release the old reset. The executed probe observed badge `''` become `'1'`; the current endpoint's token remained intact. Incrementing the generation after completion makes the obsolete reset authoritative. No connection identity guards that write. Fix: bind the reset's badge update to the connection actually reset. Add this interleaving regression.

- **F1a — risk — stored fake admissions still become false Sent entries.** `lib/send/send.ts:218`; `lib/send/send.ts:111-112,191-203`. Use a fake-backed development profile; let delivery persist its admission. Reject `commitDeliveredItem`'s cleanup write, then run migration and retry. The executed probe returned `ok: true` and session `ses_fake_1`, under migrated `opencode` config. Outbox emptied, Sent gained the item, and HTTP calls stayed zero. The admission exception trusts a test double's receipt as real delivery. Impact remains existing development profiles, not new public installations. Fix: quarantine stored test-double destinations before the admission bypass. Preserve real-backend receipt recovery and explicit fake injection. Add cleanup-error → migration → retry coverage.

- **F7a — risk — malformed numeric prereleases still pass and persist credentials.** `lib/connection/status.ts:28-29`. Return `/api/info` version `2.0.32-01` or `2.0.32-beta.01` after successful redemption. Both violate semver's numeric-prerelease leading-zero rule. The executed probe persisted the new token, changed `serverUrl`, and reported Connected. `plans/019-onboarding-residual-fixes/README.md:67` acknowledges this exception. It leaves the requested strict semver suffix gate incomplete. No credential theft was demonstrated. Fix: reject leading-zero numeric prereleases at the shared gate. Keep valid alphanumeric prereleases and leading-zero build identifiers. Add ping and seeded persistence negatives.

## Standards

- Additional standard-only findings: none.
- Conventions checked: `CONTEXT.md`, `product.md`, `plans/README.md`, and the global contract.
- Existing seams remain intact: backend registry, keyed credentials, injected HTTP, and runtime messaging.
- New production behavior remains within the requested delivery, consent, badge, and version boundaries.

## F1–F7 resolution matrix

`met` means inspected behavior and executed local checks, not real-Chrome certification.

| Finding | Resolution | Evidence / remaining work |
|---|---|---|
| F1 — queued fake destination quarantine | **partial** | `migrate.test.ts:260-289` proves migration → actual send retains unadmitted feedback, records an actionable error, writes no Sent, and performs no HTTP. The stored-admission bypass still produces false Sent: F1a. |
| F2 — stale consent cannot reopen the panel | **met** | `use-consent.ts:20-43` guards reads and local choices by generation. `sidepanel/App.test.ts:157-195` holds accepted, completes declined, then releases accepted. No panel mount, tab query, or tab listener appears. An additional direct-decline probe retained declined state and storage. |
| F3 — only current connection/status paints the badge | **partial** | `messages.test.ts:321-425` covers both endpoint completion orders and older probes after pair/reset. Startup bypasses the guard: F3a. An old reset can also repaint the newer connection: F3b. |
| F4 — native network denied | **met** | Both inherited `useConnection` cases now inject HTTP before creation. `vitest.config.ts:7-8` registers the deny guard. Normal and preload-denied suites pass. HTTP-exercising connection tests inject responses; fake/gated adapters need no HTTP. |
| F5 — rendered pair, remote acceptance, upgrade recovery, handoff | **met** | `welcome/App.test.ts:89-105,130-154,176-195` exercises real SFC controls and real connection messaging. Assertions check Connected text, keyed tokens, endpoint, remote policy, and handoff. No successful local token is preseeded. |
| F6 — seeded credential/config preservation | **met** | `pairing-feature.test.ts:184-232` seeds saved, target, and unrelated credentials plus nondefault config. Successful redemption followed by 401 or transport error preserves complete raw-storage/config snapshots. Missing-target coverage also checks no credential creation. |
| F7 — strict semver suffixes | **partial** | All three original malformed examples now reject. Unit, ping, authenticate, and persistence seams exercise rejection. Supported prerelease/build examples remain accepted. Numeric leading-zero prereleases still pass both persistence and ping: F7a. |

## Coverage and security

| Area | Assessment |
|---|---|
| Behavioral assertions | New rendered success cases exercise click wiring, rather than manufactured Connected state. Persistence negatives compare real seeded values and complete snapshots. |
| Missing interleavings | Startup/status overlap, obsolete reset completion, and fake-admission cleanup recovery lack committed regressions. Each was reproduced without repository edits. |
| Consent | The original stale-read exposure is resolved. Generation checks prevent older accepted snapshots replacing newer declined state. The documented consent-only storage watcher remains unchanged. |
| Credential handling | HTTP remains in background adapter paths. Tokens remain extension-local and endpoint-keyed. No production fetch fallback was weakened. |
| Endpoint policy | Remote-origin acceptance remains explicit. Existing no-fetch/no-write warning and cancellation coverage still passes. Redirect refusal remains unchanged. |
| Version gate | Empty identifiers are rejected before persistence. F7a is the remaining syntax-hardening gap. |
| Delivery | Ordinary queued fake feedback is quarantined without rerouting. F1a concerns a receipt left after interrupted cleanup. |
| Badge impact | F3a/F3b are cosmetic state errors. They do not grant consent or expose credentials. |
| Live services | No live opencode or LLM request was used. Inline probes denied native fetch and injected synthetic responses. |

## Commands and results

| Command / check | Result |
|---|---|
| `git rev-parse '319def6^'` | Base: `112e36f20fe8eb9e9cd19d6b149e76b07dab8fa3`. |
| `git rev-parse HEAD` | Reviewed HEAD: `26848e5308ffa8e2d3a2b6f201b1f8d63169b54a`. |
| `git log --oneline '319def6^'..HEAD` | Read all 15 commits, including seven implementation/test commits and their plan updates. |
| `git diff '319def6^'...HEAD` | Reviewed all 22 changed files and relevant callers. |
| `git diff --check '319def6^'...HEAD` | **PASS**, exit 0. |
| `bun run compile` | **PASS**, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | **PASS**, exit 0; 81 files, 1,108 tests; 3.67s. |
| `bun run test --exclude components/ArmPickerButton.test.ts --exclude entrypoints/sidepanel/PanelSurface.test.ts` | **PASS**, exit 0; 79 files, 1,102 tests; 3.31s. Excludes the unrelated untracked test files. |
| 018 full network-denied preload, below | **PASS**, exit 0; 81 files, 1,108 tests; 3.62s. Zero `REVIEW_BLOCKED_NETWORK` lines. |
| 018 targeted network-denied preload | **PASS**, exit 0; `lib/connection/use-connection.test.ts`, 11/11 tests; 1.07s. |
| Inline Bun startup/status probe | **REPRODUCED F3a**: newer Connected badge `''` became `'1'` after stale startup error. |
| Inline Bun reset/current-status probe | **REPRODUCED F3b**: obsolete endpoint reset set `'1'`; current endpoint's token survived. |
| Inline Bun fake cleanup-error → migration → retry probe | **REPRODUCED F1a**: `ok: true`, `ses_fake_1`, Outbox empty, Sent populated, zero HTTP. |
| Inline Bun strict-version seam probe | **REPRODUCED F7a** for `2.0.32-01` and `2.0.32-beta.01`. All three original malformed examples rejected; `2.0.0-rc.1+build.5` passed. |
| Inline Bun direct-decline consent probe | **PASS**: delayed accepted reply left `status: declined`, `accepted: false`, `loaded: true`, and storage declined. |

### Network-denied command

This reproduces the 018 review command. The repository setup guard also remains active.

```sh
node --input-type=module -e 'import {startVitest} from "vitest/node"; const guard = `globalThis.fetch = async (input) => { console.error("REVIEW_BLOCKED_NETWORK " + String(input)); throw new Error("REVIEW_NETWORK_BLOCKED"); };`; const ctx = await startVitest("test", [], {watch:false, execArgv:["--import=data:text/javascript," + encodeURIComponent(guard)], reporters:["minimal"]}); if (ctx) await ctx.close();'
```

The targeted run used `["lib/connection/use-connection.test.ts"]` and `reporters:["verbose"]`.

## Scope and closeout

- Repository writes: only this report; uncommitted. No code, tests, tickets, or commits changed.
- Ignored review scope: unrelated `ArmPickerButton`/`PanelSurface` edits, their untracked tests, and `promo/`.
- Workspace caveat: compile and full suites used the supplied working tree. Two unrelated untracked files contribute six tests. The exclusion run removes those tests, not their component edits.
- Runtime caveat: asynchronous ordering was controlled in local probes. Occurrence in real Chrome remains unconfirmed.

Not reviewed: real Chrome, packaging, live servers, or store submission; these are outside 019's scope.

- Severity counts: **0 blocker, 4 risk, 0 nit, 0 question**.
- Top approval blockers: **F3a startup badge race**, **F3b obsolete reset**, **F1a fake admission**, **F7a strict suffix gap**.
- Blocker-severity findings: **none**. F1a remains limited to existing development profiles.
