# Assemble the 015 phase plan

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

Turn the resolved decisions into the implementable phase plan at `plans/015-element-set/`. Include:

- One ticket per subphase (`ticket-01-*.md` …), each one conventional commit, with explicit blockers and acceptance checks.
- The data-shape migration and prompt snapshots.
- Picker and composer behavior, plus protocol guards.
- Screenshot, budget, and attachment handling.
- A test matrix at the seams: unit, component, e2e where the repo has them; the `fake` backend; no live spend.
- Docs updates: `product.md`, `CONTEXT.md`, `README.md`, `CHROMEWEBSTORE.md`, `plans/README.md`.
- A final verification step: `bun run compile`, `bun run test`, `bun run build`, live CDP smoke.

Do not implement the feature.

## Answer

Plan cut at `../README.md` (five subphases):

- **015a** — element set data and compact prompt. Blocked by none.
- **015b** — multi-pick selection and element-set composer. Blocked by 015a.
- **015c** — capture budget and multi-element attachments. Blocked by 015b.
- **015d** — panel element counts. Blocked by 015a.
- **015e** — docs, live verification, phase close. Blocked by 015a–015d.

No code yet. Each ticket is one conventional commit with tests; the phase README carries the test matrix.
