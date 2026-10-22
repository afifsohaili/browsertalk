# 018d: Consent gate for panel reads

**What to build:** The side panel does not read the active tab URL or subscribe to tab/storage events before consent is accepted. The existing consent gate becomes a real data boundary, not only a visual one.

**Blocked by:** 018c.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] With consent unset or declined, mounting the side panel performs no active-tab read and adds no tab/storage listeners.
- [ ] After acceptance, the panel mounts and reads the active page.
- [ ] Consent changes in another surface are followed without retaining stale listeners.
- [ ] Component spec spies on `browser.tabs.query` and `storage.local.onChanged` for unset, accepted, and declined states.
- [ ] The existing consent gate still blocks picker arming, capture, and queueing.
- [ ] `bun run compile` and `bun run test` pass.
- [ ] One conventional commit; ticket status and phase README updated with the SHA.

## Notes

- R7 is inherited from before 017. It is fixed here because the review asked for all findings.
- The likely shape: move the panel body into a child component that only mounts after acceptance, so `usePanel` is never created behind the gate.
