CHANGES REQUESTED

# 018 — Onboarding review fixes: re-review

- Findings: **0 blocker, 7 risk, 0 nit, 0 question**.
- Relative impact: four behavioral/isolation risks; three lower-impact hardening/coverage risks.
- Normal checks pass: typecheck and **1,085 tests across 78 files**.
- Network-denied checks fail: one existing test depends on a live loopback response.
- R1, R2, and R9 are met. R3–R8 retain the gaps below.
- Scope: `git diff '0ecd272^'...HEAD`, including all eight commits and all changed files.
- Base: `a0afb54375fc53acc92c4dde217b54d4eef5cc0f`.
- HEAD: `112e36f20fe8eb9e9cd19d6b149e76b07dab8fa3`.
- Read-only review. Only this report was created; it remains uncommitted.
- Restart closeout: HEAD is unchanged. Completed commands and probes below were not repeated.

## Findings

- **F2 — risk — stale consent permits page reads.** `lib/consent/use-consent.ts:19-24,37-41`; `entrypoints/sidepanel/App.vue:16-22`; `lib/panel/use-panel.ts:135-149`. Security / spec. Delay an initial stored-`accepted` snapshot. Complete a newer `declined` refresh first, then release the older reply. The probe observed `accepted: true` while storage still contained `declined`. `App.vue:22` consequently permits `PanelSurface` to mount and read the active page. The new boundary inherits an unguarded asynchronous consent reader. Reply ordering was controlled; occurrence in real Chrome remains unconfirmed. Fix: ignore stale consent reads using a generation/revision guard. Acceptance, decline, and storage changes must invalidate older reads. Add a rendered delayed-read regression asserting no panel mount or tab read after decline.

- **F1 — risk — queued fake destinations still produce false Sent outcomes.** `lib/connection/migrate.ts:35-38`; `lib/send/send.ts:205-210,113-119`; `lib/connection/migrate.test.ts:237-248`. Spec / coverage. Boot normalizes only the configured backend. Seed accepted consent and a queued `destination.backendId: 'fake'`; run migration, then `sendQueuedItem`. The probe returned `ok: true` and `ses_fake_1`, despite config becoming `opencode`. Outbox emptied and Sent gained the feedback, with zero HTTP calls. The new test checks destination capture, not delivery of existing queued feedback. This affects existing development profiles; fake remains unavailable to new public installs. Fix: quarantine stored nonselectable destinations at the production migration/delivery boundary with actionable errors. Keep feedback queued; do not silently reroute frozen feedback to opencode. Preserve explicit fake injection. Add migration → actual retry/delivery coverage for a preexisting fake destination.

- **F3 — risk — stale status overwrites the current connection's badge.** `lib/connection/messages.ts:42-45`; `lib/connection/use-connection.ts:38-43`; `lib/connection/messages.test.ts:277-295`. Correctness / spec. Start a delayed status request for endpoint A. Switch to B and complete a Connected check; the badge clears. Finish A with a transport error; the badge incorrectly becomes `1`. The probe reproduced this through `respondToConnectionRequest` with injected HTTP. Surface generation checks cannot undo the background badge write. Sequential direction tests miss this new race. Fix: apply badge results only for the current connection and current status generation. Pair/reset must invalidate older probes too. Add out-of-order endpoint/status regressions in both directions.

- **F4 — risk — two existing tests escape HTTP injection.** `lib/connection/use-connection.test.ts:95-105,124-130`; `lib/agent-backend/opencode-api.ts:271,333-334`; `vitest.config.ts:5-7`. Standards / test isolation. Both cases create `useConnection` without injected HTTP responses. A native-fetch deny probe intercepted `http://127.0.0.1:15001/api/info` from both cases. The backend-change case then failed at line 129. The normal green run therefore depends on a local server answering. No LLM request was observed; the escaped calls are server-info probes. Fix: inject supported-version or rejected-auth responses before creating `useConnection`. Add a deny-network test guard so omitted injection cannot silently reach a live server.

- **F7 — risk — malformed version suffixes still pass and persist credentials.** `lib/connection/status.ts:29-30`; `lib/agent-backend/opencode.ts:62-65,147-165`; `lib/connection/status.test.ts:15-36`. Lower-impact security hardening / spec. Probes accepted `2.0.32-.`, `2.0.32-beta..1`, and `2.0.32+.`. A service-seam probe paired `2.0.32-beta..1`, persisted its synthetic token, and reported Connected. These forms contain empty semver identifiers, so malformed-version rejection remains incomplete. No credential theft was demonstrated. Fix: check complete documented version syntax, including nonempty dot-separated identifiers. Keep supported prerelease/build positives. Test malformed suffixes through both ping and authenticate/persistence seams.

