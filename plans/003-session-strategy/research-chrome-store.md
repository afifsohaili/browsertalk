# Chrome Web Store + open source research — "opencode Browsertalk"

Extension profile: Chrome MV3 (WXT + Vue 3 + TS), side panel + toolbar popup + content script on all pages, context menu + `Alt+Shift+F` command, permissions `storage`, `sidePanel`, `contextMenus`, `activeTab`, host_permissions `<all_urls>`, sends feedback to `http://127.0.0.1:15001` on the user's machine, token in `chrome.storage.local`, no analytics.

Sources: developer.chrome.com (Chrome Web Store docs + Program Policies) and support.google.com, plus the GoogleChrome GitHub org. Quotes are character-exact; cuts are marked `[...]`. Anything not clearly answered is marked **unconfirmed**.

---

## Summary: what blocks us / what doesn't

**Required (blocks submission if missing):**

| Item | Why |
|---|---|
| Privacy policy URL in the dashboard | Handling user data obliges a policy, even local-only (User Data FAQ #3, #14) |
| Data usage disclosures + Limited Use certification in the Privacy tab | "Every item will need to provide these data collection disclosures and limited use certification in order to be updated or published." |
| Permission justification for every declared permission | "Fill out these fields to tell the reviewers why your extension needs to use each permission." |
| Single-purpose description | Dashboard field; Quality Guidelines #1 |
| 2-Step Verification on the developer account | "required for all developer accounts prior to publishing an extension" |
| One-time registration fee | Register page; $5 per support page |
| In-product prominent disclosure | User Data FAQ #10; wording below, enforcement scope **unconfirmed** |

**Not blocking:**

- Localhost HTTP. The User Data FAQ says encryption is not required for transmission to a "native program on the same computer" (#16). No doc forbids loopback HTTP.
- Minified/bundled WXT/Vite output. "Minification is allowed" (Code Readability). Obfuscation is not.
- `<all_urls>`. Allowed, but reviewers treat it as a risk signal: it "may cause the review to take longer" and needs justification.
- `captureVisibleTab`. Works with `<all_urls>` or `activeTab`; cap is 2 calls/second.
- Open source. No CWS policy references open-source licensing; no license-file requirement found. It is, as far as the docs go, irrelevant to review.

**Adds review time / risk:**

- New developer + new extension + `<all_urls>` + minified code: each is a documented "signal [that] may cause the reviewer to examine an extension more closely".
- Screenshots + page content count as "handling user data" (FAQ #2 explicitly lists "taking screenshots"). Disclosures must name it.
- Reviewers cannot run an opencode server unless told how: use the Test instructions tab ("only if needed").

---

## 1. Publishing basics

### Fee

> "Before you can publish items on the Chrome Web Store, you must register as a CWS developer and pay a one-time registration fee."
> — https://developer.chrome.com/docs/webstore/register

> "In order to use the Web Store to distribute Products, you must agree to this Agreement [...] and pay a one-time registration fee, in an amount determined in Google's sole discretion (the "Registration Fee")."
> — Developer Agreement §2.1, https://developer.chrome.com/docs/webstore/terms

The current register page does **not** state the amount. Two official Google sources put it at $5:

> "The destination account needs to be registered before submitting this form. A $5 registration fee is required for the registration."
> — https://support.google.com/chrome_webstore/contact/one_stop_support (item transfer section)

> "Before you publish your first app, you must pay a one-time $5 developer signup fee."
> — archived GoogleChrome/webstore-docs, https://github.com/GoogleChrome/webstore-docs/blob/master/publish.md

Current amount is therefore $5 per the support page, with the caveat that the Developer Agreement reserves "sole discretion" over it. **Unconfirmed:** an exact currently-published figure on a policy page.

### Account facts

- Developer email cannot be changed after account creation; you must create a new account and transfer items (register page).
- First publisher is "limited to a maximum of two published extensions"; increases can be requested in the dashboard (https://developer.chrome.com/docs/webstore/publish).
- Registration availability is country-limited; the register page lists supported countries (Malaysia and Singapore are listed; check your publishing country).
- 2SV: "2-Step Verification is required for all developer accounts prior to publishing an extension or updating an existing extension." (https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)

### Review process and timelines

> "For most extensions, review is completed within a few days, but it can take up to a few weeks. If you experience longer review times without making significant changes to your extension, this may be due to factors outside of your control [...] If your extension is pending review for more than three weeks, please contact developer support [...]"
> — https://developer.chrome.com/docs/webstore/review-process

Signals that increase scrutiny:

> "new developers / new extensions / dangerous permission requests / significant code changes"

> "**Broad host permissions**: Host permissions patterns like `*://*/*`, `https://*/*`, and `<all_urls>` give extensions extensive access to the user's web activity, especially when combined with other permissions. [...] Review must verify that each requested permission is actually necessary and is used appropriately."
> — https://developer.chrome.com/docs/webstore/review-process

> "Reviews may take longer for extensions that request broad host permissions or sensitive execution permissions, or which include a lot of code or hard-to-review code."
> — https://developer.chrome.com/docs/webstore/review-process

> "Obfuscation is disallowed as it increases the complexity of the validation process. Minification is allowed, but it can also make reviewing extension code more difficult. Where possible, consider submitting your code as authored. You may also want to consider structuring your code in a way that is easy for others to understand."
> — https://developer.chrome.com/docs/webstore/review-process

Enforcement outcomes: rejection (submission only), warning (7–30 days to fix a published item), takedown, and malware-level takedown with account suspension; appeals once (review-process page).

### Visibility options

> "**Public**—This option lists your item on the Chrome Web Store for all users to see and install."
> "**Unlisted**—This option does not create a listing on the Chrome Web Store, but does allows [sic] anyone to install your item if they know its Chrome Web Store URL."
> "**Private**—This option limits installation of your item to specified users only. This is typically used for testing before public launch of an item."
> "**Key point:** All visibility settings have the same policy requirements and will go through the same review process."
> — https://developer.chrome.com/docs/webstore/cws-dashboard-distribution

Private uses trusted testers (per-account list) and Google Groups, on a per-item basis. Geographic distribution is selectable (all regions, or individual countries).

### Update flow

> "To upgrade an existing Chrome Web Store item, you need to upload a new zip file for your item, including all changed and unchanged files; update any changed metadata for your listing; and submit the item for a new review."
> "Make sure you increment the **version number**. Each new version must have a larger version number than the previous version."
> "When an update requires additional permissions, users will be prompted to accept them or disable the extension."
> — https://developer.chrome.com/docs/webstore/update

- Deferred publishing: "Once the review is complete, you will have up to **30 days** to publish. After that period expires, the staged submission will revert to a draft which will have to be submitted again for review." (publish page; same on update page)
- Updates get "essentially the same review as new items receive" (update page).
- Partial (percentage) rollout exists but is "only available for new versions of an **already-published** item with over **10,000 seven-day active users**" (update page).
- Rollback to a previous version exists (https://developer.chrome.com/docs/webstore/rollback).
- Skip-review is **not applicable**: it requires `declarativeNetRequest` as a required permission and changes only to DNR rules (https://developer.chrome.com/docs/webstore/skip-review).
- Max package size: "The maximum supported file size for an extension package is 2GB." (publish page)

---

## 2. Policy friction for THIS extension

### 2.1 Broad host permission `<all_urls>`

Policy basis:

> "Request access to the narrowest permissions necessary to implement your Product's features or services. If more than one permission could be used to implement a feature, you must request those with the least access to data or functionality. Don't attempt to "future proof" your Product by requesting a permission that might benefit services or features that have not yet been implemented."
> — https://developer.chrome.com/docs/webstore/program-policies/permissions

> "Extensions must require only the narrowest set of permissions necessary to provide their existing services or features. Developers may use minimally-scoped optional permissions to further enhance the capabilities of the extension, but must not require users to agree to additional permissions."
> — https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Minimum Permission #1)

Dashboard expectation:

> "Your extension should request the minimum permissions consistent with the purpose of the extension. Requesting broader permissions than necessary may cause your extension to be rejected."
> "If there are permissions listed here that you don't require, remove them from your manifest and upload a new version of your extension before continuing."
> — https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

The FAQ also suggests: "include a list of permissions used and the reasons you require them in your Chrome Web Store listing or in an "about page" in your extension" (user-data-faq, Minimum Permission #4).

#### Documented alternatives

| Option | Documented mechanics | Fit for this extension |
|---|---|---|
| `activeTab` only | "This serves as an alternative for many uses of `"<all_urls>"`, but displays *no warning message* during installation" (https://developer.chrome.com/docs/extensions/develop/concepts/activeTab). Granted by: "Executing an action / Executing a context menu item / Executing a keyboard shortcut from the commands API / Accepting a suggestion from the omnibox API". "Access is not granted to restricted pages, such as `chrome://` pages." | Works for element picking that always starts from toolbar click, context menu, or `Alt+Shift+F`. Not for a content script that must run on every page unprompted. Side-panel clicks are **not listed** as an activeTab trigger (unconfirmed whether it counts). |
| `optional_host_permissions` | "Granted by the user at runtime, instead of at install time." (https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions). "You can request subsets of optional origin permissions; for example, if you specify `*://*/*` in the `optional_permissions` section of the manifest, you can request `http://example.com/`." Request must come "from within a user gesture" (https://developer.chrome.com/docs/extensions/reference/api/permissions). | Per-site grant UX; no install-time warning. |
| Runtime host access request | `permissions.addHostAccessRequest()` (Chrome 133+): "When accepted, grants persistent access to the site's top origin." (permissions API page) | Newer per-site grant flow. |
| Narrow host permission for the loopback server | Host permissions let a service worker "talk to remote servers outside of its origin" (https://developer.chrome.com/docs/extensions/develop/concepts/network-requests). | Keeps the fetch to `http://127.0.0.1:15001` working if `<all_urls>` is dropped. Whether loopback is exempt from host-permission requirements is **unconfirmed** — no exemption is documented; treat it as requiring e.g. `http://127.0.0.1/*`. |

Warning behavior: "Adding or changing match patterns in the `"host_permissions"` and `"content_scripts.matches"` fields of the manifest file will also trigger a warning." Note also: "Unlike host permissions, `activeTab` does not trigger any warnings." (tabs API page)

Review impact of keeping `<all_urls>`: documented as a factor that increases review time (quote above), and the permission must be justified per-feature in the dashboard.

### 2.2 Privacy practices / data usage disclosures

The Privacy tab requires, verbatim from https://developer.chrome.com/docs/webstore/cws-dashboard-privacy:

- **Single purpose description** — required.
- **Permissions justification** — a field for each manifest permission.
- **Remote code declaration** — "Extensions that call remote code and do not declare and justify it using the field shown above will be rejected." If none: "make sure that it does not and select "No, I am not using remote code.""
- **Data usage** — "Use the first group of checkboxes to disclose which types of data your extension collects. Use the second group of checkboxes to certify that you comply with each of the disclosure statements." Disclosures include "The nature of the data that the extensions collects from users" and "Your certification that the extension complies with the policy on limited use". "Your disclosures are displayed to Chrome users[.]"
- **Privacy policy URL** — required.

Local-only does not exempt you:

> "Does an extension need to disclose user data handling if the data is only processed or stored locally on a user's device? **Yes.** Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device and is not transmitted to external servers or third parties."
> — https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (#3)

> "My extension or app handles user data, but only stores information locally (or only uses Chrome Storage Sync API). Do I still need to post a privacy policy? **Yes.** This policy requires all Products that handle user information to post a privacy policy. [...] It just needs to describe how the Product collects, uses, and shares user data."
> — user-data-faq (#14)

What counts as "handling" — directly on point:

> "Clipping or scraping content from a website that the user visits, such as taking screenshots or capturing data from a web page"
> "Collecting web browsing activity and any information about the website content or resources a user requests or interacts with [...]"
> — user-data-faq (#2)

So: comments + DOM facts + screenshot crops = user data handling. The "Website content" category (and possibly "User activity"/"Web history", depending on what facts are captured) applies. The policy pages do not publish the literal checkbox labels; the FAQ (#4) lists user data examples: PII, financial and payment information, health information, authentication information, "Website content and resources", form data, web browsing activity, personal communications, user-generated content. **Unconfirmed:** exact dashboard label set (a GoogleChrome guidance repo suggests nine categories including "Website content"; not a policy page).

Web browsing activity is specially restricted:

> "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature described prominently in the Product's Chrome Web Store page and in the Product's user interface."
> — https://developer.chrome.com/docs/webstore/program-policies/limited-use (#4)

The FAQ defines user-facing features as "functionality provided by the extension via a user interface element (including interactive buttons, text, forms, and images)", with a content-script dialog as an allowed example, and states the extension must have "some type of user interface element". The side panel/popup/element picker satisfies the UI-element expectation; description must match. (#13)

Prominent disclosure / consent — FAQ wording says in-product, not listing-only:

> "You must describe the types of user data to be collected and how they will be used, and obtain the user's consent to that collection and use. You must present the disclosure in a prominent way, so that the user sees it prior to agreeing. The disclosure, however, must not be located only in a privacy policy, terms of service, or similar document."
> "The prominent disclosure and consent must occur within the Product's user interface. Disclosures in the Chrome Web Store description or inline installation page do not satisfy this requirement."
> — user-data-faq (#10)

**Unconfirmed:** how strictly this is enforced for user-initiated, loopback-only extensions; the text itself is unambiguous that consent happens in the product UI.

Enforcement of mismatches:

> "If you don't complete this section, then your extension will be displayed to users as not having provided this information. Starting March 2021, the Chrome Web Store team will reach out to developers with a warning [...] Inaction after 30 days of the warning will result in the suspension of affected items[...]"
> "Any discrepancies between the developer dashboard disclosures, your privacy policy, and the behavior of your item would be a violation [...] This can result in the suspension of all the items owned by the publisher, deactivation of the existing user-base, and ban of the entire publisher entity (including related accounts)."
> — user-data-faq (Simplifying privacy practices #2, #3)

### 2.3 Talking to a localhost HTTP server

The closest documented provisions:

> "When the Product is a client for an internet protocol with user-specified servers, like an FTP or IRC client, the Limited Use section does not apply to the Product's collection of data for, or transmission of data with, the user-specified server. For example, if an FTP client only connects to user-specified servers and does not send any data to servers specified by the developer, the policy would not require the developer to post a privacy policy or transmit the data securely [...]"
> — https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (#15)

> "Does data transmitted between a Chrome app or extension and native programs on the same computer need to be encrypted? **No.** The requirement to handle the user data securely (under the Handling Requirements section) does not apply to transmissions between a Chrome extension or app and a native program on the same computer."
> — https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (#16)

The base rule that #16 carves out:

> "If your product collects any user data, it must handle the user data securely, including transmitting it via modern cryptography."
> — https://developer.chrome.com/docs/webstore/program-policies/data-handling (#2)

Readings and limits:

- HTTP to `127.0.0.1` does not leave the machine, and FAQ #16 removes the encryption requirement for same-computer programs. **Unconfirmed:** the FAQ does not define "native program", so it does not explicitly say an HTTP server such as opencode qualifies. It is the only documented provision that matches this architecture.
- FAQ #15 suggests user-specified servers can fall outside Limited Use. opencode's port is user-runnable, but the FAQ example is a client protocol (FTP/IRC), not a dev server. Treat #15 as analogy only — **unconfirmed** for this case.
- Network-requests docs still say: "be especially careful of resources retrieved via HTTP. If your extension is used on a hostile network, a network attacker [...] could modify the response". Loopback is not a hostile network, but reviewer-facing prose should name the loopback-only design. (https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- No Chrome doc found that mentions local dev servers or loopback communication in a review context. **Unconfirmed absence.**
- Review logistics: publish page: "The Test instructions tab lets you provide instructions and credentials for testing your item, only if needed." Given the extension depends on a running opencode server, supply setup steps there.

### 2.4 Remote code policy vs WXT/Vite bundled (minified) output

Exact rules:

> "Developers must not obfuscate code or conceal functionality of their extension. This also applies to any external code or resource fetched by the extension package. Minification is allowed, including the following forms: 1. Removal of whitespace, newlines, code comments, and block delimiters 2. Shortening of variable and function names 3. Collapsing files together"
> — https://developer.chrome.com/docs/webstore/program-policies/code-readability

> "Extensions using Manifest V3 must meet additional requirements related to the extension's code. Specifically, the full functionality of an extension must be easily discernible from its submitted code [...] The extension may reference and load data and other information sources that are external to the extension, but these external resources must not contain any logic."
> "Execution of logic from a remote source is permissible only when accomplished through a documented API that explicitly allows this practice [...] (Debugger API, User Scripts API)"
> "If we are unable to determine the full functionality of your extension during the review process, we may reject your submission or remove it from the store."
> — https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements

> "Remotely hosted code, or RHC, is what the Chrome Web Store calls anything that is executed by the browser that is loaded from someplace other than the extension's own files. Things like JavaScript and WASM. It *does not* include data or things like JSON or CSS."
> "If you have a full build system, or use dependencies from `npm` or other third party sources, make sure you are searching the *compiled* version of the code, since that is what is being evaluated by the store."
> — https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code

Application to this extension:

- A WXT/Vite minified bundle is inside the package and allowed ("Minification is allowed"). "Where possible, consider submitting your code as authored" is a review-time hint, not a requirement (review-process).
- Sending a comment + DOM facts + a screenshot to opencode and receiving a response is data transfer, not RHC — RHC is *executed* code; "It does not include data or things like JSON or CSS." As long as the extension never `eval`s or injects scripts from the server, it complies. Dashboard: declare "No, I am not using remote code."
- "Communicating with remote servers for certain purposes is still allowed", including "Syncing user account data with a remote server" and "Fetching a remote configuration file for A/B testing [...] where all logic for the functionality is contained within the extension package" (mv3-requirements #3). A loopback server receiving feedback is at least as benign; **unconfirmed** that the list is exhaustive for localhost (the list says "for instance").
- The compiled/bundled `dist/` is what reviewers evaluate — keep sourcemaps available if you want to help review; no doc requires or forbids shipping them. **Unconfirmed** whether sourcemaps affect review.

Does open-sourcing satisfy anything formal? See §4: no.

### 2.5 Single purpose

> "An extension must have a single purpose that is narrow and easy to understand. Don't create an extension that requires users to accept bundles of unrelated functionality. If two pieces of functionality are clearly separate, they should be put into two different extensions, and users should have the ability to install and uninstall them separately."
> — https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines (#1)

The FAQ's two acceptable shapes:

> ""Single purpose" can refer to one of two aspects of an extension: 1. An extension can have a single purpose limited to a narrow focus area or subject matter [...] If the extension has a narrow focus area or subject matter, then it can offer various functions related to that focus area or subject matter. [...] 2. Or, an extension can have a single purpose limited to a narrow browser function [...]"
> "Be conscious of your extension's permissions. We assume your extension utilizes each of the permissions it requests. Excessive permissions unrelated to your extension's single purpose will be viewed as enabling unrelated functionalities, resulting in a policy violation."
> — https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq

Also listed as a violation example: "Side panel extensions which hijack a user's browsing or search experience." (quality-guidelines #2)

Analysis (assessment, not doc text): "capture browser feedback and send it to a coding-agent session" plausibly fits the "narrow focus area or subject matter" shape, and the FAQ explicitly allows "various functions related to that focus area" — the side panel, popup, context menu, command, and content script are entry points to the same function, not separate purposes. The permission set must all trace to that one purpose; that is where `<all_urls>` carries risk. **Unconfirmed:** no document gives a verdict for this exact pattern; the reviewer decides. The dashboard field must contain a one-line narrow statement ("Make sure that this field clearly communicates this purpose" — cws-dashboard-privacy).

### 2.6 Screenshot capture with `captureVisibleTab`

> "Captures the visible area of the currently active tab in the specified window. In order to call this method, the extension must have either the `<all_urls>` permission or the `activeTab` permission. In addition to sites that extensions can normally access, this method allows extensions to capture sensitive sites that are otherwise restricted, including chrome:-scheme pages, other extensions' pages, and data: URLs. These sensitive sites can only be captured with the activeTab permission. File URLs may be captured only if the extension has been granted file access."
> — https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab

Rate limit: `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2` ("`captureVisibleTab` is expensive and should not be called too often." — same page, Chrome 92+).

Chrome 116 premise: **unconfirmed / not found.** Nothing on the tabs API page or the Chrome 116 "what's new" post mentions a change to `captureVisibleTab` or a new activeTab rule for it. What Chrome 116 actually changed for extensions: `sidePanel.open()`, WebSocket keepalive in service workers, `tabCapture` stream-ID restrictions ("Prior to Chrome 116, when a `consumerTabId` was not specified, the stream ID was restricted to both the security origin, render process and render frame of the caller"), `runtime.getContexts()`, geolocation offscreen reason, `action.setBadgeText` clearing.
- https://developer.chrome.com/blog/chrome-116-beta-whats-new-for-extensions
- https://developer.chrome.com/docs/extensions/reference/api/tabCapture

Practical consequence documented in the docs: with `<all_urls>` the extension can call `captureVisibleTab` any time (≤2/sec), but cannot capture `chrome://` pages; with `activeTab` it can capture sensitive pages, but activeTab is only granted by an action click, context menu item, keyboard shortcut, or omnibox suggestion for that tab. If the flow is "open side panel, then capture", and `<all_urls>` is dropped, the docs do not list a side-panel click as an activeTab trigger — **unconfirmed** whether it works in practice. This interaction is the main reason to keep a broad host permission or design capture around one of the four documented gestures.

---

## 3. Privacy policy: mandatory? what must it say?

**Mandatory, yes.** Primary quotes:

> "If your Product handles any user data, then you must post an accurate and up to date privacy policy."
> "The privacy policy must, together with any in-Product disclosures, comprehensively disclose: 1. How your Product collects, uses and shares user data 2. All parties the user data will be shared with."
> "You must make the policy accessible by providing a link in the designated Chrome Web Store Developer Dashboard field."
> — https://developer.chrome.com/docs/webstore/program-policies/privacy

Suggested content (from the FAQ's guidance list, #7):

> "What information do you collect? — Explain all the information your extension collects. This includes information that you may collect automatically, such as server and HTTP logs [...] and usage information. [...]
> How do you use the information? [...]
> What information do you share? — Describe the circumstances when you share information."

Plus a Limited Use statement on the project site:

> "All extensions that request user data must show a Limited Use disclosure on your project's homepage or on a page one click away from the homepage; for example, in your privacy policy. This Limited Use disclosure should be written by you, the developer, and should clearly describe the app's compliance with the Chrome Web Store User Data Policy, including the Limited Use requirements."
> — https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Limited uses #1)

> "An affirmative statement that your use of the data complies with the Limited Use restrictions must be disclosed on a website belonging to your extension; for example, a link on a homepage to a dedicated page or privacy policy noting: "The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.""
> — https://developer.chrome.com/docs/webstore/program-policies/limited-use (#6)

For this extension the policy must (accurately) state something like: collects the user's chosen page comment, DOM facts, and an optional screenshot crop; stores config/auth token locally in `chrome.storage.local`; transmits that feedback only to a server on the user's own computer (`127.0.0.1`) that the user runs; no developer-operated server, no analytics, no third-party sharing; retention controlled by the user's own server and storage. The dashboard disclosures, this policy, and actual network behavior must match (user-data-faq #3).

---

## 4. Open source + Chrome Web Store

- **No policy found** that requires, rewards, or interacts with open-source licensing. A search of the Program Policies and Web Store docs returns nothing on "open source" as a policy concept. Treat "no role" as **unconfirmed absence** rather than an affirmative statement.
- Google reviews source regardless: "Google may at any time review or test your Products and their source code for compliance with this Agreement [...]" — Developer Agreement §7.2, https://developer.chrome.com/docs/webstore/terms.
- Submitting a ZIP means the full compiled code is evaluated ("that is what is being evaluated by the store" — remote-hosted-code page). A GitHub link does not change the review path; there is no documented "open source exemption".
- License file: **no requirement found** in CWS docs. GitHub convention, not CWS policy.
- Name / trademark:
  - > "Don't pretend to be someone else, and don't represent that your product is authorized by, endorsed by, or produced by another company or organization, if that is not the case."
    > "Don't infringe on the intellectual property rights of others, including patent, trademark, trade secret, copyright, and other proprietary rights."
    > — https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property
  - "All information provided in the privacy fields of your extension must be up to date and accurate" and metadata must not be misleading (listing-requirements, https://developer.chrome.com/docs/webstore/program-policies/listing-requirements).
  - The opencode project (sst/opencode, MIT) publishes no third-party trademark/branding policy that I could find; internal issue traffic references "brand guidelines" but no public usage terms. **Unconfirmed.** CWS itself does not rule on the word "opencode"; it enforces impersonation/IP complaints. Naming like "opencode Browsertalk" risks implying endorsement; "Browsertalk — feedback for opencode" plus a "not affiliated with the opencode project" note is the lower-risk framing (guidance, not doc text).
  - CWS listing has documented "Homepage URL" and "Support URL" fields — a GitHub repo/issues page is a legitimate destination (cws-dashboard-listing).
- Store listing fields that can point at the repo: Homepage URL, Support URL (cws-dashboard-listing). No field asks for a license.

---

## 5. Licenses — one line each (official texts)

| License | One-line practical difference |
|---|---|
| MIT (https://opensource.org/license/mit) | Shortest permissive license: use/modify/distribute/sublicense freely, must keep copyright+license notice, no patent grant, no trademark rights. |
| Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0) | Permissive like MIT plus an express patent grant and patent-retaliation termination; requires preserving NOTICE files; more boilerplate. |
| GPL-3.0 (https://www.gnu.org/licenses/gpl-3.0.html) | Strong copyleft: distributed derivative works must stay GPL-3.0 with source, plus patent grant and anti-lockdown terms; blocks closed relicensing of your code. |

Store interaction: nothing in the CWS Developer Agreement turns on your license choice; you grant Google a distribution license (§5.1) and may add a EULA for users (§5.2) — https://developer.chrome.com/docs/webstore/terms. No compatibility analysis of GPL vs the Web Store agreement is published there; **unconfirmed** for edge cases.

---

## Checklist: publish + open source

### A. Code and permissions (before packaging)

1. Decide host access strategy. Options documented in §2.1:
   - keep `<all_urls>` and justify it per feature in the dashboard, accepting longer review; or
   - `activeTab` + `scripting` for user-invoked picking; or
   - `optional_host_permissions` (`http://*/*`, `https://*/*`) + `permissions.request()` from a user gesture for per-site grants; plus
   - a narrow host permission (e.g. `http://127.0.0.1/*`) for the opencode fetch if needed.
2. Confirm the feedback fetch still works under the chosen permission set (host permissions are required for cross-origin fetch from the service worker — network-requests doc).
3. Remove any obfuscation; keep minification only (Code Readability).
4. Confirm no `eval` / no script or WASM loaded from outside the package (RHC rules).
5. Verify screenshot capture flow against the activeTab trigger list in §2.6 before deciding to drop `<all_urls>`.
6. Check `description` ≤ 132 chars, valid `name`, `version`, `icons` in the manifest; no JSON comments (prepare page).
7. Load unpacked and test, then build the production bundle.
8. ZIP the build output with `manifest.json` at the ZIP root ("place the manifest file in the **root directory**, not in a folder"); ≤ 2GB.

### B. Store assets and metadata

9. 128×128 px store icon.
10. At least one 1280×800 px screenshot (up to 5); optional YouTube video.
11. 440×280 px small promo tile; optional 1400×560 marquee.
12. Detailed description (start with one concise statement of what it does; no keyword spam), category (likely "Developer Tools"), language.
13. Homepage URL and/or Support URL (GitHub repo/issues work).
14. Prepare Test instructions: how to run opencode at `127.0.0.1:15001` and exercise the extension.

### C. Privacy tab

15. Single purpose description — one narrow sentence.
16. Permission justifications for `storage`, `sidePanel`, `contextMenus`, `activeTab`, and every host permission pattern; delete any permission not used.
17. Remote Code = "No, I am not using remote code" (assuming no eval/remote scripts).
18. Data usage checkboxes — answer accurately; expect to mark website content/screenshots (FAQ #2 lists screenshots as data handling). Keep it consistent with the policy and code.
19. Limited Use certifications — check all three (no sale, no unrelated use, no creditworthiness use).
20. Privacy policy URL — public, hosted page.

### D. Privacy policy + site content

21. Publish a privacy policy stating: what is collected (comment, DOM facts, screenshot crop), where it goes (only a server on the user's own computer that they run), local storage (`chrome.storage.local`), no external servers/analytics/third-party sharing, how to delete.
22. Add the Limited Use disclosure on the homepage or one click away (FAQ limited uses #1; Limited Use #6 sample text).
23. Consider an in-product first-run disclosure + consent (FAQ #10 wording; enforcement scope unconfirmed).

### E. Developer account + publish

24. Register the developer account; pay the registration fee ($5 per support page; amount at Google's discretion per the Developer Agreement).
25. Enable 2-Step Verification (required before publishing).
26. Upload, fill Store listing + Privacy + Distribution tabs, choose visibility (unlisted/private for testing is fine; same policy + review apply).
27. Submit for review. Expect days, not hours; broad host permissions and minified code can extend it. If > 3 weeks, contact support.
28. Publish within 30 days if deferred. Future updates: bump version, same review; permission increases prompt users; rollback is available.
29. Remember the initial limit of two published extensions per publisher.

### F. Open source

30. Add a `LICENSE` file (MIT / Apache-2.0 / GPL-3.0) — GitHub convention; not a CWS requirement (no requirement found).
31. README: privacy summary + link to the policy + localhost architecture note.
32. Link the repo from Homepage/Support URL fields.
33. Naming: avoid implying endorsement by the opencode project (Impersonation & IP policy); consider "for opencode" phrasing and a non-affiliation note. No published opencode trademark policy was found (unconfirmed).
34. Optionally include a `CHROMEWEBSTORE.md` with the exact disclosure text used, so future updates keep listing/behavior/policy in sync (mismatch is the enforced failure mode).

---

## Primary source index

- Register: https://developer.chrome.com/docs/webstore/register
- Prepare: https://developer.chrome.com/docs/webstore/prepare
- Publish: https://developer.chrome.com/docs/webstore/publish
- Listing: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Distribution/visibility: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- Review process: https://developer.chrome.com/docs/webstore/review-process
- Update: https://developer.chrome.com/docs/webstore/update
- Skip review: https://developer.chrome.com/docs/webstore/skip-review
- Program Policies index: https://developer.chrome.com/docs/webstore/program-policies
- Single page (quotes mirrored): https://developer.chrome.com/docs/webstore/program-policies/policies
- Permissions: https://developer.chrome.com/docs/webstore/program-policies/permissions
- Privacy policy: https://developer.chrome.com/docs/webstore/program-policies/privacy
- Limited Use: https://developer.chrome.com/docs/webstore/program-policies/limited-use
- Disclosure requirements: https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements
- Handling requirements: https://developer.chrome.com/docs/webstore/program-policies/data-handling
- Quality guidelines + FAQ: https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines , https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq
- Code readability: https://developer.chrome.com/docs/webstore/program-policies/code-readability
- MV3 requirements: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Impersonation & IP: https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property
- 2SV: https://developer.chrome.com/docs/webstore/program-policies/two-step-verification
- User Data FAQ: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Developer Agreement: https://developer.chrome.com/docs/webstore/terms
- activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Declare permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Permissions API: https://developer.chrome.com/docs/extensions/reference/api/permissions
- Network requests: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Remote hosted code: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- tabs API (`captureVisibleTab`): https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab
- Chrome 116 what's new: https://developer.chrome.com/blog/chrome-116-beta-whats-new-for-extensions
- One Stop Support ($5 fee mention): https://support.google.com/chrome_webstore/contact/one_stop_support
- Archived official publish doc ($5): https://github.com/GoogleChrome/webstore-docs/blob/master/publish.md

Items explicitly marked **unconfirmed** in this file:

1. Current fee amount stated on a policy page (evidence is the support page + archived doc).
2. Exact dashboard data-usage checkbox labels.
3. Enforcement of the in-product prominent-disclosure requirement (FAQ #10) for this pattern.
4. Whether an HTTP loopback server qualifies as a "native program on the same computer" (FAQ #16) and whether FAQ #15's user-specified-server carve-out applies.
5. Whether loopback fetch is exempt from host-permission requirements (no exemption documented).
6. Any Chrome 116 change to `captureVisibleTab`/activeTab (not found).
7. Whether opening a side panel can grant activeTab (not in the documented trigger list).
8. Whether sourcemaps or a public repo affect review outcomes.
9. opencode project's third-party trademark/branding policy (none found).
10. Any CWS requirement regarding open-source license files (none found).
