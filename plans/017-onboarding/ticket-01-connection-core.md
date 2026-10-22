# 017a: Connection core and panel setup card

**What to build:** The side panel tells the truth about why it is not working. A user can pair by pasting the output of `opencode pair` — the link or a bare code — including a remote link with explicit confirmation. Pairing a non-2.x server is rejected with an upgrade message. The panel shows a setup card that opens the setup tab. The options page can test and forget the pairing. The fake backend is no longer selectable.

**Blocked by:** None (can start immediately).

**Status:** shipped.

## Shipped

- Connection service: link/code parser, remote confirmation, endpoint and token persistence after a successful exchange, reset, and the opencode 2 version gate.
- opencode probe: unauthenticated `/api/info` separates a down server from an unpaired one; every state carries a next action.
- Panel setup card; options Test connection, Forget pairing, and the advanced server URL; fake backend hidden from choices with a stored-fake fallback.
- Feature spec and unit coverage for every seam in this ticket.

## Divergences

- "Finish setup" opens the options page until 017b adds the welcome tab.
- The commit SHA is recorded in the follow-up docs commit; a commit cannot contain its own hash.

## Seams under test

- Connection service: pair, ping, reset. Public functions used by the message handler.
- opencode adapter: `ping` and `onboarding.authenticate`, with an injected `fetchFn`.
- `useConnection` composable: state and actions, with `fakeBrowser` and the fake backend.
- Settings page: backend choices and test/reset actions.

## Acceptance criteria

- [x] Status classification: `unreachable`, `unpaired`, `unauthorized`, `incompatible`, `connected`. Each carries the next action.
- [x] An unauthenticated probe distinguishes "server down" from "not paired". A token is not required for that distinction.
- [x] Pairing accepts the full `opencode pair` output, a `/auth/connect/<code>` link, or a bare code.
- [x] The link supplies the server URL. Persist the URL and token only after the token exchange succeeds.
- [x] A non-loopback link shows its origin and the remote-server warning, and requires confirmation. Cancel persists nothing.
- [x] After pairing, read the server version. Accept 2.x. On other versions show `Browsertalk needs opencode 2` plus `opencode upgrade`.
- [x] "Forget pairing" clears the token for the current endpoint. Status returns to unpaired.
- [x] The panel shows the state and one action. It links to the setup tab; it does not duplicate the full wizard.
- [x] The options page has Test connection, Forget pairing, and the advanced server URL.
- [x] The fake backend is hidden from user choices. A stored `fake` backend resolves to `opencode`. Tests still use the fake class.
- [x] Feature spec: paste a pairing link → token stored under the link's endpoint → status connected → projects list works.
- [x] Unit tests: link/code parser, each status state, remote confirm and cancel, reset, version gate, settings filtering.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit. Ticket status and this phase README updated with the SHA.

## Notes

- The link is single-use. Copy must say "Copy the link. Do not open it."
- Probe only the saved URL. Do not scan ports.
- Existing users with `serverUrl=15001` keep it. No forced migration.
- `fake` stays registered for tests; only the user-facing choice disappears.
