CHANGES REQUESTED

# 020d — Reset identity: final review

## Spec findings

- **F3a-1 — risk — reset leaves a newer same-connection probe authoritative after removing its token.** `lib/connection/messages.ts:63-69`; `lib/onboarding/badge.ts:28-30`. Start reset A and hold its first config snapshot. Start an A startup/status check, holding `/api/info` after its token snapshot. Release reset and await successful token removal. Then release `/api/info` with version `2.0.32`. The check advanced the generation during reset, so reset cannot claim it. The check subsequently clears the badge despite A having no stored token. Executed probes reproduce both startup and runtime-status variants. The baseline retains `'1'` under identical ordering. A fresh check returns `unpaired` and restores `'1'`. This regresses `ticket-01-badge-races.md:30`: reset must invalidate an in-flight startup check. No badge write was already in flight; the HTTP response remained held until reset completed. **Fix:** invalidate checks using the removed credential when reset commits, scoped to that connection. Keep newer B checks authoritative. Add reset-first startup and status regressions.

## Standards

- Additional standards-only findings: none.
- Sources: `CONTEXT.md`, `product.md`, `plans/README.md`, repository patterns, and the global contract.
- Existing seams remain intact: runtime messaging, backend registry, endpoint-keyed tokens, and injected HTTP.
- All `resetConnection` callers now provide the captured identity.
- The requested identity fix is implemented; F3a-1 concerns its generation interaction.

## F3b matrix

`met` means inspected code and executed local checks, not real-Chrome certification.

| Requirement / ordering | Result | Evidence |
|---|---|---|
| F3b-1: hold the first A identity snapshot; connect B; release A | **met** | `messages.test.ts:575-612` passes. Independent runtime probe: A token cleared, B token intact, badge `''` before and after release. |
| F3b-2: clear A; hold the final A identity snapshot; connect B; release A | **met** | `messages.test.ts:614-658` passes. Independent runtime probe: A token cleared, B token intact, badge `''` before and after release. |
| Original F3b: hold A's token write; connect B; finish reset | **met** | `messages.test.ts:540-573` passes. B's stored token and cleared badge survive. |
| Resolve reset identity once | **met** | `messages.ts:64-65` captures the identity and passes it into `resetConnection(connection)`. `service.ts:128-130` clears the canonicalized captured identity. |
| No post-clear config read retargets token removal | **met** | `messages.ts:67` uses the post-clear read only for badge comparison. `resolve.ts:25-27` rereads remote policy before removal, without replacing the captured identity. |
| Guard the final identity-read interval | **met for Connected B** | Generation is captured before the first await. The synchronous claim rejects generations advanced by B's status check. Same-connection invalidation remains incomplete: F3a-1. |

Independent runtime probe output:

```json
{"case":"F3b-1","newerState":"connected","reset":{"ok":true},"before":"","after":"","originalTokenCleared":true,"currentTokenIntact":true}
{"case":"F3b-2","newerState":"connected","reset":{"ok":true},"before":"","after":"","originalTokenCleared":true,"currentTokenIntact":true}
```

## Regression and coverage check

| Area | Result | Evidence |
|---|---|---|
| F3a | **regression: F3a-1** | The four original startup regressions pass (`messages.test.ts:430-538`). Reset-first startup/status probes reproduce the missing reverse ordering. |
| F1a | **no regression observed** | Stored-fake quarantine still precedes admission recovery (`send.ts:80-81,111-112,215-219`). Cleanup error → fake admission → migration → retry remains quarantined. The admission survives; Sent stays empty; HTTP stays unused (`migrate.test.ts:292-348`). |
| F7a | **no regression observed** | Numeric leading zeros still reject at the gate, paired ping, authentication, and pairing persistence. Complete storage equality remains asserted for rejected pairing (`pairing-feature.test.ts:169-190`). Valid-version and ordinary-pairing tests also pass. |
| Consent | **no regression observed** | Both delivery consent checks remain (`send.ts:97,127`). Revoke-before-admission, revoke-mid-queue, and admitted-receipt recovery tests pass (`send.test.ts:1299-1396`). |
| Delivery | **no regression observed** | Captured destinations, retry identity, admission recovery, selected-fake delivery, and connection queues pass. Admitted `opencode` recovery still makes no HTTP call (`send.test.ts:1005-1029`). |
| Changed paths | **covered, with one missing ordering** | Both added config-read regressions pass through runtime messaging. Existing reset success/error coverage and direct-service tests pass. No committed test covers reset → same-connection startup/status → reset completion. |
| Credential integrity | **requested fix met** | Both delayed-read probes clear A only and preserve B. The additional finding concerns badge correctness, not token disclosure or B-token removal. |

