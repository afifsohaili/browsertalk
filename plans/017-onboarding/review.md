# Phase 017 onboarding review

## Verdict

**Changes requested.** Typecheck and all 1,042 tests pass, but two findings block approval.

- Scope: `cd6caf8^..HEAD`, including the pair-form follow-up.
- Base: `5549d17b0cf8020aba72d466092c981097e940b1`.
- HEAD: `231a87c1f5fb5d46ae3c1b8a9be11f9a353ad3f4`.
- Counts: **0 blocker, 2 high, 5 medium, 2 low**.
- Approval blockers: **R1**, remote-origin confirmation; **R2**, upgrade-state recovery.
- Third blocker: none identified. Medium findings remain actionable, without inventing another blocker.
- Known fake-backend gap: **medium, nonblocking for public release**; see R4.
- Review only: no application, test, or ticket changes. This report remains uncommitted.

Severity describes impact. High findings block approval here; neither requires the emergency `blocker` severity.

## Findings

| ID | Severity | Axis | File/line | Evidence | Concrete fix |
|---|---|---|---|---|---|
| R1 | high | Security / spec | `lib/connection/service.ts:89-103`; `lib/connection/pairing-feature.test.ts:154-164` | Confirmation depends on `!allowRemote`, rather than the pasted origin. After allowing server A, a link for server B exchanges immediately, without displaying B's origin or warning. The test explicitly expects this bypass. Ticket 017a:34 requires confirmation for a non-loopback link. | Require explicit confirmation for remote pairing links, independently of the general transport opt-in. Keep origin and credential together through confirmation. Test A → B with `allowRemote=true`: no fetch or persistence before confirmation. |
| R2 | high | Spec / coverage | `lib/onboarding/use-setup.ts:20-21,30-32`; `entrypoints/welcome/App.vue:63-66,76`; `lib/onboarding/use-setup.test.ts:55-58` | `incompatible` becomes `upgrade`. That state hides pairing and has no Check again button. Refresh does not poll. Upgrading the server leaves this tab stuck; an old saved endpoint also prevents pasting a link for another supported server. The unit test pins the hidden form. | Keep link entry available during upgrade. Add Check again for upgrade, and test recovery after upgrading or changing endpoints through the rendered welcome surface. |
| R3 | medium | Spec / coverage | `lib/connection/messages.ts:34-49`; `lib/onboarding/install.ts:32-34`; `lib/onboarding/badge.ts:26-39` | Badge synchronization runs on browser startup, successful pair, and reset. A startup probe can set `1` while a previously paired server is down. Starting that server and checking again returns Connected, but `connection/status` never clears `1`. Conversely, a failed manual check leaves an already-cleared badge unchanged. | Apply the returned status to the badge in the background status handler. Test down → connected and connected → down through status requests, without pairing or restarting Chrome. |
| R4 | medium | Spec / coverage | `lib/connection/resolve.ts:18-22`; `lib/connection/service.ts:19-21`; `lib/settings/use-settings-page.ts:83-89`; `lib/agent-backend/fake.ts:46-51,61-69` | Stored `fake` resolves directly until the settings page loads. Setup reports Connected, pairing reports no pairing needed, and feedback can receive fake admissions without reaching opencode. The settings-only fallback does not satisfy 017a:39 globally. | Normalize a stored nonselectable backend at the production connection/settings boundary, before ping, pairing, or delivery. Preserve explicit fake injection for tests. Add a stored-fake feature spec that never opens settings. |
| R5 | medium | Test coverage | `lib/onboarding/use-setup.test.ts:90-112`; `lib/onboarding/copy.test.ts:6-23`; `lib/onboarding/onboarding-feature.test.ts:41-72`; `entrypoints/welcome/App.vue:29-39,66-108` | No welcome or connection-card rendering spec exists. The remote transition test directly assigns `connected` inside its mock, then asserts the resulting step. This checks mapping, not the real exchange or handoff. Copy tests check constants rather than visible text. Visibility tests check the helper, not both nested template conditions. Clipboard and side-panel actions have no surface coverage. | Add rendered public-seam specs using real connection messaging and injected HTTP responses. Cover unreachable entry, upgrade recovery, remote confirm/cancel, visible warnings, project handoff, reopened setup, clipboard rejection, and side-panel rejection. Check the click gesture in real Chrome. |
| R6 | medium | Test coverage | `lib/connection/pairing-link.test.ts:4-96`; `lib/connection/pairing-feature.test.ts:123-175`; `lib/connection/use-connection.test.ts:192-225`; `lib/agent-backend/opencode.test.ts:19-159` | Parser tests omit malformed percent escapes, link-level IPv6/lookalike hosts, multiple URLs, punctuation wrappers, unsupported-scheme input, and decode/re-encode assertions at the fetch seam. The service test named cancel never invokes cancellation. The composable cancel test checks the token, but not the complete settings snapshot or a subsequent confirm. No feature spec checks persistence after successful redemption followed by rejected/unreachable version lookup. | Add negative cases at parser and background message seams. After cancel, assert unchanged URL, policy, tokens, no exchange, and inert confirm. After failed version lookup, assert existing settings and tokens unchanged. Add unpaired transport-error and incompatible probe cases, plus reset badge and reset-error assertions. |
| R7 | medium | Security | `entrypoints/sidepanel/App.vue:12-49,88-94`; `lib/panel/use-panel.ts:135-149,397-410,445-452` | **Inherited, not introduced by 017.** `usePanel()` starts before consent is loaded or accepted. It reads the active tab URL and subscribes to tab changes behind the disclosure. The template gate only hides the UI. This contradicts the requested no-page-access-before-consent check, although DOM capture and feedback queueing remain gated. | Mount the data-reading panel only after acceptance, or gate its reads and listeners. Test unset and declined consent with spies proving no active-page reads. Handle later consent changes without retaining listeners. |
| R8 | low | Security / coverage | `lib/connection/status.ts:28-29`; `lib/connection/status.test.ts:16-29` | The version gate accepts any `2.` prefix. Read-only execution accepted both `2.` and `2.garbage`. These are not demonstrated opencode 2.x versions. This is response-shape hardening, not evidence of credential theft. | Check the documented version format, retaining supported prerelease versions. Add malformed-version cases at both ping and authenticate seams. |
| R9 | low | Spec / security copy | `CHROMEWEBSTORE.md:116,132`; `components/ConsentGate.vue:25-28`; `README.md:76` | The disclosure still presents `http://127.0.0.1:15001` as the default. The store packet acknowledges this mismatch. README also says all traffic stays on loopback before describing remote traffic. Pairing-link behavior makes those unconditional statements misleading. | Align the disclosure and recorded text with the pairing endpoint. Qualify the loopback statement with the default policy. Keep the legacy fallback documented separately. |

