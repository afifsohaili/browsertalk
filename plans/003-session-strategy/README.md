# Phase 003 — session seam + settings

Status: tickets cut (2026-10-10): `ticket-01-seam.md`, `ticket-02-settings.md`.

Decisions locked 2026-10-10:

- Strategies: per-day (per project per day) + sticky (one long-lived session per project; "+ new session" rolls over).
- Selection: per-backend default + settings override. The settings UI ships with this phase.
- Roadmap: lands right after connection (002); absorbs the old phase-005 strategy work and old phase-007 settings.
- Distribution: Chrome Web Store, public from the first release. License: MIT.

Research:

- `research-agent-sessions.md` — session models of opencode, Claude Code, pi, Codex CLI, Gemini CLI; integration paths; strategy matrix; the six axes the seam must abstract.
- `research-chrome-store.md` — store publishing requirements, policy friction map, publish + open-source checklist.