## Scope and commands

| Item | Reviewed value |
|---|---|
| Base: `git rev-parse '8d4cb76^'` | `8fa9f093f3c578586e2f8eeab12568e2df766f9c` |
| HEAD: `git rev-parse HEAD` | `a3eca8cfef746566b0b1669e57e54f4d914f049c` |
| Commits: `git log --oneline '8d4cb76^'..HEAD` | `8d4cb76` plan; `5551675` implementation/tests; `a3eca8c` closeout. |
| Diff: `git diff '8d4cb76^'...HEAD` | All eight changed files reviewed, including docs and relevant callers. |

| Command / check | Result |
|---|---|
| `git diff --check '8d4cb76^'...HEAD` | **PASS**, exit 0. |
| `bun run compile` | **PASS**, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | **PASS**, exit 0; 82 files, 1,123 tests; 3.33s. |
| `bun run test --exclude components/ArmPickerButton.test.ts --exclude entrypoints/sidepanel/PanelSurface.test.ts --exclude lib/background.test.ts` | **PASS**, exit 0; 79 files, 1,116 tests; 3.45s. |
| Targeted regression command below | **PASS**, exit 0; six files, 14 passed, 143 skipped; 483ms. |
| `bun run test lib/consent lib/send lib/onboarding lib/connection --reporter minimal` | **PASS**, exit 0; 21 files, 272 tests; 1.69s. |
| Network-denied command below | **PASS**, exit 0; 82 files, 1,123 tests; 3.42s. Zero `REVIEW_BLOCKED_NETWORK` lines. |
| Independent four-scenario runtime probe | **F3b-1/F3b-2 pass; F3a-1 reproduced** for status and startup. Only in-memory `fakeBrowser` storage changed. |
| In-memory baseline/HEAD comparison | **Regression demonstrated** for both probe types. Base badge remains `'1'`; HEAD badge becomes `''` after token removal. |

### Targeted regression command

```sh
bun run test lib/connection/messages.test.ts lib/connection/migrate.test.ts lib/send/send.test.ts lib/connection/status.test.ts lib/agent-backend/opencode.test.ts lib/connection/pairing-feature.test.ts -t 'startup check|obsolete reset|connection captured before|delayed identity read|stored fake admission|admitted opencode receipt|numeric prerelease|build identifiers with leading zeros' --reporter verbose
```

### Network-denied command

```sh
node --input-type=module -e 'import {startVitest} from "vitest/node"; const guard = `globalThis.fetch = async (input) => { console.error("REVIEW_BLOCKED_NETWORK " + String(input)); throw new Error("REVIEW_NETWORK_BLOCKED"); };`; const ctx = await startVitest("test", [], {watch:false, execArgv:["--import=data:text/javascript," + encodeURIComponent(guard)], reporters:["minimal"]}); if (ctx) await ctx.close();'
```

Network denial is JavaScript-level, not an OS firewall. Repository setup also installs its deny-native-fetch guard. Review probes use injected synthetic responses; no live server or LLM request was used.

## F3a-1 reproduction

Run from the repository root. This command reproduced both variants without creating files.