### Known gap decision

- R4 is a real acceptance-criterion gap, not merely cosmetic migration debt.
- Existing fake-backed installs can receive false Connected and Sent outcomes.
- Public installs cannot select fake through the shipped choices.
- Therefore: medium, nonblocking for public release; fix before relying on existing development-profile migration.
- The current startup badge test uses fake to prove readiness: `lib/onboarding/badge.test.ts:47-54`.
- That test should not substitute for a stored-opencode-token startup test.

## Coverage matrix against every acceptance criterion

Numbers follow each ticket's acceptance-criteria order. `Met` describes inspected code and available evidence, not browser certification.

### 017a — connection core

| AC | Requirement | Status | Code / coverage evidence |
|---|---|---|---|
| A1 | Five states, each with a next action | met | `opencode.ts:71-165`; `status.ts:9-23`; adapter tests cover all five overall. |
| A2 | Token-free probe distinguishes down from unpaired | met | `opencode-api.ts:75-90`; `opencode.ts:86,103-144`; unauthenticated headers asserted in `opencode.test.ts:54-67`. Dedicated unpaired transport-error coverage is missing, R6. |
| A3 | Full command output, pairing link, bare code | met | `pairing-link.ts:26-71`; `pairing-link.test.ts:5-39`; feature test uses multiline output. Parser edge coverage remains partial, R6. |
| A4 | Link supplies URL; exchange precedes persistence | met | `service.ts:30-42`; `opencode.ts:55-65`; link endpoint/token and non-2.x rejection feature specs. Post-redemption lookup-error coverage is missing, R6. |
| A5 | Remote origin/warning, explicit confirmation, cancel writes nothing | partial | Default-off path works; existing `allowRemote` bypasses confirmation, R1. Actual cancel persistence assertions are incomplete, R6. |
| A6 | Check version after pairing; accept 2.x; upgrade copy otherwise | partial | `opencode.ts:62-63`; 2.x/3.x authenticate tests. Malformed versions pass, R8. Upgrade recovery is blocked, R2. |
| A7 | Forget current endpoint token; return unpaired | met | `service.ts:125-134`; `pairing-feature.test.ts:187-209` checks reset and another endpoint's retained token. |
| A8 | Compact panel state/action, setup-tab link, no full wizard | met | `components/ConnectionPanel.vue:10-37`; `onboarding/welcome.ts:9-11`. Rendering/reopen coverage missing, R5. |
| A9 | Options Test connection, Forget pairing, advanced URL | met | `entrypoints/options/App.vue:70-105`; settings-page tests exercise status and reset. |
| A10 | Hide fake; stored fake resolves to opencode; retain test fake | partial | Choice filtering and settings migration exist; connection-layer fallback does not, R4. |
| A11 | Feature: link → keyed token → connected → project list | met | `pairing-feature.test.ts:37-73` exercises the public service seam with injected fetch. |
| A12 | Units: parser, states, remote/cancel, reset, version, filtering | partial | Named seams have tests; negative and rendered cases remain missing, R5–R6. One test encodes the confirmation deviation, R1. |
| A13 | Compile and test pass | met | Both commands passed during this review. Historical pre-commit command execution is unconfirmed. |
| A14 | Conventional commit; ticket/README status and SHA | partial | Main implementation is `cd6caf8 feat(connection): classify onboarding and pair from links`. SHA documentation follows in `3ba538a`, as explicitly recorded. Literal same-commit closeout is not met. |

