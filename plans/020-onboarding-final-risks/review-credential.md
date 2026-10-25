CHANGES REQUESTED

# 020e — Credential-scoped reset: targeted review

## Spec findings

- **020e-1 — risk — reset invalidation can change during the badge guard's awaited identity read.** `lib/onboarding/badge.ts:61-64`. The stamp is checked only before `await configuredConnectionKey()`. Hold reset A's first config snapshot. Start a newer A status/startup check, returning `/api/info` version `2.0.32`. Hold that check's final badge-guard config snapshot, then complete reset. A's token disappears, but reset cannot claim the newer check's generation. Release the guard read: the badge changes from `1` to `''`. Both variants reproduced; `writesAtReset: []` establishes that no badge write had started. This is outside the acknowledged already-started-write caveat. It leaves `ticket-05-reset-credential.md:3,14` incomplete. **Fix:** recheck the connection's invalidation stamp after the identity read, immediately before `write()`. Add status/startup regressions holding this post-HTTP read.

- **020e-2 — risk — invalidation also suppresses the Unpaired write needed to restore the badge.** `lib/onboarding/badge.ts:61`; `lib/connection/messages.ts:68-71`. Begin with A paired and badge `''`, as after Connected. Hold reset's first config snapshot, then start a newer A status/startup check. Hold that check's `resolveConfiguredConnection()` config snapshot before its token read. Complete reset, then release the check with `/api/info` version `2.0.32`. The check reads no token and returns `unpaired`. Reset skips `setSetupBadge()` because its generation snapshot lost. The new state-independent stamp check then suppresses the Unpaired badge write. Both variants leave `''`; `d237d04^` restores `1` under identical ordering. This loses the setup warning required by `product.md:63`. The isolated reset case at `messages.test.ts:300-307` misses this ordering. The documented coarse-generation divergence does not describe losing that warning. **Fix:** block invalidated Connected clears while allowing guarded non-Connected writes to restore `1`. Preserve the generation and connection guards. Add blank-badge, pre-token status/startup regressions.

## Standards

- Additional standards-only findings: none.
- Sources: `CONTEXT.md`, `product.md`, `plans/README.md`, repository patterns, and the global contract.
- Existing seams remain intact: runtime messaging, endpoint-keyed tokens, backend registry, and injected HTTP.
- Scope: all six files in `git diff 'd237d04^...HEAD'` were read.

## F3a-1 matrix

`PASS` means inspected code and executed local checks, not real-Chrome certification.

| Ordering | Result | Evidence |
|---|---|---|
| Reset-first A status; hold `/api/info`; remove A token; return `2.0.32` | **PASS** | `messages.test.ts:660-709`; independent probe: token null, badge `1` → `1`. |
| Reset-first A startup; same held HTTP ordering | **PASS** | `messages.test.ts:711-761`; actual `onStartup.trigger()`: token null, badge `1` → `1`. |
| Reset A; newer B status held across token removal | **PASS** | `messages.test.ts:763-815`; B Connected clears `1` → `''`. A token null; B token intact. |
| Reset A; newer B startup held across token removal | **PASS** | Independent `onStartup.trigger()` probe; B clears `1` → `''`; B token intact. |
| Reset-first A status/startup; hold final badge-guard identity read after HTTP | **FAIL: 020e-1** | Both probes clear `1` → `''` after reset. No badge write started before reset completed. |
| Blank badge; reset-first A status/startup; hold pre-token config read | **FAIL: 020e-2** | Both remain `''` despite A being Unpaired. Base restores `1`. |
| Fresh A check after reset | **PASS** | A Unpaired restores `1`. A newly stored synthetic token permits a later Connected clear. |

The first two regressions cover their requested ordering correctly.
Their HTTP barrier precedes the guard, so neither exercises 020e-1.
Both initialize the badge to `1`, so neither exercises 020e-2.

### Independent runtime observations

All eight direct-HEAD scenarios completed successfully as probes.
Every reset returned `{ ok: true }`; every A token was removed.
Every B token remained intact; every `writesAtReset` array was empty.
Startup invokes the registered handler through `fakeBrowser.runtime.onStartup.trigger()`.

