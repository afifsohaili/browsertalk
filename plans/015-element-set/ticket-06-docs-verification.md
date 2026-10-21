# 015f: Docs, live verification, phase close

**What to build:** Document the shipped element set, run the final checks, and close the phase. No feature code.

**Blocked by:** 015a–015e.

**Status:** done.

## Checklist

- [x] `product.md`: workflow (Cmd/Ctrl+click, release/Enter/fifth, Clear/Escape, blur/route), prompt template (compact, attrs, extras line, no box/footer), session model (element set, multi-pick), storage (`facts.elements`, `SentItem.elementCount`), decisions (5 cap, 4 shots, same page/session), out-of-scope.
- [x] `CONTEXT.md`: **Element set**, **Multi-pick**, **Count pill**, **Chip**; update **Feedback** (one comment + N elements), **Picker**, **Composer**; add `selection`/`batch` to words we do not use.
- [x] `README.md`: multi-pick instructions and limits.
- [x] `CHROMEWEBSTORE.md`: side panel description, element set.
- [x] `plans/README.md`: 015 row → `ticket-01..06`, shipped, sha.
- [x] `plans/015-element-set/README.md`: shipped status, per-ticket shas, divergences.
- [x] `bun run compile`, `bun run test`, `bun run build` exit 0.
- [x] Live CDP smoke against the running opencode server (throwaway session; deleted after): 3 picks → one feedback; server context has `Elements (3)` and compact lines; no footer; panel rows show `3 elements`; N=1 compact; 5 cap; clear/blur/route; 4-shot cap.
- [x] One conventional `docs(...)` commit; sha recorded.

## Acceptance

- Docs match shipped behavior; no code changes in this ticket.
- The live smoke is green; the throwaway session is deleted.
- The phase table and `plans/README.md` show shipped.

## Outcome

Shipped in `docs(plans): ship 015 element set` (this commit; sha in `git log -1`). No feature code.

**Checks**

- `bun run compile` exit 0.
- `bun run test` 58 files / 902 tests passed.
- `bun run build` exit 0 (`.output/chrome-mv3`, 208.86 kB).

**Live CDP smoke** (Chrome 155.0.8059.85 headless; throwaway script `~/.cache/opencode-tmp/browsertalk-015-smoke/smoke15.mjs`, not committed)

- The content script injected this run; the 015c/015d injection blocker did not recur.
- 3 Cmd+clicks → one feedback. Server context has `Elements (3)`, numbered lines with inline attrs, no footer; 2 screenshots attached; panel sent row shows `3 elements`.
- N=1 compact: `Element: p.note — …`, no `Elements (`, no box line, no footer.
- 5 cap: composer shows `5 elements` and 5 chips; after the fifth pick the overlay is gone and a sixth meta-click changes nothing.
- Clear, window blur, and `popstate` each discard: overlay gone, no composer, `pending.feedback` empty.
- 4-shot cap: a five-element set attached 2 screenshots (budget-limited, at most 4); no quota error in the service-worker console.
- Throwaway session deleted; `GET /api/session?search=Browsertalk 015 smoke` returns 0.

**Divergence found by the smoke:** a page-world `pushState` did not clear the armed set, while `popstate` did. `pushState`-only SPA navigation stays unconfirmed and is listed under `product.md` open questions. No code change in this ticket.

**Shas:** 015a `2a905e9 + e1dfccf` · 015b `d5b54a2` · 015c `f2c20fb` · 015d `afc495d` · 015e `924b8cb` · 015f this docs commit.