### 017b — welcome tab and badge

| AC | Requirement | Status | Code / coverage evidence |
|---|---|---|---|
| B1 | Install only; no updates; skip development/admin | met | `install.ts:5-8,20-25`; unit tests cover normal/update/development/admin and unavailable install type. Registration precedes the background's first await. |
| B2 | Badge until connected; clear after pair; restore on startup | partial | Pair/reset/startup paths exist; status-only recovery leaves a stale badge, R3. Startup-connected coverage substitutes fake, R4. |
| B3 | Prerequisite, copy command, input, live state/version, link warning | partial | Welcome template contains all required copy. Pairing and recheck disappear during upgrade, R2. No rendered clipboard test, R5. Manual refresh instead of polling is a documented divergence. |
| B4 | Remote origin and warning; confirmation sets policy | partial | Template renders escaped warning; success persists opt-in. Preexisting opt-in skips the surface, R1. |
| B5 | Dev-site project handoff; no binding on extension origin | met | `welcome/App.vue:103-108`; `copy.ts:11`. Welcome imports no binding action. |
| B6 | Open side panel from user gesture; pin instructions | met | Button → `openPanel` → `openSidePanel`; footer supplies pin copy. `panel.ts:6-8` awaits a tab query before opening. Real-Chrome gesture preservation is unconfirmed; R5 requests that check. |
| B7 | Shared setup composable, no duplicate state machine | met | Welcome and card use `useSetup`; `use-setup.ts:10-27` owns the step mapping. Instances are separate per surface, which is appropriate. |
| B8 | Feature: install opens; update does not; pair clears badge | met | `onboarding-feature.test.ts:41-72` uses runtime events and the message-handler seam. |
| B9 | Units: install gating, badge, setup transitions, remote copy | partial | All named areas have units. Rendered transitions/actions and status-driven badge cases are missing, R3/R5. |
| B10 | Compile and test pass | met | Both commands passed during this review. Historical pre-commit execution is unconfirmed. |
| B11 | Conventional commit; ticket/README status and SHA | partial | `6fb7802 feat(onboarding): welcome tab and setup badge`; SHA recorded in follow-up `8e7cb09`. The documented pair-form fix is `af03b52`. |