| Probe | Mode | Badge after reset | Badge after held check | Fresh check / badge |
|---|---|---|---|---|
| status | `held-http-A` | `1` | `1` | `unpaired` / `1` |
| startup | `held-http-A` | `1` | `1` | `unpaired` / `1` |
| status | `held-http-B` | `1` | `''` | `connected` / `''` |
| startup | `held-http-B` | `1` | `''` | `connected` / `''` |
| status | `held-badge-identity-A` | `1` | `''` | `unpaired` / `1` |
| startup | `held-badge-identity-A` | `1` | `''` | `unpaired` / `1` |
| status | `blank-pre-token-A` | `''` | `''` | `unpaired` / `1` |
| startup | `blank-pre-token-A` | `''` | `''` | `unpaired` / `1` |

### Baseline comparison for 020e-2

Identical ordering held the check's config snapshot before `getToken()`.
HTTP returned `2.0.32`; status returned `unpaired` in both revisions.

| Revision | Probe | A token removed | Badge after reset | Badge after check |
|---|---|---|---|---|
| `d237d04^` | status | true | `''` | `1` |
| `d237d04^` | startup | true | `''` | `1` |
| HEAD | status | true | `''` | `''` |
| HEAD | startup | true | `''` | `''` |

The comparison read both revisions' `badge.ts` and `messages.ts` through `git show`.
`Bun.Transpiler` compiled them in memory; only import/export declarations were linked.
Production function bodies were unchanged; unchanged dependencies used HEAD.
No checkout, source edits, or temporary files were needed.
An initial data-URL harness returned `NameTooLong`; the in-memory linker rerun completed.

## Regression and coverage check

| Area | Result | Evidence |
|---|---|---|
| F3a | **Original regressions pass; adjacent gaps remain** | Four startup regressions at `messages.test.ts:430-538` pass. Reset-first extensions expose 020e-1 and 020e-2. |
| F3b | **No regression observed** | Original held-token-write regression and both delayed-identity regressions pass (`messages.test.ts:540-658`). Newer B status/startup probes remain authoritative. |
| F1a | **No regression observed** | Quarantine precedes admission recovery (`send.ts:80-81,111-112,215-219`). Cleanup error → migration → retry stays quarantined (`migrate.test.ts:292-348`). Admission remains queued; Sent empty; HTTP unused. |
| F7a | **No regression observed** | Numeric leading zeros reject at status, paired ping, authentication, and persistence seams. Exact raw-storage equality remains asserted (`pairing-feature.test.ts:169-190`). Valid versions still pass. |
| Consent | **No regression observed** | Both delivery checks remain (`send.ts:97,127`). All five delivery-consent cases pass, including mid-queue revocation and admitted-receipt recovery. |
| Delivery | **No regression observed** | Relevant suites pass. Captured destinations, frozen retries, selected-fake delivery, receipt recovery, and connection queues remain covered. Admitted opencode recovery still makes no HTTP call (`send.test.ts:1005-1029`). |
| Changed paths | **Requested examples covered; broader invariant incomplete** | Three new messaging regressions pass. Missing post-guard-await and blank-badge/pre-token orderings produce the two findings. |

## Scope and commands

| Item | Reviewed value |
|---|---|
| Base: `git rev-parse 'd237d04^'` | `a3eca8cfef746566b0b1669e57e54f4d914f049c` |
| HEAD: `git rev-parse HEAD` | `b94275689fd5bfab067dd612ce9aad04c19e1474` |
| `git log --oneline 'd237d04^..HEAD'` | `d237d04` plan; `051f1bf` implementation/tests; `b942756` closeout. |
| `git diff 'd237d04^...HEAD'` | Three code/test files and three plan files; all reviewed. |

