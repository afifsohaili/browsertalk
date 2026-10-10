# 004b: Picker extras

**What to build:** Optional captures enrich a feedback when available, and never block it when absent: a screenshot crop of the selected element, the component name (best effort), and a small computed-styles + ARIA subset.

**Blocked by:** 004a — Picker core.

**Status:** ready-for-agent

- [ ] Screenshot crop attaches when capture succeeds; skipped silently when the tab cannot be captured
- [ ] Component name detected best-effort (React dev fibers, Vue) and omitted when unknown
- [ ] Computed-styles + ARIA subset kept small enough not to flood the prompt; cap recorded in the phase doc
- [ ] Feedback with zero extras still sends fine
- [ ] Crop fidelity under browser zoom / hi-DPI checked once; findings recorded
- [ ] `bun run compile` passes; one conventional commit; phase doc updated
