# 007b: Binding UI

**What to build:** A fresh install can complete a send: the side panel lets the user bind the current page's origin to a project. When the active origin has no binding, the panel shows the project list (from the server) and saves the choice; when bound, the header shows the project and a small affordance changes it. Closes the 008 submission blocker (no caller for `requestBind`).

**Blocked by:** 007 — Panel.

**Status:** done

- [x] Unbound origin: panel offers the project list; picking one binds it (`projects.byOrigin`) and the header shows it
- [x] Bound origin: header shows the project; a small "change" affordance re-opens the picker
- [x] Offline/server-unreachable: honest error state, no fake data
- [x] A queued feedback for a bound origin resolves the project directory for the send path (integration covered by tests)
- [x] Tests with fake APIs; real-browser check (bind → header) via the existing smoke approach
- [x] `bun run compile` + full suite pass; one conventional commit; plans files updated

## Outcome

Shipped:

- Panel logic (`lib/panel/use-panel.ts`): binding state on `usePanel` — `projectsOpen` / `projectsLoading` / `projects` / `projectsError` / `binding`, plus `openProjects` (fetches the server list through the existing `requestProjects` seam), `closeProjects`, and `chooseProject` (binds the active origin through `requestBind`, then re-reads the header target via `requestTargetRead`). Failed loads and failed binds stay honest in `projectsError` and keep the list open; a success closes the list; the list closes when the active origin changes or the page goes away.
- Side panel UI (`entrypoints/sidepanel/App.vue`): "Choose project" for an unbound origin, a small "change" affordance in the project row when bound, the list showing server `name` + `directory` with the bound project marked `current`, "Loading projects…" / "No projects on the server." / error copy, Refresh + Close. `bound` replaces the old `canRollOver` computed; no other 007 behavior changed.
- Tests: +9 (374 total / 35 files vs 365 / 35): offers the server list for an unbound origin, pick binds + header update, re-bind through change, unreachable-server error, honest empty list, failed bind, no-page guard, list closes on origin change, and a queued feedback sent to the picked directory through `sendQueuedItem`. `use-panel.test.ts` now registers the fake/opencode backends manually (controllable project list, offline fetch) and registers the connection handler so binding runs through the real message seams.
- Real-browser check (headless Chromium 152 + CDP, built extension, 21/21): fresh profile with a pairing token and no binding; panel showed "No project bound" + Choose project; the list came from the stub `GET /api/project`; picking `bind-smoke` wrote `projects.byOrigin` and the header showed `browsertalk-bind-smoke`; "change" re-opened the list with the current project marked; re-bind to `other-smoke` updated header + storage; a queued feedback sent through Retry created the session with `location.directory` = the picked directory and the prompt landed on it; empty mode showed "No projects on the server." with no fake rows; a dead server URL surfaced `Cannot reach the opencode server at http://127.0.0.1:9` with no fake choices. Script: `/tmp/opencode/browsertalk-007b-smoke/bind-smoke.mjs` (throwaway, not committed).

Divergences:

- The header shows the directory basename (007 behavior) while the list shows the server-provided `name`. Binding stores the directory (`product.md` §Storage model); the two differ when opencode reports a custom name.
- Binding itself writes storage only (`bindOrigin`); it does not hit the network. The only offline surface in this flow is the project-list fetch, which the honest list states cover.
- The list refetches on every open (no cache); the server list can change between opens, and Refresh exists for that reason.
- "Picker" stays reserved for the element picker (`CONTEXT.md`); the project-list UI is named around projects (`openProjects` / `chooseProject`), not a second picker.

Next-phase must-know notes:

- The 008 submission blocker is closed: `requestProjects` / `requestBind` now have their caller; a fresh install can pair, consent, bind, pick, comment, and send end to end.
- `chooseProject` resolves the origin at click time and the origin-change close keeps that honest.
- `use-panel.test.ts` registers the fake/opencode backends manually; double registration throws, so do not add `registerBuiltinBackends()` there.

Pending:

- None for this ticket.
