# 016e: Docs, live verification, re-review

**What to build:** Document the fixes, verify live, and re-run the two-axis review. No feature code.

**Blocked by:** 016a–016d.

**Status:** ready.

## Checklist

- [ ] Update `product.md`, `CONTEXT.md`, `README.md`, `CHROMEWEBSTORE.md` for the route bridge, multi-drop quota, pending clear, count wording, and any permission/script changes.
- [ ] Update `plans/README.md` 016 row and `plans/016-review-fixes/README.md` with per-ticket shas and status.
- [ ] `bun run compile`, `bun run test`, `bun run build` exit 0.
- [ ] Live CDP smoke: page-world `pushState` clears armed set and open composer; composer close clears pending; quota loop; 4-shot cap path (wait between picks if needed); N=1 parity. If the content script cannot inject, record the exact blocker; do not fake.
- [ ] Re-run the Standards + Spec review on `be30179..HEAD`; report under `## Standards` and `## Spec`; verify the three material gaps are closed and list any remaining findings.
- [ ] One conventional `docs(plans)` commit.

## Acceptance

- Docs match the fixes and the live results.
- The re-review no longer reports the pushState gap, single-drop quota, or pending leak.
- Any remaining findings are explicitly listed as accepted/deferred.

## Outcome

<!-- fill after shipping: smoke results, re-review findings, shas -->
