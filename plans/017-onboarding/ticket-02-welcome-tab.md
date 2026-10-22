# 017b: Welcome tab and setup badge

**What to build:** On a fresh install a welcome tab opens and walks the user through: opencode 2, `opencode pair`, paste the link, connected, then hand off to the side panel on a dev site to pick a project. The panel keeps a compact setup card. The toolbar badge stays until connected.

**Blocked by:** 017a.

**Status:** shipped.

## Shipped

- Install handler: `reason=install` only, development and admin skipped, welcome tab opened and badge set. Startup restores the badge when the connection is not ready.
- Badge clears after a successful pair and returns on Forget pairing.
- Shared `useSetup` state machine (`checking` / `prerequisite` / `upgrade` / `pair` / `remote` / `project`) read by the welcome tab and the panel card.
- Welcome page under `entrypoints/welcome/` (builds to `welcome.html`): prerequisite, `opencode pair` with copy, link/code field, live state, version, link warning, remote confirmation, pin instructions, Open side panel, and the project handoff.
- The panel card's "Finish setup" opens the welcome tab; a closed welcome tab is reopened from the card.

## Divergences

- The badge text is `1`; the ticket did not name one.
- The welcome page has a "Check again" action, because the live state does not poll on its own.
- The SHA is recorded in the follow-up docs commit; a commit cannot contain its own hash.

## Seams under test

- Install handler: `runtime.onInstalled` gating and badge updates.
- Setup composable: shared state machine used by the welcome tab and the panel card.
- Welcome surface: state, copy, and handoff actions.

## Acceptance criteria

- [x] `runtime.onInstalled` opens the welcome tab only for `reason === 'install'`. Updates do not open it. Development and admin installs are skipped.
- [x] The badge is set until connected. It clears after a successful pair and is restored on startup when not connected.
- [x] The welcome page shows the prerequisite, the `opencode pair` command with copy, a link/code field, live state, version, and the "Copy the link. Do not open it." warning.
- [x] A remote link shows its origin and warning. Confirming sets the remote policy.
- [x] After connection, the project step says to open the dev site and pick the project in the side panel. It does not bind on the extension origin.
- [x] The welcome page has "Open side panel" from a user gesture and pin instructions.
- [x] The panel card and welcome page share one setup composable. No duplicated state machine.
- [x] Feature spec: install event → welcome tab opens; update event → no tab; pair → badge clears.
- [x] Unit tests: install gating, badge transitions, setup step transitions, remote confirmation copy.
- [x] `bun run compile` and `bun run test` pass.
- [x] One conventional commit. Ticket status and this phase README updated with the SHA.

## Notes

- `sidePanel.open()` requires a user gesture. Call it from a button, never on install.
- The welcome tab is an extension page. Project binding needs the active dev-site origin, so the welcome page hands off instead of binding.
- If the user closes the welcome tab, the panel card reopens it.
