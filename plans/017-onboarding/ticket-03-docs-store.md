# 017c: Setup docs and store copy

**What to build:** README, Chrome Web Store test instructions, product definition, and glossary match the new setup. The old fixed-port workaround and stale caveats are gone.

**Blocked by:** 017a, 017b.

**Status:** shipped · 8a9b0f7.

## Shipped

- README: Setup section (opencode 2 → `opencode pair` → copy the link, do not open → paste into the welcome tab → open the side panel on the dev site → pick the project), the dynamic-port note (`opencode serve` defaults to 4096; `opencode service status` prints the background service URL), the welcome tab and setup card in Surfaces, and connection copy that follows the pairing link instead of a fixed port.
- `CHROMEWEBSTORE.md`: test instructions rewritten around `opencode pair` and opencode 2.x, the reviewer path explained, the fake-backend step and the "binding UI is not shipped yet" caveat removed, listing and permission texts no longer name a fixed default port, screenshot and human-step lists updated.
- `product.md`: onboarding decisions, welcome tab and panel setup card in Surfaces, a setup workflow, architecture diagram, pairing-link server URL, and the per-connection storage keys.
- `CONTEXT.md`: adds Setup, Pairing link, Server check, and Connected; updates Surfaces and the Server URL and Token facts; adds "demo" to the words we do not use.
- `PRIVACY.md`: the "where the data goes" line no longer calls `15001` the default.

## Divergences

- `PRIVACY.md` is edited beyond the four named docs. The store packet links to it, and it repeated the fixed-port default. The change is one sentence plus the date.
- `CHROMEWEBSTORE.md` §4 and §6 drop the binding-UI dependency and add a clean-profile dry run. The ticket only asked for §3, but the same stale caveat lived in both lists.
- No demo path is offered. The store note in `product.md` records the review risk as unconfirmed until submission.

## Mismatches with shipped behavior

- `lib/storage/settings.ts` still defines `DEFAULT_SERVER_URL = 'http://127.0.0.1:15001'`. It survives as the bare-code and pre-017 fallback; a pairing link replaces it. Docs describe the link path and do not present `15001` as a stock opencode default.
- `components/ConsentGate.vue` still says "default `http://127.0.0.1:15001`". The exact text is recorded in `CHROMEWEBSTORE.md` §5 with a note. Align the component copy and the record in a follow-up; app code is out of scope for this docs ticket.
- The options page keeps the advanced server URL for a bare code, so the glossary still names Server URL. It is no longer the normal setup path.

## Acceptance criteria

- [x] README has a Setup section: install opencode 2, run `opencode pair`, copy the link (do not open it), paste it into Browsertalk, open the side panel on the dev site, pick the project.
- [x] README notes the background service port is dynamic and `opencode service status` prints it. `opencode serve` defaults to 4096.
- [x] `CHROMEWEBSTORE.md` test instructions use `opencode pair` and require opencode 2.x. Explain the reviewer path.
- [x] `product.md` surfaces and workflow reflect the welcome tab, panel setup card, and pairing link.
- [x] `CONTEXT.md` adds Setup, Pairing link, Server check, and Connected. Uses existing terms for everything else.
- [x] Remove the stale "binding UI is not shipped yet" caveat.
- [x] `bun run compile` and `bun run test` pass (docs-only commit).
- [x] One conventional commit. Ticket status and this phase README updated with the SHA.

## Notes

- No fake or demo path in the store test instructions. Testers must install opencode 2.
- If Chrome Web Store review blocks without a demo, record the finding and add a hidden demo path as a separate ticket.
