CHANGES REQUESTED

# 020 — Onboarding final risks: final review

## Spec findings

- **F3b-1 — risk — a reset can clear another connection's token.** `lib/connection/messages.ts:60-61`; `lib/connection/service.ts:128-130`. Hold the first `configuredConnectionKey()` storage snapshot while A is configured. Switch to B and complete a Connected `connection/status`; then release A's snapshot. `resetConnection()` resolves config again, clears B's token, and returns `ok: true`. The captured key remains A, so the badge update is skipped. Executed probe: A's token survived; B's token disappeared; B's badge stayed `''`. The new preliminary read does not bind the actual reset to its captured connection. Fix: resolve the reset identity once. Use that identity for token removal and badge checks. Add a delayed-first-read regression.

- **F3b-2 — risk — a delayed final identity read still repaints another connection.** `lib/connection/messages.ts:62-64`. Reset A, then hold the final config read after it snapshots A. Switch to B, complete Connected status, and release the old A snapshot. `nextStatusGeneration()` then runs after B's check and makes the obsolete reset authoritative. Executed probe: badge `''` became `'1'`; B's token remained intact. No badge write was in flight when B's check completed. The documented in-flight-write limitation therefore does not cover this sequence. Fix: guard the asynchronous identity-read interval with the shared generation. Recheck before claiming a generation or painting. Add the delayed-final-read regression.

## Standards

- Additional standards-only findings: none.
- Sources checked: `CONTEXT.md`, `product.md`, `plans/README.md`, repository patterns, and the global contract.
- Existing seams remain intact: backend registry, endpoint-keyed tokens, injected HTTP, and runtime messaging.
- Production changes remain within 020's scope. The two reset findings concern incomplete requirements and correctness.

## F3a/F3b/F1a/F7a matrix

`met` means inspected code and executed local checks, not real-Chrome certification.

| Finding | Resolution | Evidence / remaining work |
|---|---|---|
| F3a — startup shares the badge guard | **met** | `badge.ts:66-77` and `messages.ts:50-54` share generation and connection checks. All four startup regressions pass: newer status, settings-only switch, pair, and reset (`messages.test.ts:430-538`). |
| F3b — obsolete reset preserves B's badge and token | **partial** | The original held-token-write regression passes (`messages.test.ts:540-570`). Holding either config-read response exposes F3b-1 or F3b-2. Neither read interleaving has a committed regression. |
| F1a — quarantine precedes admission recovery | **met** | `send.ts:80-81,111-112,215-219` checks the stored backend before the admission bypass. Cleanup error → fake admission → migration → retry retains queued feedback and admission. No Sent entry or HTTP occurs (`migrate.test.ts:292-348`). Real `opencode` receipt recovery passes without HTTP (`send.test.ts:1005-1029`). Existing selected-fake delivery tests pass. |
| F7a — strict numeric prereleases | **met** | Numeric leading zeros reject at the shared gate, paired ping, authenticate, and persistence. Coverage: `status.test.ts:39-45`, `opencode.test.ts:73-88,463-475`, `pairing-feature.test.ts:169-190`. An additional seeded-target probe preserves existing credentials on both rejects. Valid prerelease/build forms pass ping and pairing. |

## Coverage, security, and regressions

| Area | Assessment |
|---|---|
| Changed-path coverage | All 12 added tests passed in a targeted run. Full and unrelated-test-exclusion suites also passed. |
| Badge boundaries | Startup tests exercise `onStartup`, real connection messaging, and controlled HTTP ordering. The reset test holds a token write, but neither config read. |
| Missing reset regressions | Delay the initial A snapshot while switching to Connected B. Separately delay the final A snapshot after token removal. Assert B's token and badge both survive. |
| Admission assertions | The regression creates the fake admission through actual delivery, rather than seeding a receipt. It rejects cleanup, migrates, retries, and checks queued state, admission retention, Sent, and HTTP. |
| Version assertions | Persistence negatives compare complete config and raw-storage snapshots. The additional probe seeds an existing target token, covering replacement as well as creation. |
| Credential integrity | F3b-1 removes an unrelated endpoint's credential. No credential disclosure was demonstrated. Endpoint policy, redirect refusal, and background-only HTTP were not weakened by this diff. |
| Consent and delivery | Existing consent, receipt recovery, idempotency, and explicitly injected fake tests pass. Quarantine does not reroute feedback or discard its admission. |
| Network isolation | Native fetch remained denied. All review probes injected synthetic HTTP; no live server or LLM request was used. |
| Documented limits | Main-version leading zeros remain outside F7a's scope. Already-started badge writes remain non-retractable; F3b-2 occurs before any reset badge write starts. |

