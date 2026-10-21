# Screenshot capture under rapid multi-pick

Type: research
Status: resolved
Blocked by: none

## Question

Can the existing screenshotter capture up to four element crops reliably when Cmd/Ctrl+clicks arrive faster than the 500ms throttle? Establish:

- Chrome `tabs.captureVisibleTab` quota (calls per second) and what happens on exceed.
- Current `createElementScreenshotter` behavior: 500ms sleep, visibility check, crop by the capture-time box.
- Does a delayed capture crop the right pixels if the page scrolls or the element moves between click and capture?
- Is one viewport frame plus N crops from that frame viable? What breaks when elements sit at different scroll positions?
- Recommendation: capture per pick (status quo), batch at finish, or skip screenshots for elements picked faster than the throttle.

Write `plans/015-element-set/research-screenshot-capture.md` with findings, options, and a recommendation. No code changes.

## Answer

Recommendation: skip screenshots for elements picked faster than the throttle. Chrome allows two `captureVisibleTab` calls per one-second fixed window; four rapid picks cannot all be captured, and the current sleep-based throttle is not a queue, so extra calls reject and are silently dropped. Capture immediately at pick time when a token is free; keep the element without a shot otherwise. Details: [research-screenshot-capture.md](../research-screenshot-capture.md).