```sh
bun --eval '
import { mock } from "bun:test";
import { fakeBrowser } from "wxt/testing/fake-browser";
mock.module("wxt/browser", () => ({ browser: fakeBrowser }));
globalThis.fetch = async () => { throw new Error("REVIEW_NETWORK_BLOCKED"); };
const { registerBuiltinBackends } = await import("./lib/agent-backend/builtins.ts");
const { setOpenCodeFetch } = await import("./lib/agent-backend/opencode-api.ts");
const { registerConnectionHandler, requestConnectionStatus, requestReset } = await import("./lib/connection/messages.ts");
const { registerOnboardingHandler } = await import("./lib/onboarding/install.ts");
const { getToken, setToken } = await import("./lib/storage/auth.ts");
registerBuiltinBackends();
const originalGet = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
const key = "opencode@http://127.0.0.1:15001";
const gate = () => {
  let release;
  const promise = new Promise(resolve => release = resolve);
  return { promise, release };
};
for (const probe of ["status", "startup"]) {
  fakeBrowser.storage.local.get = originalGet;
  fakeBrowser.reset();
  registerConnectionHandler();
  registerOnboardingHandler();
  await setToken(key, "synthetic_a");
  await fakeBrowser.action.setBadgeText({text:"1"});
  const readGate = gate(), readEntered = gate(), httpGate = gate(), httpEntered = gate();
  let held = false;
  fakeBrowser.storage.local.get = async keys => {
    const snapshot = await originalGet(keys);
    if (!held && Array.isArray(keys) && keys.includes("settings.backendId")) {
      held = true;
      readEntered.release();
      await readGate.promise;
    }
    return snapshot;
  };
  setOpenCodeFetch(async () => {
    httpEntered.release();
    await httpGate.promise;
    return new Response(JSON.stringify({version:"2.0.32"}), {headers:{"content-type":"application/json"}});
  });
  const reset = requestReset();
  await readEntered.promise;
  const pending = probe === "status" ? requestConnectionStatus() : fakeBrowser.runtime.onStartup.trigger();
  await httpEntered.promise;
  readGate.release();
  const resetResult = await reset;
  const afterReset = await fakeBrowser.action.getBadgeText({});
  httpGate.release();
  await pending;
  const tokenCleared = (await getToken(key)) === null;
  const afterProbe = await fakeBrowser.action.getBadgeText({});
  if (!resetResult.ok || !tokenCleared || afterReset !== "1" || afterProbe !== "") {
    throw new Error("Reset race did not reproduce");
  }
  console.log(JSON.stringify({probe, reset:resetResult, tokenCleared, afterReset, afterProbe}));
}
fakeBrowser.storage.local.get = originalGet;
'
```

Observed output:

```json
{"probe":"status","reset":{"ok":true},"tokenCleared":true,"afterReset":"1","afterProbe":""}
{"probe":"startup","reset":{"ok":true},"tokenCleared":true,"afterReset":"1","afterProbe":""}
```

### Baseline comparison

The comparison loaded four base modules directly through `git show`, transpiled entirely in memory:

- `lib/connection/messages.ts`
- `lib/connection/service.ts`
- `lib/onboarding/badge.ts`
- `lib/onboarding/install.ts`

Unchanged dependencies used HEAD. Import/export declarations were linked in memory; production function bodies were unchanged. No checkout, source edits, or temporary files were needed.

| Revision | Probe | Reset result | Token cleared | Badge after reset | Badge after held probe |
|---|---|---|---|---|---|
| `8d4cb76^` | status | `ok: true` | true | `'1'` | `'1'` |
| `8d4cb76^` | startup | `ok: true` | true | `'1'` | `'1'` |
| HEAD | status | `ok: true` | true | `'1'` | `''` |
| HEAD | startup | `ok: true` | true | `'1'` | `''` |

## Scope limits

- Surface caveat: probes have no surface issuing a corrective `connection/changed` refresh. An open surface can mask the error through `use-connection.ts:97-99`. Closing that surface during reset leaves this path exposed. Real-Chrome timing remains unconfirmed.
- Workspace caveat: compile and tests used the supplied working tree. Test exclusions remove seven unrelated tests, not unrelated source edits.
- Ignored changes: `ArmPickerButton`, `PanelSurface`, `entrypoints/background.ts`, `lib/background.test.ts`, and `promo/`.
- Prior reports: only the explicitly requested `plans/020-onboarding-final-risks/review.md` was read.
- Repository write: only this report, uncommitted. No code, tests, tickets, staging, commits, or pushes changed.

Not reviewed: real Chrome, packaging, live servers, or store submission; outside this read-only review.

- Severity counts: **0 blocker, 1 risk, 0 nit, 0 question**.
- Top approval blocker: **F3a-1 — same-connection startup/status can clear the badge after reset removes its token**.
- Blocker-severity findings: **none**.