## Commands and results

| Command / check | Result |
|---|---|
| `git rev-parse '5b48cd1^'` | Base: `26848e5308ffa8e2d3a2b6f201b1f8d63169b54a`. |
| `git rev-parse HEAD` | Reviewed HEAD: `8fa9f093f3c578586e2f8eeab12568e2df766f9c`. |
| `git log --oneline '5b48cd1^..HEAD'` | Read all seven commits: plan, three code/test commits, and three closeout commits. |
| `git diff '5b48cd1^...HEAD'` | Reviewed all 15 changed files and relevant callers. |
| `git diff --check '5b48cd1^...HEAD'` | **PASS**, exit 0. |
| `bun run compile` | **PASS**, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | **PASS**, exit 0; 82 files, 1,121 tests; 3.52s. |
| `bun run test --exclude components/ArmPickerButton.test.ts --exclude entrypoints/sidepanel/PanelSurface.test.ts --exclude lib/background.test.ts` | **PASS**, exit 0; 79 files, 1,114 tests; 3.28s. |
| Targeted 020 regression command, below | **PASS**, exit 0; six files, 12 passed, 143 skipped; 374ms. |
| 019 network-denied preload command, below | **PASS**, exit 0; 82 files, 1,121 tests; 3.50s. Zero `REVIEW_BLOCKED_NETWORK` lines. Repository deny guard also remained active. |
| Inline Bun reset probes, below | **REPRODUCED F3b-1 and F3b-2**, through runtime messaging. |
| Inline Bun version/persistence probe | **PASS**, eight versions across the gate, paired ping, and seeded pairing persistence. Both invalid versions preserved complete storage, including an existing target token. |

### Targeted 020 regressions

```sh
bun run test lib/connection/messages.test.ts lib/connection/migrate.test.ts lib/send/send.test.ts lib/connection/status.test.ts lib/agent-backend/opencode.test.ts lib/connection/pairing-feature.test.ts -t 'startup check|obsolete reset|stored fake admission|admitted opencode receipt|numeric prerelease|build identifiers with leading zeros' --reporter verbose
```

### Network-denied command

```sh
node --input-type=module -e 'import {startVitest} from "vitest/node"; const guard = `globalThis.fetch = async (input) => { console.error("REVIEW_BLOCKED_NETWORK " + String(input)); throw new Error("REVIEW_NETWORK_BLOCKED"); };`; const ctx = await startVitest("test", [], {watch:false, execArgv:["--import=data:text/javascript," + encodeURIComponent(guard)], reporters:["minimal"]}); if (ctx) await ctx.close();'
```

### Reset reproduction

Run from the repository root. Storage changes below affect only the in-memory `fakeBrowser`.