### 017c — docs and store

| AC | Requirement | Status | Code / coverage evidence |
|---|---|---|---|
| C1 | README setup: opencode 2 → pair → copy → paste → panel → project | met | `README.md:7-20`; no fake/demo path. |
| C2 | Dynamic service port/status; serve defaults to 4096 | met | `README.md:12,76`. CLI facts are documented, not checked against a live CLI here. |
| C3 | Store instructions require 2.x/pair; explain reviewer path | met | `CHROMEWEBSTORE.md:82-95`; full reviewer loop described. No live clean-profile dry run performed. |
| C4 | Product surfaces/workflow reflect welcome/card/link | met | `product.md:40-68`; storage model reflects endpoint-keyed tokens. |
| C5 | Glossary adds Setup, Pairing link, Server check, Connected | met | `CONTEXT.md:39-49`; existing project/origin/session terms retained. |
| C6 | Remove stale binding-UI caveat | met | Store sections 3, 4, and 6 now describe shipped binding. |
| C7 | Compile and test pass for docs-only work | met | Both commands passed at reviewed HEAD. The individual docs-commit run is unconfirmed. |
| C8 | Conventional commit; ticket/README status and SHA | partial | `8a9b0f7 docs(setup): welcome tab and pairing link flow`; SHA recorded in `37874f8`. Extra privacy sentence/date change is documented and justified. |

### Coverage quality

- Public-seam feature coverage is substantive for link pairing, keyed storage, status, project listing, and reset.
- Install and pair-badge specs exercise runtime events and background handlers, rather than private helpers alone.
- State-to-step tables are legitimate pure-function units, not end-to-end setup coverage.
- The mocked remote transition directly creates its expected state: `use-setup.test.ts:105-112`.
- The remote cancel service spec proves withholding confirmation, not cancellation: `pairing-feature.test.ts:123-138`.
- Constant-copy tests cannot prove visible warnings, button wiring, or field availability.
- Nonempty label/action assertions are weak but not tautological: they catch missing entries, not wrong guidance.
- Existing transport units cover embedded credentials, remote rejection, redirects, malformed JSON, and request deadlines.
- No live network or LLM use was found in reviewed onboarding tests; HTTP uses injected fetch functions.
- No global deny-network guard exists in `vitest.config.ts`; network isolation was not instrumented during this review.

## Security assessment

| Check | Assessment / evidence |
|---|---|
| Origin validation | HTTP(S) endpoint parser rejects userinfo and applies literal loopback rules. `endpoint.ts:28-50` does not resolve arbitrary hostnames as loopback. Remote-confirmation exception remains R1. |
| Arbitrary URL or prose | Non-pairing HTTP(S) URLs and whitespace prose without links are rejected. Full command output extracts its first HTTP(S) URL. Multiple-link selection is not disambiguated. Non-HTTP single strings become codes, not navigations. |
| Code encoding | Link code is decoded once, then `encodeURIComponent` is applied during redemption. Encoded slashes stay within the request segment. Malformed percent escapes are rejected. End-to-end encoding coverage is missing, R6. |
| Remote policy | Default-off remote links trigger no fetch before confirmation. Successful exchange/version lookup precedes persisted opt-in. Existing broad opt-in skips origin-specific confirmation, R1. |
| Cancel and persistence | `cancelRemote()` clears pending in-memory state and performs no writes. A later confirm returns false without a pending credential. The tests do not assert that complete contract, R6. |
| Token storage/keying | `storage/auth.ts:4-22` stores tokens in local extension storage; service keys by backend and canonical endpoint. No token is returned to the welcome page. Storage writes are separate, not transactional; atomic storage-error recovery is untested. |
| Version gate | Redemption is followed by authenticated info before persistence. Non-2.x rejects with upgrade guidance. Prefix-only version parsing needs hardening, R8. Upgrade UI recovery is R2. |
| Credential/log leakage | No new credential logging found. Transport errors use sanitized endpoint/status text, not response bodies or pairing codes. Existing background warning concerns side-panel setup only. |
| Welcome XSS | Interpolation renders status, endpoint/version, and warning as text. No `v-html`, HTML insertion, or dynamic remote script is introduced. Install-doc link has `noopener noreferrer`. |
| Clipboard | Only the command is written, from the Copy click. No clipboard read or pairing-token write. Rejection is caught, but no visible error is supplied; browser behavior remains untested. |
| Side panel gesture | Open originates from a button, never install. The awaited tab query needs a real-Chrome gesture check; no observed browser rejection is claimed. |
| Install gating | Install reason/type gates exist; unknown install type falls back to opening. Tests explicitly cover this fallback. `management.getSelf()` errors are not proof of a normal install. |
| Port scanning | None found. Probe targets the configured endpoint; pairing targets the link endpoint. |
| Consent | New welcome flow reads no page content or project origin. Existing panel reads the active URL before acceptance, R7. Picker/capture and queue paths retain background consent checks. |
| Background-only fetch | Welcome and options use runtime requests. Production adapter HTTP is reached through background handlers. Registering backends in the welcome entrypoint does not itself fetch. |
| Docs secrets | No actual credentials or secret-bearing pairing links found in reviewed docs. Examples use placeholders or illustrative endpoints. Disclosure/default wording needs R9. |

