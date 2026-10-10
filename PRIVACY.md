# Browsertalk privacy policy

Last updated: 2026-10-10

opencode Browsertalk ("Browsertalk") is a Chrome extension that sends browser feedback to the opencode coding-agent session on your own computer. This policy describes what it handles and where that data goes.

## What Browsertalk collects

Only when you choose to send feedback:

- Your comment text.
- Page facts: full URL (including query parameters), path, and page title.
- Element facts for the element you picked (page comments send page facts only): tag name, id, CSS classes, a generated CSS selector, trimmed text content, key attributes (href, src, role, aria-label, data-testid, placeholder), bounding box, viewport size, and scroll position.
- Optional extras when they are available for a pick: an element screenshot crop, the detected component name, and a small computed-style and ARIA subset.

Nothing is captured before you accept the first-run disclosure. After that, nothing is read from a page until you explicitly arm the picker or comment on the page. Browsertalk does not read forms, keystrokes outside the comment box, passwords, or browsing history beyond the page you send feedback on.

## Where the data goes

Feedback is sent only to the opencode server on your own computer, at the address you configure (default `http://127.0.0.1:15001`). That server is yours.

- All transfer stays on your machine (loopback, `127.0.0.1`).
- No external servers, no analytics, no telemetry, no crash reporting.
- Nothing is shared with third parties, sold, or used for advertising or creditworthiness.

## Local storage

Browsertalk keeps its own state in `chrome.storage.local` on your machine:

- your server URL, backend choice, and session-strategy override,
- the pairing token for your server,
- the origin → project bindings you create,
- session references, the outbox, and recent sent summaries.

A pending pick (the element you selected before writing the comment) lives in `chrome.storage.session` and is cleared once queued.

## Retention and deletion

- Outbox items and sent summaries stay in extension storage until you discard them, clear the extension's storage, or uninstall the extension.
- Removing the extension deletes all of its storage.
- Feedback that has been sent lives in the opencode server and session history on your own machine; delete it there.

## Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

References: [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies) · [Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

## Contact

Questions or corrections: open an issue at https://github.com/afifsohaili/browsertalk/issues.
