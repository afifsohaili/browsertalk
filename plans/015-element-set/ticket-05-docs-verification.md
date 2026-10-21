# 015e: Docs, live verification, phase close

**What to build:** Document the shipped element set, run the final checks, and close the phase. No feature code.

**Blocked by:** 015a–015d.

**Status:** ready.

## Checklist

- [ ] `product.md`: workflow (Cmd/Ctrl+click, release/Enter/fifth, Clear/Escape, blur/route), prompt template (compact, attrs, extras line, no box/footer), session model (element set, multi-pick), storage (`facts.elements`, `SentItem.elementCount`), decisions (5 cap, 4 shots, same page/session), out-of-scope.
- [ ] `CONTEXT.md`: **Element set**, **Multi-pick**, **Count pill**; update **Feedback** (one comment + N elements), **Picker**, **Composer**; add `selection`/`batch` to words we do not use if needed.
- [ ] `README.md`: multi-pick instructions and limits.
- [ ] `CHROMEWEBSTORE.md`: side panel description, element set.
- [ ] `plans/README.md`: 015 row → `ticket-01..05`, status, sha.
- [ ] `plans/015-element-set/README.md`: shipped status, per-ticket shas, divergences.
- [ ] `bun run compile`, `bun run test`, `bun run build` exit 0.
- [ ] Live CDP smoke against the running opencode server (throwaway session; delete after): 3 picks → one feedback; server context has `Elements (3)` and compact lines; no footer; panel rows show `3 elements`; N=1 compact; 5 cap; clear/blur/route; 4-shot cap.
- [ ] One conventional `docs(...)` commit; record the sha.

## Acceptance

- Docs match shipped behavior; no code changes in this ticket.
- The live smoke is green; the throwaway session is deleted.
- The phase table and `plans/README.md` show shipped.

## Outcome

<!-- fill after shipping: smoke results, shas -->
