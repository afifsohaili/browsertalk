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
> - Localhost only by default: feedback goes only to the opencode server you run (default http://127.0.0.1:15001). No external servers, no analytics.
> - Open source (MIT).
>
> Requires the opencode CLI/server, running locally.
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
  > The picker must work on any dev site the user is testing; the extension cannot know the user's sites in advance. Host access is used to (1) run the picker content script on the active page to highlight elements and capture the selected elements' facts, (2) capture the visible tab for the optional element screenshot crops, and (3) call the user's own opencode server — loopback by default (http://127.0.0.1:15001), or another machine the user explicitly allows in settings (off by default). No page data is read until the user explicitly arms the picker or comments on the page, and feedback is sent only to the user's own server.

Rationale: `activeTab` was removed from the manifest in this phase — it is unused with `<all_urls>` present (content script matches, `captureVisibleTab`, and `tabs.sendMessage` are all covered by host access), and the dashboard guidance says to delete permissions not required (research §2.1, checklist C.16).

### Remote code

Select: **No, I am not using remote code.**

The extension executes only code bundled in the package (WXT/Vite build). It never `eval`s or injects scripts from a server; the opencode server receives data only.

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

> Browsertalk requires an opencode server running on your machine; the extension talks only to 127.0.0.1 by default, or to another machine you explicitly allow in settings (off by default).
>
> Full flow:
>
> 1. Install opencode from https://opencode.ai and start its server on the default URL: `opencode serve --port 15001`
> 2. In another terminal, create a pairing code: `opencode api post /api/pair --server http://127.0.0.1:15001`
> 3. Click the extension's toolbar icon to open the side panel. First run shows the feedback disclosure; click Accept. Paste the pairing code into the connection form and click Pair — the status shows "connected". (If pairing fails, set the server URL in the options page to the URL opencode printed.)
> 4. Visit any page, then click "Point at element" (or press Alt+Shift+F, or right-click → "Browsertalk: point at element"). Hover highlights elements; click one, type a comment, press Queue (or Enter). For several elements on one page: hold Cmd (Ctrl on Windows/Linux), click up to five, release, then comment once and Queue.
> 5. The feedback appears in the side panel's Outbox and is delivered to the opencode server. Right-click → "Browsertalk: point at element" exercises the context-menu entry point.
>
> UI check without a server: options page → Agent backend → "Fake", then repeat steps 4-5 (feedback queues locally; delivery to a session requires a project binding).
>
> Note for this submission: the project-binding UI is not shipped yet, so a fresh install can pair, pick, comment, and queue, but a send ends with "This site has no project binding" until a binding exists in `chrome.storage.local`. Do not remove this note until the binding UI ships (see Pending before submission).

## 4. Listing assets

| Asset | Status |
|---|---|
| 128×128 store icon | Ready — `public/icon/128.png` |
| Screenshots 1280×800+ (1-5) | **Pending.** Capture after the project-binding UI ships so the screenshots show the full loop: (1) side panel with target + outbox, (2) picker highlight on a page, (3) inline composer, (4) consent disclosure, (5) sent list. |
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
> It sends them only to the opencode server you run (default http://127.0.0.1:15001; another machine only if you turn on "Allow a remote server"). Nothing goes to external servers. No analytics.
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

## 6. Human steps (pending)

1. Register the Chrome Web Store developer account and pay the one-time registration fee (research §1: $5 per the support page; amount at Google's discretion).
2. Enable 2-Step Verification on the account (required before publishing).
3. Make the repository public and confirm the privacy policy URL resolves.
4. Ship the project-binding UI (or accept the limitation and edit §3 first). A public listing cannot deliver feedback end to end without it.
5. Capture the screenshots (§4).
6. Upload the built ZIP (`bun run zip` → `.output/browsertalk-0.1.0-chrome.zip`), fill the listing + privacy + distribution tabs with the texts in this file, and set visibility to **Public**.
7. Submit for review. Broad host permissions plus minified code can extend review; if pending for more than three weeks, contact support.
