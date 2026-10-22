# Chrome Web Store submission packet

Exact texts for the Developer Dashboard, plus the assets and human steps. Keep this file, `PRIVACY.md`, and the extension's actual behavior in sync: a mismatch between dashboard disclosures, the privacy policy, and behavior is the enforced failure mode (research §2.2).

Status: prepared for review; not yet submitted. Human steps are listed at the bottom.

## 1. Store listing

| Field | Value |
|---|---|
| Name | opencode Browsertalk |
| Short description (manifest, 57/132 chars) | Send browser feedback straight into opencode sessions. |
| Category | Developer Tools |
| Language | English |
| Homepage URL | https://github.com/afifsohaili/browsertalk |
| Support URL | https://github.com/afifsohaili/browsertalk/issues |
| Visibility | Public (human step) |

### Detailed description (exact text)

> Browsertalk turns browser feedback into opencode work. Browse and test your app, point at the element that looks wrong (or comment on the whole page), and the feedback lands in the opencode session bound to that project — with the URL, selector, element facts, and an optional screenshot crop the agent needs to find the code.
>
> - Point at an element or comment on the page: hover, click, type, send.
> - Point at several elements on one page: hold Cmd (Ctrl on Windows/Linux), click up to five, comment once, send one feedback with an element set.
> - Facts captured automatically: URL and query parameters, page title, tag and classes, CSS selector, text, key attributes, bounding box.
> - Optional element screenshot crop per element (up to four), detected component name, and a small ARIA/computed-style subset.
> - Sessions per project: one per day, or sticky, configurable per backend.
> - Queue delivery: feedback waits for the agent to be idle instead of interrupting it.
> - Remote servers: off by default; settings can allow a server on another machine (encrypted links like Tailscale or an SSH tunnel recommended).
> - Loopback by default: feedback goes only to the opencode server you pair with. No external servers, no analytics.
> - Open source (MIT).
>
> Requires the opencode 2.x CLI/server, running locally.
>
> Browsertalk is an independent project and is not affiliated with, endorsed by, or produced by the opencode project.

## 2. Privacy practices tab

### Single purpose (exact text)

> Capture browser feedback and send it to the opencode coding-agent session bound to the page's project.

### Permission justifications (exact text, one per dashboard field)

- **storage**: Stores the extension's own settings, the pairing token for the user's local opencode server, origin-to-project bindings, session references, the queued outbox, and recent sent summaries. All of it stays in the browser on the user's machine.
- **sidePanel**: The side panel is the extension's primary interface: the current project and session, the session chooser (create a fresh session or continue an existing one), the comment box for page-level feedback, the outbox, and the sent list. Outbox and sent rows show the element count for feedback that carries an element set.
- **contextMenus**: Adds a right-click menu item, "Browsertalk: point at element", that starts element selection on the current page.
- **Host permission `<all_urls>`** (locked decision: keep; justify per feature):
  > The picker must work on any dev site the user is testing; the extension cannot know the user's sites in advance. Host access is used to (1) run the picker content script on the active page to highlight elements and capture the selected elements' facts, (2) capture the visible tab for the optional element screenshot crops, (3) run a small MAIN-world script that reports in-page navigation (`pushState`/`replaceState`) so the picker closes when the page routes, and (4) call the user's own opencode server — loopback by default, or another machine the user explicitly allows in settings (off by default). No page data is read until the user explicitly arms the picker or comments on the page, and feedback is sent only to the user's own server. The route script adds no permission and reads no page content; it wraps the page's own history calls and dispatches one event.

Rationale: `activeTab` was removed from the manifest in this phase — it is unused with `<all_urls>` present (content script matches, `captureVisibleTab`, and `tabs.sendMessage` are all covered by host access), and the dashboard guidance says to delete permissions not required (research §2.1, checklist C.16).

### Remote code

Select: **No, I am not using remote code.**

The extension executes only code bundled in the package (WXT/Vite build). It never `eval`s or injects scripts from a server; the opencode server receives data only. Both content scripts — the picker and the MAIN-world route bridge — ship in the package; the route bridge wraps the page's own `history` calls and dispatches a local event.

### Data usage disclosures

Select the categories closest to these (the literal dashboard label set is not published — confirm at submission; research §2.2):

- **Website content** — the page and element facts (URL, title, DOM details, text, screenshot crop) captured when the user sends feedback.
- **Web history** — the URL of the page the feedback is about.

Only pages the user explicitly comments on are captured; nothing is recorded in the background. Do not select categories that do not apply (health, financial, location, personal communications, authentication information, PII).

### Limited Use certifications

Check all three (all true for this extension):

- Does not sell or transfer user data to third parties, outside of approved use cases.
- Does not use or transfer user data for purposes unrelated to the item's single purpose.
- Does not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