| Command / check | Result |
|---|---|
| `git diff --check 'd237d04^...HEAD'` | **PASS**, exit 0. |
| `bun run compile` | **PASS**, exit 0; `vue-tsc --noEmit`. |
| `bun run test` | **PASS**, exit 0; 82 files, 1,126 tests; 3.28s. |
| `bun run test --exclude components/ArmPickerButton.test.ts --exclude entrypoints/sidepanel/PanelSurface.test.ts --exclude lib/background.test.ts` | **PASS**, exit 0; 79 files, 1,119 tests; 3.48s. |
| Targeted command below | **PASS**, exit 0; six files, 22 passed, 138 skipped; 648ms. |
| `bun run test lib/consent lib/send lib/onboarding lib/connection --reporter minimal` | **PASS**, exit 0; 21 files, 275 tests; 1.73s. |
| Network-denied command below | **PASS**, exit 0; 82 files, 1,126 tests; 3.49s. Zero `REVIEW_BLOCKED_NETWORK` lines. |
| Direct-HEAD runtime matrix below | Eight scenarios executed; requested examples pass, both additional orderings reproduce errors. |
| In-memory revision comparison | Four scenarios completed; 020e-2 is a demonstrated regression against the requested base. |

### Targeted regression command

```sh
bun run test lib/connection/messages.test.ts lib/connection/migrate.test.ts lib/send/send.test.ts lib/connection/status.test.ts lib/agent-backend/opencode.test.ts lib/connection/pairing-feature.test.ts -t 'startup check|obsolete reset|connection captured before|delayed identity read|reset removes the credential|another connection clear the badge after reset commits|stored fake admission|admitted opencode receipt|numeric prerelease|build identifiers with leading zeros|consent at delivery time' --reporter verbose
```

### Network-denied command

```sh
node --input-type=module -e 'import {startVitest} from "vitest/node"; const guard = `globalThis.fetch = async (input) => { console.error("REVIEW_BLOCKED_NETWORK " + String(input)); throw new Error("REVIEW_NETWORK_BLOCKED"); };`; const ctx = await startVitest("test", [], {watch:false, execArgv:["--import=data:text/javascript," + encodeURIComponent(guard)], reporters:["minimal"]}); if (ctx) await ctx.close();'
```

Network denial is JavaScript-level, not an OS firewall.
Repository setup also installs its deny-native-fetch guard, including its tested rejection path.
All review probes used synthetic responses and in-memory `fakeBrowser` storage.
No live server or LLM request was used.

### Direct-HEAD runtime matrix command

Run from the repository root. No files are created.
Assertions check the observed results, including the two reproduced errors.