- **F5 — risk — rendered specs omit successful pairing click wiring.** `entrypoints/welcome/App.test.ts:87-158`; `entrypoints/welcome/App.vue:101-103`; `lib/onboarding/use-setup.test.ts:120-142`. Lower-impact spec / coverage. Specs show the remote warning and Cancel, then separately seed an already-connected token. None clicks “Pair this server” and reaches the visible handoff. Removing that click binding would escape these rendered specs. Supported-link upgrade recovery remains composable-only. The older remote-transition unit still manufactures Connected inside its mock. Fix: add rendered successful link submission and remote-confirmation flows using real connection messaging. Assert keyed persistence, remote policy, badge, Connected text, and the project handoff. Include supported-link recovery from upgrade.

- **F6 — risk — version-lookup negatives cannot detect removal of existing credentials.** `lib/connection/pairing-feature.test.ts:124-139,232-239`. Lower-impact spec / coverage. The post-redemption error test claims saved-token preservation, but seeds no token. It asserts two null tokens and default config only. Clearing existing tokens specifically after a version-lookup error would pass. The seeded-token case rejects redemption itself, never reaching version lookup. Fix: seed saved-endpoint, target-endpoint, and unrelated tokens plus nondefault config. Compare complete snapshots after successful redemption followed by unreachable or rejected `/api/info`.

## R1–R9 resolution matrix

`met` reflects inspected code and executed checks, not real-browser certification.

| Finding | Resolution | Evidence / remaining work |
|---|---|---|
| R1 — every remote origin requires confirmation | **met** | `service.ts:26-28,89-103` checks `credential.remote` independently of `allowRemote`. `pairing-feature.test.ts:189-229` covers A → B with saved remote policy enabled. `use-connection.test.ts:255-300` covers cancellation and retained A credentials. Neither B exchange nor B persistence occurs before confirmation. |
| R2 — upgrade retains entry and recheck | **met** | Both template conditions now include upgrade: `welcome/App.vue:65-66,80-84`. Rendered Check again recovery passes: `welcome/App.test.ts:87-107`. Supported-link recovery uses real connection messaging: `use-setup.test.ts:167-192`. The remaining rendered-link gap is F5, not an observed recovery error. |
| R3 — status drives badge both ways | **partial** | Sequential down → Connected → down passes. Reset badge and reset-error cases also pass: `messages.test.ts:277-318`. Out-of-order status completion can still paint the wrong badge: F3. |
| R4 — stored fake normalizes without breaking injection | **partial** | Boot awaits normalization before registering connection/delivery handlers: `background.ts:13-20`. `migrate.ts:35-42` changes stored selection, without a connection-wide fallback. Explicit fake-backed component/composable tests still pass. Existing queued fake destinations bypass that selection: F1. |
| R5 — rendered welcome/card specs | **partial** | New specs really mount SFCs, use real messaging, and assert rendered text/buttons. Card states, reopened setup, clipboard errors, and side-panel rejection are covered. Successful rendered pairing/handoff remains missing: F5. Real-Chrome gesture behavior remains unconfirmed. |
| R6 — parser, cancellation, lookup, and status negatives | **partial** | All six requested parser categories have units: `pairing-link.test.ts:97-159`. Real cancellation plus inert later confirmation is covered: `use-connection.test.ts:225-250`. Unpaired transport/incompatible probes and reset badge/errors were added. Post-redemption preservation remains weak: F6. Encoded-code round-trip and parser negatives lack background-message feature assertions. |
| R7 — panel consent boundary | **partial** | Initial unset/declined mounts perform no tab queries or tab subscriptions. Acceptance mounts the real surface; decline removes panel listeners. Markup, handlers, and styles moved without other behavioral edits. Stale consent replies remain unsafe: F2. The literal no-storage-listener criterion also retains the documented exception below. |
| R8 — strict supported version | **partial** | `2.`, `2.garbage`, incomplete versions, and unsupported majors now reject. Ping and authenticate tests exercise `2.garbage`. Malformed prerelease/build identifiers still pass and persist: F7. |
| R9 — endpoint/disclosure copy | **met** | `ConsentGate.vue:25-29` and `CHROMEWEBSTORE.md:116` use pairing-endpoint wording. `README.md:76` qualifies loopback with the remote policy. `CHROMEWEBSTORE.md:132` labels `15001` as legacy fallback only. No actual credentials were found in reviewed docs. |

