# Phase 001 — scaffold

Status: shipped, 2026-10-10 (commit `235bc0e`). Done before the `plans/` convention; reconstructed here.

Shipped:

- WXT + Vue 3 + TypeScript scaffold (`wxt.config.ts`, `package.json`; permissions `storage`, `sidePanel`, `contextMenus`, `activeTab`, host `<all_urls>`, command `Alt+Shift+F`).
- Entrypoints: `background.ts` (registers builtins at boot), `picker.content.ts` (empty stub), popup + side-panel Vue shells.
- AgentBackend seam: `lib/agent-backend/` — `interface.ts`, `registry.ts`, `opencode.ts` (stub), `fake.ts`, `builtins.ts`, `index.ts`.
- `product.md` + `CONTEXT.md`.
- Icons under `public/icon/`.

Not shipped (deliberate, lands later):

- Tests / test infra — first needed by phase 002–003.
- Any runtime behavior beyond registry boot.