```sh
bun --eval "$(cat <<'REVIEW'
import { mock } from "bun:test";
import { fakeBrowser } from "wxt/testing/fake-browser";
mock.module("wxt/browser", () => ({ browser: fakeBrowser }));
globalThis.fetch = async () => { throw new Error("REVIEW_NETWORK_BLOCKED"); };
const { registerBuiltinBackends } = await import("./lib/agent-backend/builtins.ts");
const { setOpenCodeFetch } = await import("./lib/agent-backend/opencode-api.ts");
const { registerConnectionHandler, requestConnectionStatus, requestReset } = await import("./lib/connection/messages.ts");
const { registerOnboardingHandler } = await import("./lib/onboarding/install.ts");
const { getToken, setToken } = await import("./lib/storage/auth.ts");
const { setSettings } = await import("./lib/storage/settings.ts");
registerBuiltinBackends();
const originalGet = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
const originalBadge = fakeBrowser.action.setBadgeText.bind(fakeBrowser.action);
const keyA = "opencode@http://127.0.0.1:15001";
const baseB = "http://127.0.0.1:4096", keyB = `opencode@${baseB}`;
const gate = () => {
  let release;
  const promise = new Promise(resolve => release = resolve);
  return { promise, release };
};
for (const probe of ["status", "startup"]) {
  for (const mode of ["held-http-A", "held-http-B", "held-badge-identity-A", "blank-pre-token-A"]) {
    fakeBrowser.storage.local.get = originalGet;
    fakeBrowser.action.setBadgeText = originalBadge;
    fakeBrowser.reset();
    registerConnectionHandler();
    registerOnboardingHandler();
    await setToken(keyA, "synthetic_a");
    await setToken(keyB, "synthetic_b");
    await fakeBrowser.action.setBadgeText({text: mode === "blank-pre-token-A" ? "" : "1"});
    const writes = [];
    fakeBrowser.action.setBadgeText = async details => {
      writes.push(details.text);
      return originalBadge(details);
    };
    const resetRead = gate(), resetEntered = gate(), http = gate(), httpEntered = gate();
    const badgeRead = gate(), badgeEntered = gate(), preToken = gate(), preTokenEntered = gate();
    let configReads = 0, heldBadge = false, armBadge = false;
    fakeBrowser.storage.local.get = async keys => {
      const snapshot = await originalGet(keys);
      if (Array.isArray(keys) && keys.includes("settings.backendId")) {
        const read = ++configReads;
        if (read === 1) {
          resetEntered.release();
          await resetRead.promise;
        } else if (mode === "blank-pre-token-A" && read === 3) {
          preTokenEntered.release();
          await preToken.promise;
        } else if (mode === "held-badge-identity-A" && armBadge && !heldBadge) {
          heldBadge = true;
          badgeEntered.release();
          await badgeRead.promise;
        }
      }
      return snapshot;
    };
    setOpenCodeFetch(async () => {
      httpEntered.release();
      await http.promise;
      armBadge = true;
      return new Response(JSON.stringify({version:"2.0.32"}), {headers:{"content-type":"application/json"}});
    });
    const reset = requestReset();
    await resetEntered.promise;
    if (mode === "held-http-B") await setSettings({serverUrl:baseB});
    const pending = probe === "status" ? requestConnectionStatus() : fakeBrowser.runtime.onStartup.trigger();
    if (mode === "blank-pre-token-A") await preTokenEntered.promise;
    else await httpEntered.promise;
    if (mode === "held-badge-identity-A") {
      http.release();
      await badgeEntered.promise;
    }
    resetRead.release();
    const resetResult = await reset;
    const afterReset = await fakeBrowser.action.getBadgeText({});
    const writesAtReset = [...writes];
    const tokenCleared = (await getToken(keyA)) === null;
    const bIntact = (await getToken(keyB)) !== null;
    http.release(); badgeRead.release(); preToken.release();
    const result = await pending;
    const afterProbe = await fakeBrowser.action.getBadgeText({});
    const fresh = await requestConnectionStatus();
    const afterFresh = await fakeBrowser.action.getBadgeText({});
    console.log(JSON.stringify({probe, mode, reset:resetResult, tokenCleared, bIntact, afterReset, writesAtReset, afterProbe, state:result?.state ?? null, freshState:fresh.state, afterFresh}));
    const expected = mode === "held-http-A" ? "1" : "";
    if (!resetResult.ok || !tokenCleared || !bIntact || afterProbe !== expected) throw new Error("Unexpected probe result");
  }
}
fakeBrowser.storage.local.get = originalGet;
fakeBrowser.action.setBadgeText = originalBadge;
REVIEW
)"
```

## Scope limits

- Surface caveat: probes omit corrective `connection/changed` refreshes from an open surface (`use-connection.ts:97-99`). Closing that surface during reset leaves the reproduced paths exposed. Real-Chrome timing remains unconfirmed.
- Workspace caveat: compile and tests used the supplied working tree. Test exclusions remove seven unrelated tests, not unrelated source edits.
- Ignored changes: uncommitted `ArmPickerButton`, `PanelSurface`, `entrypoints/background.ts`, `lib/background.test.ts`, and `promo/`.
- Prior reports: only the explicitly requested `review-reset.md` was read.
- Repository write: only this report, uncommitted. No code, tests, tickets, staging, commits, or pushes changed.

Not reviewed: real Chrome, packaging, live servers, or store submission; outside this read-only review.

- Severity counts: **0 blocker, 2 risk, 0 nit, 0 question**. Standards: **0**; Spec: **2 risk**.
- Top approval blockers: **020e-1**, stamp unchecked after the awaited guard; **020e-2**, Unpaired cannot restore a blank badge.
- Blocker-severity findings: **none**.