### Locked onboarding decisions

| Decision | Check |
|---|---|
| Welcome tab plus compact card | Preserved. The card contains no pairing form and opens `welcome.html`. |
| Pairing link or bare code; no discovery scan | Preserved. The link supplies the origin; bare codes retain the configured endpoint. No port-scanning path was found. |
| Five connection states and one setup state machine | Preserved. Welcome and card still use `useSetup`. |
| Remote origin warning before exchange | Preserved for every non-loopback pairing link, including existing remote opt-in. |
| opencode 2.x and upgrade recovery | Basic version and recovery requirements work. Malformed suffix hardening remains F7. |
| Fake is test-only | User choices remain filtered. Boot selection migrates; stored queued destinations remain F1. |
| Install only; skip updates/development/admin | Existing gates and tests remain intact. No side panel opens from install. |
| Badge until the current connection is ready | Sequential behavior works. Concurrent stale results remain F3. |
| Project handoff on the dev site | Welcome shows handoff copy and imports no binding action. |

## Coverage notes

### Acceptance criteria

| Ticket | Coverage assessment |
|---|---|
| 018a | Remote-policy bypass, actual cancel, upgrade entry/recheck, and sequential badge directions are exercised. The badge race remains F3. |
| 018b | Boot selection, parser categories, strict-major basics, copy, and cancellation have substantive coverage. Actual stored-fake delivery is not exercised. Seeded post-redemption preservation and stricter suffix negatives remain missing. |
| 018c | The literal rendered-state/action criteria are covered. There are 19 rendered cases: eight welcome, seven card, four panel-consent cases. Broader end-to-end rendered success remains F5. |
| 018d | Initial consent states, accepted panel rendering, and listener removal are exercised. The specification says no storage listeners; tests instead allow one consent watcher. Stale consent reply ordering is not exercised. |

### Test quality and remaining negatives

- Public seams: pairing → keyed token → status → projects remains a substantive feature spec.
- Background messaging: status badge, reset, remote confirmation, and token-free responses have behavioral assertions.
- Rendered specs: SFCs are mounted, not stubbed replacements for welcome or the setup card.
- Shared copy: rendered text is checked, rather than constants alone. Several assertions reuse production copy constants.
- Mocked transition: `use-setup.test.ts:120-142` remains mapping-only evidence. Its mock creates the expected Connected state.
- Cancel naming: `pairing-feature.test.ts:158-173` still never invokes cancellation. The new composable spec supplies the missing contract.
- Version-error persistence: null-only checks do not prove existing credentials survive; see F6.
- Encoding: parser units decode `abc%2F123`. No feature spec asserts exact decode/re-encode at the redemption fetch seam.
- Parser negatives: malformed escapes, multiple links, and unsupported schemes stop at parser units. Add background-message no-fetch/no-write assertions.
- Consent wiring: acceptance is seeded or changed through storage. No rendered test clicks the actual disclosure Accept button.
- Panel split: copied project/session/outbox handlers and styles are unchanged. Existing composable/message tests still pass.
- Panel interactions: the new accepted-state spec checks visible surfaces, not every project/session/retry/discard click.
- Component config: Vue's Vite plugin enables SFC compilation. Happy-dom remains per-file; Node tests retain their environment.
- Network: new rendered specs inject responses or explicitly select fake. Two inherited Node cases escape injection; see F4.
- LLM use: no live LLM request was found. Observed native-fetch escape paths only request `/api/info`.

### Consent-listener exception

- `useConsent` adds one `storage.local.onChanged` listener before acceptance: `use-consent.ts:37-44`.
- That listener follows consent only; unrelated changes do not trigger panel reads.
- README closeout records this exception: `plans/018-onboarding-review-fixes/README.md:71-74`.
- Ticket 018d AC1 still claims zero storage listeners. Its literal wording is not met.
- Obtain approval for the consent-only exception and align the criterion before calling it fully met.
- This exception alone is not evidence of page capture. F2 is the separate consent-ordering risk.

## Security checks