```sh
bun --eval '
import { mock } from "bun:test";
import { fakeBrowser } from "wxt/testing/fake-browser";
mock.module("wxt/browser", () => ({ browser: fakeBrowser }));
globalThis.fetch = async () => { throw new Error("REVIEW_NETWORK_BLOCKED"); };
const { registerBuiltinBackends } = await import("./lib/agent-backend/builtins.ts");
const { setOpenCodeFetch } = await import("./lib/agent-backend/opencode-api.ts");
const { registerConnectionHandler, requestConnectionStatus, requestReset } = await import("./lib/connection/messages.ts");
const { getToken, setToken } = await import("./lib/storage/auth.ts");
const { getSettings, setSettings } = await import("./lib/storage/settings.ts");
registerBuiltinBackends();
const originalGet = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
const A = "http://127.0.0.1:15001", B = "http://127.0.0.1:4096";
for (const heldRead of [1, 3]) {
  fakeBrowser.storage.local.get = originalGet;
  fakeBrowser.reset();
  registerConnectionHandler();
  await setToken(`opencode@${A}`, "synthetic_a");
  await setToken(`opencode@${B}`, "synthetic_b");
  setOpenCodeFetch(async () => new Response(JSON.stringify({version:"2.0.32"}), {headers:{"content-type":"application/json"}}));
  let releaseRead, enteredRead;
  const gate = new Promise(resolve => releaseRead = resolve);
  const entered = new Promise(resolve => enteredRead = resolve);
  let settingsReads = 0;
  fakeBrowser.storage.local.get = async keys => {
    const snapshot = await originalGet(keys);
    if (Array.isArray(keys) && keys.includes("settings.backendId")) {
      settingsReads++;
      if (settingsReads === heldRead) { enteredRead(); await gate; }
    }
    return snapshot;
  };
  const reset = requestReset();
  await entered;
  await setSettings({serverUrl:B});
  const newer = await requestConnectionStatus();
  const before = await fakeBrowser.action.getBadgeText({});
  releaseRead();
  const result = await reset;
  const evidence = {
    heldRead, newerState:newer.state, before,
    after:await fakeBrowser.action.getBadgeText({}), reset:result,
    currentEndpoint:(await getSettings()).serverUrl,
    originalTokenIntact:(await getToken(`opencode@${A}`)) === "synthetic_a",
    currentTokenIntact:(await getToken(`opencode@${B}`)) === "synthetic_b"
  };
  if (heldRead === 1 ? evidence.currentTokenIntact : evidence.after !== "1") throw new Error("Not reproduced: " + JSON.stringify(evidence));
  console.log(JSON.stringify(evidence));
}
fakeBrowser.storage.local.get = originalGet;
'
```

Observed output:

```json
{"heldRead":1,"newerState":"connected","before":"","after":"","reset":{"ok":true},"currentEndpoint":"http://127.0.0.1:4096","originalTokenIntact":true,"currentTokenIntact":false}
{"heldRead":3,"newerState":"connected","before":"","after":"1","reset":{"ok":true},"currentEndpoint":"http://127.0.0.1:4096","originalTokenIntact":false,"currentTokenIntact":true}
```

### Additional version probe inputs

| Versions | Gate / paired ping / pairing persistence |
|---|---|
| `2.0.32-01`, `2.0.32-beta.01` | Rejected / incompatible / rejected with exact storage equality. |
| `2.0.32`, `2.1.0-beta`, `2.0.0-rc.1+build.5`, `2.0.0+build.01` | Accepted / Connected / successful pairing. |
| `2.0.0-0.0`, `2.0.0-01alpha.0+01` | Accepted / Connected / successful pairing. |

## Scope and closeout

- Repository writes: only this report; uncommitted. No code, tests, tickets, or commits changed.
- Ignored scope: unrelated `ArmPickerButton`, `PanelSurface`, `background.ts`, `lib/background.test.ts`, and `promo/` changes.
- Prior reports: only the requested 019 report was read.
- Workspace caveat: compile and suites used the supplied working tree. Exclusions remove seven unrelated tests, not source edits.
- Runtime caveat: the two reset interleavings were reproduced locally. Occurrence in real Chrome remains unconfirmed.

Not reviewed: real Chrome, packaging, live servers, or store submission; these are outside this read-only review.

- Severity counts: **0 blocker, 2 risk, 0 nit, 0 question**.
- Top approval blockers: **F3b-1 mismatched reset identity** and **F3b-2 stale final identity read**.
- Blocker-severity findings: **none**.
