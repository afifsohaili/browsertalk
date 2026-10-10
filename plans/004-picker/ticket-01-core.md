# 004a: Picker core

**What to build:** The user arms the picker from any surface — side panel button, popup, `Alt+Shift+F`, or the page context menu — hovers and clicks an element, and the core facts are captured and handed to the background. Elements highlight with a tag/class label while hovering.

**Blocked by:** 003b — Settings page.

**Status:** ready-for-agent

- [ ] Arms from all four surfaces; disarms on Escape, click-out, or after selecting
- [ ] Hover: highlight + tag/class label; click selects the element
- [ ] Core facts captured per `product.md` §What gets captured: URL/title, tag/id/classes, selector path, text, key attributes, box/viewport/scroll
- [ ] Captured facts reach the background as one feedback item
- [ ] Top frame only; cross-origin iframe content documented as out of scope
- [ ] Collector logic unit-tested off-DOM where practical; `bun run compile` passes
- [ ] One conventional commit; phase doc updated