| Check | Assessment |
|---|---|
| Remote A → B with `allowRemote=true` | No bypass remains. Each link carries its displayed origin and held credential. |
| Before remote confirmation | Link parsing and policy resolution precede authenticate. Neither URL/policy nor token is persisted beforehand. Initial probes concern the already-configured endpoint. |
| Cancel | Pending credential and warning clear. Later confirmation is inert; config and existing A credentials remain unchanged. |
| Token storage and keying | Tokens remain in extension-local storage under canonical `backendId@endpoint` keys. Pair responses expose no token. HTTP redirects remain refused. |
| Version gate | Authentication reads info before persistence. Basic malformed versions reject; malformed suffixes remain F7. |
| Consent | Initial panel data access is deferred. Panel tab/storage subscriptions are disposed on decline. F2 permits stale acceptance; one consent-only storage watcher remains documented. |
| Picker, capture, queue, delivery | Existing background consent checks remain unchanged. No removal was found in this diff. |
| XSS | Status/version/origin/warning use Vue text interpolation. No new HTML insertion, evaluation, or remote script path was found. |
| Clipboard | Only the pair command is written after a click. No clipboard reads occur. Rejection now renders actionable copy and has coverage. |
| `sidePanel.open` gesture | Call originates from the click handler. It still awaits `tabs.query` first: `lib/onboarding/panel.ts:4-8`. The rejection fallback is rendered-tested; Chrome gesture retention is unconfirmed. |
| Install gating | Install reason and development/admin gates remain tested. Unknown install type retains its existing fallback behavior. |
| Port scanning / fetch location | No scan was found. Production HTTP remains in background adapter paths; welcome/card use runtime messages. |
| Docs and logs | No actual token, key, or secret-bearing pairing link was found in reviewed changes. Probe credentials were synthetic and in-memory only. |

## Commands run and results

| Command / inspection | Result |
|---|---|
| `bun run compile` | **PASS**, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | **PASS**, exit 0; 78 files, 1,085 tests, Vitest 5.0.5, 3.80s. |
| Network-denied targeted Vitest run, below | **FAIL**, exit 1; 10 passed, one failed. Two native-fetch attempts were intercepted. |
| Network-denied full Vitest run, below | **FAIL**, exit 1; 77 files passed, one failed; 1,084 tests passed, one failed. |
| `git log --oneline '0ecd272^'..HEAD` | Read all eight commits: four implementation phases and four SHA-recording follow-ups. |
| `git diff '0ecd272^'...HEAD` and targeted file diffs | Reviewed all 33 changed files and their relevant callers. |
| `git diff --check '0ecd272^'...HEAD` | **PASS**, exit 0; no whitespace errors. |
| `git show '0ecd272^:entrypoints/sidepanel/App.vue'` compared with `PanelSurface.vue` | Only consent ownership, imports, and the root gate differ. Existing panel body/styles are retained. |
| Inline `bun -e` queued-fake probe | Reproduced F1: config became opencode; fake delivery returned success, emptied Outbox, and created Sent. |
| Inline `bun -e` delayed-consent probe | Reproduced F2: a stale accepted snapshot replaced newer declined state. Stored consent remained declined. |
| Inline `bun -e` delayed-status probe | Reproduced F3: B Connected cleared the badge; stale A unreachable restored `1`. |
| Inline `bun -e` parser/version probes | Requested parser edges behaved correctly. Malformed version suffixes passed; service-seam pairing persisted a synthetic token. |
| `git status --short` before report | Existing untracked `plans/017-onboarding/review.md` and `promo/` were left untouched. |
| Restart: `git status --short && git rev-parse HEAD && git log --oneline '0ecd272^'..HEAD` | Same HEAD and eight commits. Only this report joins the existing untracked paths. |

### Network-denied check

The preload replaces native fetch without changing repository files or making network requests.

```sh
node --input-type=module -e 'import {startVitest} from "vitest/node"; const guard = `globalThis.fetch = async (input) => { console.error("REVIEW_BLOCKED_NETWORK " + String(input)); throw new Error("REVIEW_NETWORK_BLOCKED"); };`; const ctx = await startVitest("test", [], {watch:false, execArgv:["--import=data:text/javascript," + encodeURIComponent(guard)], reporters:["minimal"]}); if (ctx) await ctx.close();'
```

The targeted run used `["lib/connection/use-connection.test.ts"]` and `reporters:["verbose"]`.

Failed case: `useConnection > reads the connection again when the backend changes`.

- Expected: `detail: 'Not paired'`.
- Received: `detail: 'Cannot reach the opencode server at http://127.0.0.1:15001'`.
- Additional intercepted case: `exposes the backend onboarding copy for the pairing hint`.

## Summary

- Not reviewed: real Chrome, packaging, live opencode, or store submission; no HEAD build was loaded.
- Counts: **0 blocker, 7 risk, 0 nit, 0 question**.
- Top approval blockers: **F2 consent ordering**, **F4 live-network-dependent tests**, **F3 stale badge writes**.
- Blocker-severity findings: none. F1 remains nonblocking for public release, as agreed in review 017.