## Commands run and results

| Command / inspection | Result |
|---|---|
| `bun run compile` | PASS, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | PASS, exit 0; 75 files, 1,042 tests; Vitest 5.0.5, reported duration 3.33s. |
| `git diff --check 'cd6caf8^' HEAD` | PASS, exit 0; no whitespace errors. |
| `git rev-parse HEAD 'cd6caf8^'` | Resolved the HEAD/base hashes recorded above. |
| `git diff --stat 'cd6caf8^' HEAD` | 48 changed files; inspected application, tests, and documentation diffs. |
| `git diff 'cd6caf8^' HEAD -- lib/connection lib/agent-backend/opencode.ts lib/agent-backend/opencode-api.ts lib/agent-backend/interface.ts` | Read connection and adapter diffs. |
| `git diff 'cd6caf8^' HEAD -- entrypoints components lib/onboarding lib/settings` | Read welcome, install, badge, card, settings, and corresponding test diffs. |
| `git log --oneline 'cd6caf8^..HEAD'` | Eight commits, including three implementation/doc phases and the pair-form follow-up. |
| Read-only `bun -e` parser/version probe | Malformed `%ZZ` rejected; `%2F` decoded; lookalike localhost marked remote; IPv6 loopback local. `javascript:alert(1)` became a bare code, not executed. `ABC)` retained the closing parenthesis. `2.` and `2.garbage` accepted; `20.0.0` rejected. No network calls. |
| `git status --short` before report | Existing untracked `promo/`; left untouched. |
| Local `glob` for `**/AGENTS.md` | No repository-local file found. An initial parent-directory `find` timed out after ten seconds. |
| Consent-reference search | Relevant guards found. One search included nonexistent `lib/picker/capture.ts`, producing a path error; this did not affect compile/tests. |

### Read-only probe command

```sh
bun -e 'import { parsePairingCredential } from "./lib/connection/pairing-link.ts"; import { isSupportedOpenCodeVersion } from "./lib/connection/status.ts"; for (const value of ["http://127.0.0.1:4096/auth/connect/%ZZ", "http://127.0.0.1:4096/auth/connect/abc%2F123", "http://localhost.evil.example:4096/auth/connect/ABC", "http://[::1]:4096/auth/connect/ABC", "http://127.0.0.1:4096/auth/connect/ABC)", "javascript:alert(1)"]) console.log(JSON.stringify({ value, result: parsePairingCredential(value) })); for (const version of ["2.", "2.garbage", "2.0.32", "20.0.0"]) console.log(JSON.stringify({ version, supported: isSupportedOpenCodeVersion(version) }));'
```

### Limits and next checks

- No real Chrome run, production build, live opencode probe, or store submission was performed.
- Real-browser clipboard and side-panel gesture behavior remain unconfirmed.
- No fixes or commits were made.
- Next: address R1/R2, add seam/rendered regressions, then rerun compile/tests and a clean-profile Chrome check.
