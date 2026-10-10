# 008: Ship

**What to build:** The extension is publicly listed on the Chrome Web Store: in-product consent, a privacy policy, MIT license, README, store listing assets, and a submitted review package. The human performs the store submission steps.

**Blocked by:** 007 — Panel.

**Status:** done · bcaa003

- [x] First-run in-product disclosure + accept/decline (User Data FAQ #10); consent recorded
- [x] Privacy policy written (`PRIVACY.md`); Limited Use statement present; dashboard disclosures match actual behavior exactly — publishing the policy URL is a pending human step (see Outcome)
- [x] MIT LICENSE + README (architecture, localhost-only, privacy summary)
- [x] Listing prepared: description, screenshots (pending assets — see Outcome), 128×128 icon, category, support URL, test instructions naming the opencode server requirement
- [x] Host-access strategy decided (see `research-chrome-store.md` §2.1) and reflected in the manifest; permissions justified one by one
- [x] Submission packet ready (`CHROMEWEBSTORE.md`); human submits (fee, 2SV, visibility: public) — pending human steps recorded in the packet
- [x] Phase doc records the exact disclosure + justification text used (`CHROMEWEBSTORE.md` §2, §5)

## Outcome

Shipped:

- Consent module (`lib/consent/consent.ts`, `lib/consent/use-consent.ts`; storage key `consent.status` in `lib/storage/keys.ts`): status recorded in `chrome.storage.local` (`accepted` / `declined`, junk reads as undecided), `hasConsent` helper, exact gate error `Accept the feedback disclosure first`, privacy policy URL constant; Vue composable for surfaces (`loaded` / `status` / `accepted` / `accept` / `decline`) that follows choices made in another surface via `storage.local.onChanged`.
- Gate enforcement in the background (`lib/picker/messages.ts`, `lib/composer/messages.ts`): `armPickerOnTab` refuses before consent (covers every arm path: panel/popup message, `Alt+Shift+F`, context menu), `picker/captured` refuses (no screenshot capture, no pending pick), `queueComment` and `queueUrlOnly` refuse (nothing reaches the outbox). Composer open and list reads are not capture paths and stay ungated.
- First-run UI (`components/ConsentGate.vue`): prominent in-product disclosure with Accept / Decline, replacing the surface content in the side panel and popup until decided; declined state ("You declined. Browsertalk will not capture or send anything.") with "Review disclosure"; privacy policy link; existing surfaces untouched (component is additive, scoped styles only).
- Tests: +20 (365 total / 35 files vs 345 / 33): 6 consent storage, 7 consent composable, 4 picker gate (arm before accept, arm from surface, arm after decline, capture refused without screenshot), 3 composer gate (page comment, element comment with pending pick, URL-only). Existing picker/composer suites seed `acceptConsent()` in setup — the precondition is real, no assertions weakened.
- Real-browser check (headless Chromium + CDP, built extension, 17/17): fresh profile shows the disclosure replacing the panel; `picker/arm` and `composer/queue` answered `{"ok":false,"error":"Accept the feedback disclosure first"}`; outbox stayed empty; Accept revealed the panel and recorded `accepted`; gate stayed away across a reload; Decline rendered the declined state and recorded `declined`; Review re-opened the disclosure. Script: `/tmp/opencode/browsertalk-008-smoke/consent-smoke.mjs` (throwaway, not committed).
- Privacy + license + README: `PRIVACY.md` (what is collected, loopback-only destination, local storage, retention/deletion, exact Limited Use statement, contacts); `LICENSE` (MIT, `Copyright (c) 2026 afifsohaili` — adjust the holder if desired); `README.md` rewritten (surfaces, architecture summary, localhost-only note, privacy summary, MIT license, non-affiliation note).
- Submission packet (`CHROMEWEBSTORE.md`): exact dashboard texts — single purpose, per-permission justifications (`storage`, `sidePanel`, `contextMenus`, host `<all_urls>` justified per feature per the locked decision), remote code = "No", data usage disclosures (Website content + Web history), Limited Use certifications, privacy policy URL `https://github.com/afifsohaili/browsertalk/blob/main/PRIVACY.md` (hosting pending), test instructions naming the `opencode serve --port 15001` + pairing requirement, listing description/category/support URL, asset status, the exact in-product disclosure text, and the human-steps checklist.
- Build: `bun run compile` passes; 365/365 tests pass; `bun run build` emits; `bun run zip` → `.output/browsertalk-0.1.0-chrome.zip`.

Divergences:

- `activeTab` removed from manifest `permissions` (now `storage`, `sidePanel`, `contextMenus`; host `<all_urls>` untouched per the locked decision). It is unused with `<all_urls>` present — content-script matches, `captureVisibleTab`, and `tabs.sendMessage` are all covered by host access — and research checklist C.16 / the dashboard guidance say to delete permissions not required. No behavior change; revert is one line if the owner disagrees. `product.md` §Permissions still lists it (not rewritten per instructions).
- Screenshots not captured: the full-loop store screenshots depend on the project-binding UI, which does not exist yet (see Pending); listed as pending assets with a capture plan in `CHROMEWEBSTORE.md` §4, as the ticket allows.
- Consent is a minimal gate, not a capture-time interlock: an already-armed picker that loses consent mid-flight still opens the composer in the page, but `picker/captured` refuses to store anything. Arming and queueing are the enforced capture boundaries.
- `PRIVACY.md` links the GitHub repo as the policy home; hosting (repo public or Pages) is a human step.

Pending human steps (recorded in `CHROMEWEBSTORE.md` §6):

- Register the CWS developer account + pay the one-time fee; enable 2SV.
- Make the repo public / host the privacy policy URL.
- **Before public submission: ship the project-binding UI — closed by 007b** (`feat(panel): origin to project binding UI`, 342d0d7): the panel offers the server project list for an unbound origin, picking binds the origin (header shows it), "change" re-binds, and a queued feedback resolves the picked directory on the send path (unit integration + real-browser smoke, 21/21). Remaining: `CHROMEWEBSTORE.md` still carries the "not shipped yet" caveat (the line marked "Do not remove … until the binding UI ships") — drop it on the next packet touch, and the screenshots can now capture the full loop.
- Capture screenshots (and optionally the 440×280 promo tile).
- Upload the ZIP, fill the dashboard with the packet texts, set visibility Public, submit.

Other pending (carried):

- Popup `sent` counter still shows `0` (wiring to `countSent()` carried from 006/007).
- Stale stored sessions (deleted server-side) are still not pruned.