`https://github.com/afifsohaili/browsertalk/blob/main/PRIVACY.md`

**Pending human step:** make the repository public (or host the policy elsewhere) so this URL resolves before submission.

## 3. Test instructions (dashboard "Test instructions" tab, exact text)

> Browsertalk requires opencode 2.x running on the reviewer's machine; the extension talks only to the server it is paired with — 127.0.0.1 by default, or another machine the reviewer explicitly allows in settings (off by default).
>
> 1. Install opencode 2.x from https://opencode.ai. `opencode --version` must start with `2`; on 1.x run `opencode upgrade`. Start the server: `opencode serve` defaults to port 4096, while the background service uses a dynamic port and `opencode service status` prints its URL. Do not type a port anywhere — the pairing link in the next step carries it.
> 2. In a terminal, run `opencode pair`. Copy the link it prints. Do not open it; links expire in 5 minutes.
> 3. Click the Browsertalk toolbar icon. A fresh install opens the welcome tab; if it was closed, open the side panel, accept the first-run feedback disclosure, then click "Finish setup". Paste the pairing link or the bare code into "Pairing link or code" and click "Pair". The page shows "Connected: opencode <version> at <host>". The link supplies the server URL; the advanced server URL field is only needed for a bare code.
> 4. Open the page under test on a local dev server, then open the side panel from the toolbar icon. Accept the disclosure if it is still showing. Click "Choose project" and pick a project from the list the server returns; this binds the current origin to that project.
> 5. Arm the picker with "Point at element", Alt+Shift+F, or right-click → "Browsertalk: point at element". Hover highlights elements; click one, type a comment, press Queue (or Enter). For several elements on one page: hold Cmd (Ctrl on Windows/Linux), click up to five, release, then comment once and Queue.
> 6. The feedback appears in the side panel's Outbox and is delivered to the opencode session for the picked project.
>
> The reviewer path exercises the full loop: pair → Connected → pick a project on a page → send → feedback in the session. A connection failure names its next action ("Cannot reach opencode", "Not paired", "Pairing token rejected", "Wrong opencode version"); "Test connection" and "Forget pairing" live in the options page.

Why the path is safe: every network call goes to the opencode server the reviewer started. Nothing is captured before the reviewer accepts the disclosure, and no page is read until the picker is armed or a page comment is sent. The extension executes only bundled code.

## 4. Listing assets

| Asset | Status |
|---|---|
| 128×128 store icon | Ready — `public/icon/128.png` |
| Screenshots 1280×800+ (1-5) | **Pending.** Capture the full loop now that the binding UI ships: (1) welcome tab with the pairing step, (2) side panel with target + outbox, (3) picker highlight on a page, (4) inline composer, (5) sent list. |
| Small promo tile 440×280 | **Pending** (optional in the dashboard). |
| YouTube video | Not planned. |

## 5. In-product disclosure (recorded exact text)

From `components/ConsentGate.vue` — the first-run gate; also used as the "Review disclosure" view after a decline:

> Before you start
>
> Browsertalk captures feedback you choose to send:
> - your comment
> - facts about the page and element — URL, title, DOM details, optional element screenshot
>
> It sends them only to the opencode server you pair with — the pairing link carries its address. Loopback is the default; another machine only if you turn on the remote-server option in settings. Nothing goes to external servers. No analytics.
>
> Nothing is captured before you accept.
>
> [Accept] [Decline]
>
> Read the privacy policy

Declined state:

> You declined. Browsertalk will not capture or send anything.
>
> [Review disclosure]

Consent is stored as `consent.status` in `chrome.storage.local`; picker arming, capture, and both queue paths refuse with "Accept the feedback disclosure first" until the status is `accepted`.

Note: `http://127.0.0.1:15001` remains only a legacy fallback for a bare code or a pre-017 install; a pairing link sets the endpoint. It is not presented as the default.

## 6. Human steps (pending)

1. Register the Chrome Web Store developer account and pay the one-time registration fee (research §1: $5 per the support page; amount at Google's discretion).
2. Enable 2-Step Verification on the account (required before publishing).
3. Make the repository public and confirm the privacy policy URL resolves.
4. Run §3 on a clean Chrome profile with a fresh opencode 2.x install: pair from the welcome tab, pick a project on a dev page, send one feedback.
5. Capture the screenshots (§4).
6. Upload the built ZIP (`bun run zip` → `.output/browsertalk-0.1.0-chrome.zip`), fill the listing + privacy + distribution tabs with the texts in this file, and set visibility to **Public**.
7. Submit for review. Broad host permissions plus minified code can extend review; if pending for more than three weeks, contact support.
