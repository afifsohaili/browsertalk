# Agent session models — research for the Browsertalk session-strategy seam

Research date: 2026-10-10. Scope: opencode, Claude Code, pi (pi-mono), Codex CLI, Gemini CLI + one paragraph on ACP.

Method: primary sources only — official docs, OpenAPI/source code, first-party SDK references. Every claim has an inline URL. Anything not verifiable from those sources is marked **unconfirmed**. Version notes are given per backend. Shell verification used `curl` against the URLs listed; the raw GitHub links were fetched and grepped directly.

Context of the consumer: `/home/afifsohaili/Projects/browsertalk/lib/agent-backend/interface.ts` defines `AgentBackend` = `ping / listProjects / createSession / sendFeedback`, and `product.md` locks "one session per (project, day)" with title `Browsertalk · <project> · <YYYY-MM-DD>`, created via `POST /api/session` `{title, location:{directory}}` and fed via `POST /api/session/{id}/prompt` `{text, delivery}` on an opencode 2.0.24 server.

---

## 1. Comparison table

| | **opencode v2** | **Claude Code** | **pi** | **Codex CLI** | **Gemini CLI** |
|---|---|---|---|---|---|
| **Session identity** | Server record, ID pattern `^ses` (`ses_…`); `Session.Info` carries `title`, `projectID`, `location:{directory}`, times, outcome | UUID; JSONL transcript at `~/.claude/projects/<munged-cwd>/<session-id>.jsonl`; tied to a project directory | Session ID (UUID by default; custom IDs allow letters/digits/`.`/`_`/`-`) + JSONL file at `~/.pi/agent/sessions/--<munged-cwd>--/<timestamp>_<id>.jsonl` | Thread ID (UUID); app-server uses `thr_…`, `thread.sessionId` = live tree root; rollout JSONL under `$CODEX_HOME/sessions` (default `~/.codex/sessions`), archived under `archived_sessions` | Session UUID; JSON history at `~/.gemini/tmp/<project_hash>/chats/`; project-scoped |
| **Create (named?)** | `POST /api/session` with `title`, `location:{directory}` — named at create; `opencode session list\|export\|import\|delete` manage them | `claude` (interactive) or `claude -p` (headless); `--session-id <uuid>` forces the ID; `-n/--name` sets display name; SDK `title` option; `renameSession()` retro-names | `pi` (new session), `--session-id <id>` "opens the exact project session ID or creates it if absent"; `-n/--name`; RPC `new_session` + `set_session_name` | TUI `codex` starts a thread; app-server `thread/start`; `thread/name/set` names it (name is a resume handle: `codex resume <name>`); `codex exec` creates a thread per run (thread_id in `--json`) | Every run is a new session UUID; `--session-id <uuid>` picks it (error if it exists); **no naming mechanism found** → sessions are labeled by first prompt |
| **Reuse / resume** | Use the session ID directly; sessions persist until `DELETE /api/session/:id`; CLI `opencode run --continue` / `opencode mini --continue` continue the last one | `claude -c/--continue` (most recent in cwd), `claude -r/--resume [id\|name\|transcript-path]`; `/resume` in-session; same session ID by default (`--fork-session` copies); `claude -p --resume <id>` appends to the same session | `-c/--continue`, `-r/--resume` (picker), `--session <path\|id>`, `--session-id <id>`, `--fork`; RPC `switch_session`, `fork`, `clone`; `/resume`, `/new`, `/name`, `/session` in TUI | `codex resume [SESSION_ID]` (`--last`, `--all`, `--include-non-interactive`); `codex fork`; `codex exec resume --last\|<SESSION_ID>`; app-server `thread/resume` | `gemini --resume` (= latest), `--resume 1` (index), `--resume <uuid>`; `gemini -r "<id>" "query"`; `/resume` session browser; `--session-file <path>` imports JSON as a **new** session |
| **List sessions** | `GET /api/session` with `limit`, `order`, `search`, `parentID`, `directory`, `project`, `subpath`, `cursor`; `GET /api/session/active`; CLI `opencode session list --format json` | Not from CLI headless; SDK `listSessions({dir,limit,includeWorktrees})`; interactive picker; `claude agents --json` for background sessions; raw file reads discouraged (internal format) | **No RPC/CLI list command found**; bridge can read `~/.pi/agent/sessions/**` JSONL or use the Node SDK (`SessionManager`, sessions example); interactive picker only | app-server `thread/list` (filters: `cwd`, `archived`, `searchTerm`, `sourceKinds`, pagination); `codex resume` picker; no exec list | `gemini --list-sessions` (index, short id, first prompt, age); `/resume` browser (search by ID/content, delete) |
| **Send into existing session** | `POST /api/session/:id/prompt` `{text, delivery?}` → durable inbox item; optional `id`, `files`, `agents`, `skills`, `metadata`, `resume` | `claude -p --resume <session-id> --output-format json "…"` (reloads transcript); or a live SDK/stream-json process | CLI: `pi --print --session <path\|id>` (mode docs: session options are mode-independent). RPC: `prompt` after `switch_session`; `steer`, `follow_up` | `codex exec resume <SESSION_ID> "…"`; app-server `turn/start` with `threadId`; `turn/steer` for an active turn | Headless `gemini -p -r <id> "…"` (source-verified path); ACP `session/prompt` after `session/load` |
| **Integration path for a Chrome extension** | Direct HTTP to the local server (extension can call it). Loopback; basic-auth/pairing token. JS client `@opencode/client`; ACP also available | No HTTP API documented (native MCP is client-only). Bridge must spawn CLI (`claude -p --resume`) or embed the Agent SDK (Node/Python). ACP only via third-party adapter. `claude remote-control` is for Anthropic clients, not local tools (**unconfirmed** as a local API) | Bridge must spawn `pi --mode rpc` (JSONL over stdio; extension can't spawn). A Node bridge can use the pi SDK instead. Community ACP adapter exists | Bridge; either one-shot `codex exec --json` + `exec resume`, or long-lived `codex app-server` JSON-RPC (stdio default; ws/unix experimental). TS/Python SDK; ACP adapter exists | Bridge; `gemini -p` headless or `gemini --acp` (JSON-RPC stdio). No HTTP server mode found |
| **Busy semantics** | Prompt endpoint is durable admission — it queues (`delivery:"queue"`) or steers (`delivery:"steer"`) rather than erroring; inbox list/cancel/patch; `POST /:id/interrupt` (±`resume=true`); `POST .../wait` waits for idle; TUI: Enter steers, Ctrl+X Enter queues; over ACP a second concurrent prompt **errors** | Messages sent during a turn are queued ("If you send a command while Claude is responding, Claude Code queues it"); SDK `interrupt()` only in streaming input mode, receipt lists `still_queued`, `cancel_queued` cancels them (capability-gated); `queued_turn_count`; a piped `claude -p --resume` against a *running* background session sends nothing and exits 1 | `prompt` while streaming **errors unless** `streamingBehavior` (`steer` = after current turn's tool calls, before next LLM call; `followUp` = after agent stops); `clear_queue` returns pending texts; `abort`; queue modes `all` / `one-at-a-time`; `agent_settled` = no automatic work left | `turn/steer` appends to the active turn but **fails when no turn is active** (`expectedTurnId` must match); `turn/interrupt` cancels (turn ends `status:"interrupted"`); `turn/start` while a turn is active — **unconfirmed**; `toolOutput` is explicitly queued into an active turn | Not documented for concurrent prompts (ACP/interactive/headless) → **unconfirmed** |
| **Meaning of "new thread"** | New `ses_` record; TUI `/new` (v2). Empty history, new title, can bind to another directory | New conversation; old one is saved and stays resumable. `/clear` (aliases `/reset`, `/new`) starts empty context; `/branch`/`--fork-session` copy history into a new ID | New session file; TUI `/new`, RPC `new_session`; `--session-id <fresh-id>` creates one | New thread; `codex`, app-server `thread/start`; `codex exec` = new thread per run; `thread/fork` copies history to a new `thr_` | New UUID session; every launch without `-r` is new. No explicit `/new` command needed; `/chat save <name>` tags checkpoints instead |

---

## 2. opencode (v2)

Sources: https://opencode.ai/v2/docs/api/ , https://opencode.ai/v2/openapi.json , https://opencode.ai/v2/docs/cli/tui/ , https://opencode.ai/v2/docs/cli/commands/ , https://opencode.ai/v2/docs/cli/acp/ , https://opencode.ai/v2/docs/build/client/ , v1 docs at https://opencode.ai/docs/server/ , repo https://github.com/anomalyco/opencode .

Version note: the site now has two doc sets. `opencode.ai/docs` describes the v1 server (paths `/session`, `/project`, `/global/health`, `/doc`, `/event`). `opencode.ai/v2/docs` describes the v2 HTTP API, which lives under `/api/*` and matches what Browsertalk verified against the live 2.0.24 server. The v2 API describes itself as "Experimental HttpApi surface for selected instance routes" (https://opencode.ai/v2/docs/api/). The canonical OpenAPI 3.1 spec is served at `/doc` on a server (v1) and published at https://opencode.ai/v2/openapi.json (v2).

### Session model

- A session is a server-side record. IDs match `^ses`; child sessions carry `parentID`; forks record a `Session.ForkBoundary`. `Session.Info` fields: `id`, `parentID`, `fork`, `projectID`, `agent`, `model`, `cost`, `tokens`, `outcome` (`succeeded|failed|interrupted`), `time` (`created`, `updated`, `idle`, `viewed`, `archived`), `title`, `subpath`, `metadata`, `permissions`, `revert`, `location` (https://opencode.ai/v2/openapi.json, schema `Session.Info`).
- `location` is `Location.PublicRef` = `{ directory: string }` — sessions are bound to a directory (https://opencode.ai/v2/openapi.json).
- Multiple sessions per project exist. TUI: `Ctrl+X` `N` starts a new session; `Ctrl+X` `L` or `/sessions` returns to an existing session; `Ctrl+O` opens recent sessions and projects together; tabs are enabled by default (https://opencode.ai/v2/docs/cli/tui/).
- Storage path on disk: not documented on the v2 pages reviewed. The official way to print server paths is `opencode debug paths` (https://opencode.ai/v2/docs/cli/commands/). Exact DB/session path **unconfirmed**.
- `opencode serve` runs the API/web server; `--hostname`, `--port`, `--cors`; the background service can be managed with `opencode service start|restart|status|stop|get|set` (https://opencode.ai/v2/docs/cli/commands/). Stock example port is `4096`; this machine's systemd server on `15001` is a deployment choice.

### Lifecycle

- Create: `POST /api/session` body `{ id?, parentID?, title?, agent?, model?, location?, metadata?, permissions? }` → `{ data: Session.Info }`. Description: "Create a session at the requested location. A parentID creates a linked child session at its parent's location." (https://opencode.ai/v2/openapi.json). This confirms `{title, location:{directory}}`.
- Reuse: there is no resume step — any prompt targeting an existing `ses_` ID picks the session up. Sessions persist until `DELETE /api/session/:id`.
- CLI: `opencode run "…"` (one-shot, prints reply), `--continue` continues last session, `--format json`, `--file`, `--standalone`, `--server <url>`; `opencode mini --continue`; `opencode session list|delete|export|import` (https://opencode.ai/v2/docs/cli/commands/).
- "New thread" = a new session record. TUI: `/new` is listed among common commands; API: `POST /api/session` (https://opencode.ai/v2/docs/cli/tui/, https://opencode.ai/v2/openapi.json).

### HTTP API (exact endpoints, v2)

From the published OpenAPI (https://opencode.ai/v2/openapi.json):

| Op | Endpoint |
|---|---|
| Create pairing code | `POST /api/pair` → `PairingCode {code, expires_in}` |
| Redeem pairing code | `GET /auth/connect/{code}`; JSON accept returns `PairingSession {token}` "to use as the password" |
| List projects | `GET /api/project` |
| List sessions | `GET /api/session` with query `limit` (default newest 50), `order` (`asc\|desc`), `search`, `parentID` (`null` = root sessions only), `directory`, `project`, `subpath`, `cursor` → `SessionsResponse {data: Session.Info[], cursor:{previous,next}}` |
| Active sessions | `GET /api/session/active` → `{data: {[sesID]: {type:"running"}}}` |
| Get/update/delete session | `GET/PATCH/DELETE /api/session/{sessionID}` (PATCH body `{title?, metadata?, permissions?}`) |
| Send message | `POST /api/session/{sessionID}/prompt` body `{ id? (^msg_), text (required), files?, agents?, skills?, metadata?, delivery? ("steer"\|"queue"\|null), resume? (boolean) }` → `{data: Session.Inbox.User}` |
| Interrupt | `POST /api/session/{sessionID}/interrupt` query `resume=true\|false` → `{interrupted: boolean}` |
| Wait for idle | `POST /api/experimental/session/{sessionID}/wait` → 204 |
| Inbox | `GET /api/session/{sessionID}/inbox`; `PATCH/DELETE /api/session/{sessionID}/inbox/{inboxID}` (PATCH changes `delivery`; "Steering wakes session execution"; DELETE "Cancel an inbox input … Unavailable items are a no-op") |
| Compact | `POST /api/session/{sessionID}/compact` |
| Fork | `POST /api/session/{sessionID}/fork` |
| Commands | `POST /api/session/{sessionID}/command` body `{name, text, …delivery?}` |
| Events | `GET /api/event` (subscription) |
| Command list | `GET /api/command` |

The JS client `@opencode/client` mirrors these (`client.session.create({location:{directory}})`, `client.session.prompt({sessionID, text})`, `client.event.subscribe()`) and documents that event subscriptions are "live-only, with no replay or automatic reconnection" (https://opencode.ai/v2/docs/build/client/).

Browsertalk's product.md claims re-verified: `POST /api/session` + `{title, location:{directory}}` ✅; `POST /api/session/{id}/prompt` + `{text, delivery}` where delivery is `queue|steer` ✅; `GET /api/session` list ✅; `GET /api/project` ✅; `POST /api/pair` + `GET /auth/connect/{code}` ✅. (`opencode pair` CLI prints one-time links + QR; "Links expire after 5 minutes and work once" — https://opencode.ai/v2/docs/cli/commands/.)

### Busy semantics

- `prompt` "Durably admit[s] one session input and schedule[s] agent-loop execution unless resume is false" — messages are admitted, not rejected, while busy (https://opencode.ai/v2/openapi.json).
- `delivery` is `"steer"|"queue"` (`Session.Inbox.Delivery`). TUI behavior: "While OpenCode is working, Enter steers the active session; press Ctrl+X, then Enter to queue the prompt for later." (https://opencode.ai/v2/docs/cli/tui/).
- `interrupt` "Interrupt active execution owned by this OpenCode process… When resume=true, execution resumes pending steering input and next-in-line control items (manual compaction, moves) while queued prompts remain parked." (https://opencode.ai/v2/openapi.json).
- `SessionBusyError` (409 with `_tag: "SessionBusyError"`, `sessionID`, `message`) exists on some endpoints (e.g. revert stage/clear/commit), not on prompt/interrupt (https://opencode.ai/v2/openapi.json).
- Over ACP: "A session runs one prompt at a time. OpenCode returns an error for a second `session/prompt` while the first is active." (https://opencode.ai/v2/docs/cli/acp/).

### TUI session UX

- Session list/switch: `/sessions` (v1 aliases `/resume`, `/continue`; https://opencode.ai/docs/tui/). New: `/new` (v1 alias `/clear`; v2 lists `/new` among common commands).
- Titles: settable via API (`title` on create, PATCH to change). Whether the v1/v2 TUI renders session titles in the list is **unconfirmed** from the pages fetched.

### Integration path for a Chrome extension

Direct HTTP from the extension to the local server (loopback only in Browsertalk's design). Auth via `OPENCODE_SERVER_PASSWORD` basic auth (v1 server doc: https://opencode.ai/docs/server/) or the pairing token from `POST /api/pair` → `GET /auth/connect/{code}`. No bridge needed. ACP (`opencode acp`) is an alternative but still subprocess-based, so it needs a bridge anyway.

---

## 3. Claude Code

Sources: https://code.claude.com/docs/en/sessions , https://code.claude.com/docs/en/cli-reference , https://code.claude.com/docs/en/commands , https://code.claude.com/docs/en/headless , https://code.claude.com/docs/en/agent-sdk/typescript .

### Session model

- "A session is a saved conversation tied to a project directory." Stored as JSONL at `~/.claude/projects/<project>/<session-id>.jsonl`, where `<project>` is the working directory path with non-alphanumeric characters replaced by `-`; a converted name over 200 characters is truncated and given a path hash. "The entry format is internal to Claude Code and changes between versions, so scripts that parse these files directly can break on any release." (https://code.claude.com/docs/en/sessions).
- Session ID is a UUID. `--session-id` "Use a specific session ID for the conversation (must be a valid UUID)" (https://code.claude.com/docs/en/cli-reference).
- Multiple sessions exist per project. The picker lists the current worktree's sessions (background sessions marked `bg`), `Ctrl+W` widens to all worktrees of the repo, `Ctrl+A` to every project on the machine (https://code.claude.com/docs/en/sessions).
- Names: `-n/--name`, `/rename`, `Ctrl+R` in the picker; unnamed sessions get a generated title from the *first prompt* by a small model — "A `claude -p` run you start directly from a shell or script doesn't get one." (https://code.claude.com/docs/en/sessions).

### Lifecycle (exact flags)

- New: `claude` (interactive) or `claude -p "query"` (headless). Each `-p` run creates a session unless `--no-session-persistence` (print mode only) or `CLAUDE_CODE_SKIP_PROMPT_HISTORY` (https://code.claude.com/docs/en/cli-reference).
- `--continue`, `-c`: "Load the most recent conversation in the current directory… Skips sessions created with `claude -p` or the Agent SDK, and sessions whose first prompt was `/loop`. `claude -p --continue` includes `-p`, SDK, and `/loop` sessions." (https://code.claude.com/docs/en/cli-reference).
- `--resume`, `-r`: "Resume a specific session by ID or name, or show an interactive picker… In place of an ID, you can pass the absolute path to a session's `.jsonl` transcript file." Search order: current project dir + worktrees, then every other project on the machine (v2.1.223+) (https://code.claude.com/docs/en/cli-reference, https://code.claude.com/docs/en/sessions).
- Resuming reuses the original session ID unless `--fork-session` ("create a new session ID instead of reusing the original") (https://code.claude.com/docs/en/cli-reference).
- Headless resume is documented: `claude -p --resume <session-id> --output-format json "summarize what we changed" | jq -r '.result'` and `session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id'); claude -p "Continue that review" --resume "$session_id"` (https://code.claude.com/docs/en/sessions, https://code.claude.com/docs/en/headless).
- Slash commands: `/clear [name]` — "Start a new conversation with empty context. Pass a name to label the previous conversation in the `/resume` picker… Aliases: `/reset`, `/new`." `/compact [instructions]` — summarize in place, same conversation. `/resume [session]` — alias `/continue`. `/branch [name]` and `/fork` copy the conversation; accepting a plan or `/rename` names sessions (https://code.claude.com/docs/en/commands, https://code.claude.com/docs/en/sessions).
- After `/clear` the previous conversation "is saved; resume it with `/resume`" (https://code.claude.com/docs/en/sessions). So yes, old sessions stay resumable. They age out under the retention sweep (`cleanupPeriodDays`, default 30 days) or `claude purge` (https://code.claude.com/docs/en/cli-reference).

### "One long thread" reality (per-project)

- Mechanism: run `claude` in the project dir and use `-c`/`--continue`, or `/resume`; session IDs are stable, and `-p --resume <id>` appends to the same session (no `--fork-session`). Context growth is handled by `/compact`, auto-compact window (`/autocompact`, `--autocompact`), and the resume-from-summary dialog (https://code.claude.com/docs/en/sessions, https://code.claude.com/docs/en/commands).
- Visibility caveat that matters for Browsertalk: sessions created by `claude -p` or the Agent SDK "are left out of the session picker and out of `claude --continue`. You can still resume one by passing its session ID to `claude --resume <session-id>`." (https://code.claude.com/docs/en/sessions). So per-day machine-created sessions do not appear in the user's picker.

### Agent SDK

- TypeScript package `@anthropic-ai/claude-agent-sdk`; `query({prompt, options})` (https://code.claude.com/docs/en/agent-sdk/typescript).
- Resume: `options.resume` = "Session ID to resume"; `options.continue` = continue most recent; `options.forkSession` = "When resuming with `resume`, fork to a new session ID instead of continuing the original session"; `options.sessionId` = force a UUID; `options.persistSession` = false disables disk persistence; `options.title` = display title (https://code.claude.com/docs/en/agent-sdk/typescript).
- Session management functions: `listSessions({dir?, limit?, includeWorktrees?})` → `SDKSessionInfo {sessionId, summary, customTitle, firstPrompt, gitBranch, cwd, tag, createdAt, lastModified}`; `getSessionMessages()`; `getSessionInfo()`; `renameSession(sessionId, title)`; `tagSession()` (https://code.claude.com/docs/en/agent-sdk/typescript).
- Streaming input mode: `prompt` can be an `AsyncIterable<SDKUserMessage>` and `streamInput(stream)` feeds a live session. `Query.interrupt()` "Only available in streaming input mode"; the receipt lists `still_queued` user messages; a direct control-protocol client can set `cancel_queued: true` (capability `interrupt_cancel_queued_v1`, Claude Code v2.1.219+). `queued_turn_count` reports messages still waiting in the command queue when a result is produced (https://code.claude.com/docs/en/agent-sdk/typescript).
- SDK versioning: "The SDK version tracks the bundled Claude Code version" (https://code.claude.com/docs/en/agent-sdk/typescript).

### Busy semantics

- Interactive: "If you send a command while Claude is responding, Claude Code queues it and runs it after the current turn finishes." (https://code.claude.com/docs/en/commands).
- Concurrent processes: "If you resume the same session in two terminals without forking, messages from both interleave into one transcript." (https://code.claude.com/docs/en/sessions).
- Running background session: `claude --resume <session> "prompt"` from a shell attaches and sends the prompt as the next turn, but that path is disabled when the command has piped/redirected I/O or output/config flags — it sends nothing and exits with status 1 (https://code.claude.com/docs/en/sessions). A bridge using piped I/O therefore cannot inject into a *running* background session.
- SDK: queued delivery + `interrupt()` + `cancel_queued` as above.

### External control options

- No local HTTP API for sessions is documented; native MCP support is client-side (Claude Code connects out to MCP servers). `claude remote-control` starts a server "to control Claude Code from Claude.ai or the Claude app" and requires a claude.ai subscription — no local third-party API is documented (**unconfirmed** whether any local socket/daemon protocol exists; the background-session supervisor has a socket directory per `claude daemon status` but the protocol is not documented).
- Practical paths: (a) bridge spawns `claude -p --resume <uuid> …` per send; (b) bridge runs a long-lived process with `--input-format stream-json` (print mode; `--replay-user-messages` acks user messages) (https://code.claude.com/docs/en/cli-reference); (c) bridge embeds the Agent SDK and calls `query({resume})`, `listSessions`, `renameSession`.
- ACP: no native mention anywhere in Claude Code docs (checked `https://code.claude.com/docs/llms.txt` for "acp" — zero matches). ACP access exists via the `agentclientprotocol/claude-agent-acp` adapter in the ACP registry (see §7).

---

## 4. pi (pi-mono)

Sources: repo https://github.com/earendil-works/pi (note: `github.com/badlogic/pi-mono` redirects here; the README is fetched from the `earendil-works/pi` name), docs under `packages/coding-agent/docs/`: `cli.md`, `rpc.md`, `rpc-commands.md`, `json.md`, `sessions.md`, `session-format.md`, `sdk.md`, `cli-integration.md`, `usage.md`. Package: `@earendil-works/pi-coding-agent`. Site: https://pi.dev/docs/latest.

### Session model

- A session is a JSONL file. File path: `~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl`, where `<path>` is the working directory with the leading separator removed and `/`, `\`, `:` replaced by `-`; `<session-id>` is a UUID by default or custom via the SDK/`--session-id` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md).
- File format: first line is a session header `{type:"session",version:3,id,timestamp,cwd}`; subsequent entries form a tree via `id`/`parentId`. Entry types include `message`, `model_change`, `thinking_level_change`, `usage`, `compaction`, `context_edit`, `branch_summary`, `custom`, `custom_message`, `label`, `session_info`. The session display name is a `session_info` entry (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md).
- Sessions are grouped by working directory; default storage `~/.pi/agent/sessions/`, overridable with `--session-dir`, `PI_CODING_AGENT_SESSION_DIR`, or the `sessionDir` setting (CLI flag wins) (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md).
- Multiple sessions per project; the picker supports search, rename, and delete (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md). Deleting = removing the `.jsonl` file, or select + `Ctrl+D` in `/resume` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md).

### Lifecycle (exact flags)

From https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md and sessions.md:

- `-c`, `--continue` — "Continues the most recent session for the current project."
- `-r`, `--resume` — "Opens the session selector."
- `--session <path|id>` — "Opens by file path, exact ID, or partial ID. Pi searches the current project first and offers to fork a cross-project match."
- `--session-id <id>` — "Opens the exact project session ID or creates it if absent. IDs accept letters, numbers, `.`, `_`, and `-`."
- `--fork <path|id>`; `--session-dir <dir>`; `--no-session` (in-memory); `-n`, `--name`.
- Constraints: `--fork` cannot combine with `--session`, `--continue`, `--resume`, `--no-session`; `--session-id` cannot combine with `--session`, `--continue`, `--resume`.
- TUI slash commands: `/new` starts a session, `/resume` picks another, `/name` names it, `/session` shows file/ID/message count/usage; `/tree`, `/fork`, `/clone`, `/compact` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md, sessions.md).
- "New thread" = new session file (`/new`, RPC `new_session`, or a fresh `--session-id`).

### RPC mode (`pi --mode rpc`)

- Long-lived subprocess; JSONL commands on stdin, responses and session events on stdout; strict LF framing; stdout is protocol-only (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).
- Start: `pi --mode rpc --no-session`; "Normal CLI options still select the working folder, model, tools, resources, and session behavior. Common choices include `--provider`, `--model`, `--name`, `--no-session`, and `--session-dir`." RPC rejects `@file` prompt args (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).
- Commands (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md):
  - `prompt` `{message, images?, streamingBehavior?}` — **while streaming you must pass `streamingBehavior` or the command errors**: `"steer"` (delivered after the current assistant turn's tool calls, before the next LLM call) or `"followUp"` (only when the agent stops). Response `data.disposition` is `"handled"`/`"queued"`/`"started"`.
  - `steer`, `follow_up` — queue commands (response `disposition: "queued"`).
  - `abort`, `clear_queue` (returns `{steering:[…], followUp:[…]}`); "abort continues queued messages when they remain in the session."
  - `new_session` (optional `parentSession`), `switch_session` (`{sessionPath}`), `fork` (`{entryId}`), `clone`, `get_fork_messages`.
  - `get_state` → `{model, thinkingLevel, isStreaming, isCompacting, steeringMode, followUpMode, sessionFile, sessionId, sessionName, autoCompactionEnabled, messageCount, pendingMessageCount}`.
  - `get_messages`, `get_entries` (cursor via `since` entry id), `get_tree`, `get_last_assistant_text`.
  - `set_session_name` `{name}`; initial name via `pi --mode rpc -n <name>`.
  - `compact`, `set_auto_compaction`, `set_auto_retry`, `abort_retry`; `set_steering_mode`/`set_follow_up_mode` (`"all"` | `"one-at-a-time"`, default one-at-a-time); `bash`, `abort_bash`; `get_session_stats`, `export_html`; `set_model`, `cycle_model`, `get_available_models`, `set_thinking_level`, `get_commands`.
- **No session-list command exists in RPC** (checked the full command reference). A bridge lists sessions by reading `~/.pi/agent/sessions/**/*.jsonl` (format above) or by using the Node SDK, whose sessions example covers "creating, opening, continuing, listing, and forking sessions" (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md). `RpcClient` and `rpc-types.ts` are published for TypeScript (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).
- Events: `agent_start`, `turn_start/end`, `message_start/update/end`, `tool_execution_*`, `queue_update {steering, followUp}`, `compaction_*`, `auto_retry_*`, `session_info_changed {name}`; wait for `agent_settled` to know Pi will not continue automatically (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md).

### Busy semantics

- Prompt while running without `streamingBehavior` → error. With `steer`/`followUp` → queued; `queue_update` events reflect both complete queues; `clear_queue` drains them. `abort` stops the active run and waits for idle. Queue processing modes are `all` or `one-at-a-time` per category (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md).
- SDK wording: "A prompt sent while the session is already streaming must specify whether it should steer the current run or follow it. Calling `prompt()` without that choice rejects rather than guessing." (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md).

### Bridge design constraints

- The extension cannot spawn processes; the bridge spawns `pi` and speaks JSONL RPC, exposing Browsertalk's HTTP contract. Per-send one-shots are also possible with `pi --print --session <id> "…"` because "CLI options still select the working directory, model, tools, resources, and session persistence independently of the mode" (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md). A one-shot bridge per send loses the RPC queue features; a long-lived RPC bridge keeps them.
- pi has **no ACP support in-tree** (no `acp` string anywhere in the repo tree at the time of research); the ACP registry lists a community adapter, `svkozak/pi-acp` (see §7).

---

## 5. Codex CLI

Sources: repo https://github.com/openai/codex ; docs https://developers.openai.com/codex/noninteractive , https://developers.openai.com/codex/app-server.md , https://developers.openai.com/codex/codex-sdk.md ; CLI/option reference https://learn.chatgpt.com/docs/developer-commands.md?surface=cli ; env/config https://learn.chatgpt.com/docs/config-file/environment-variables.md ; source https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs , https://github.com/openai/codex/blob/main/codex-rs/rollout/src/lib.rs .

### Session model

- A thread is "a conversation between a user and the Codex agent. Threads contain turns." (https://developers.openai.com/codex/app-server.md).
- Persisted as rollout JSONL files. `SESSIONS_SUBDIR: &str = "sessions"` and `ARCHIVED_SESSIONS_SUBDIR: &str = "archived_sessions"` (https://github.com/openai/codex/blob/main/codex-rs/rollout/src/lib.rs). `CODEX_HOME` "Sets the root for Codex state, including config, auth, logs, sessions, skills…" default `~/.codex` (https://learn.chatgpt.com/docs/config-file/environment-variables.md). → sessions live under `~/.codex/sessions`, archived under `~/.codex/archived_sessions`.
- App-server `thread` objects carry `id` (`thr_…`), `sessionId` ("identifies the current live session tree root. Root threads use their own thread id as the session id; forked threads keep the session id of the root they came from"), `name`, `preview`, `status` (`notLoaded|idle|systemError|active` with `activeFlags`), pagination metadata (https://developers.openai.com/codex/app-server.md).
- `codex exec --json` emits `thread.started` with `thread_id` (example: `"0199a213-81c0-7800-8aa1-bbab2a035a53"`), plus `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error` (https://developers.openai.com/codex/noninteractive).
- Names: app-server `thread/name/set` "set or update a thread's user-facing name"; `codex resume` accepts "Session id (UUID) or session name" (https://developers.openai.com/codex/app-server.md, https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs). `thread/list` supports `searchTerm` (case-sensitive fragment of the extracted title), `cwd`, `archived`, `sourceKinds`, pagination (https://developers.openai.com/codex/app-server.md).

### Lifecycle (exact subcommands/flags)

From https://learn.chatgpt.com/docs/developer-commands.md?surface=cli and https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs:

- `codex` — interactive; `codex resume [SESSION_ID]` — "Continue an interactive session by ID or resume the most recent chat"; `--last` (most recent, scoped to cwd unless `--all`), `--all`, `--include-non-interactive` ("Include non-interactive sessions in the resume picker and `--last` selection"), `--cd/-C` override; `tui.resume_cwd` = `"current"` or `"session"` controls the directory prompt.
- `codex fork [SESSION_ID] [--last] [--all]` — "Fork a previous interactive session into a new chat."
- `codex exec "task"` — non-interactive ("streams progress to stderr and prints only the final agent message to stdout"); `--json` JSONL events; `--ephemeral` ("don't want to persist session rollout files to disk"); `--sandbox read-only|workspace-write|danger-full-access` (default read-only); `--skip-git-repo-check`; `-o/--output-last-message <path>`; `--output-schema`; `CODEX_API_KEY` (https://developers.openai.com/codex/noninteractive).
- Resume non-interactively: `codex exec resume --last "fix the race conditions you found"` or `codex exec resume <SESSION_ID>` (https://developers.openai.com/codex/noninteractive).
- Slash commands: `/resume` "Resume a saved chat from your session list" (https://learn.chatgpt.com/docs/developer-commands.md?surface=cli). `/goal pause|resume|edit|clear` exists too.

### exec mode (event stream)

- JSONL on stdout with `--json`; event types `thread.started` (carries `thread_id`), `turn.started`, `turn.completed` (with `usage`), `turn.failed`, `item.*`, `error`; item types include agent messages, reasoning, command executions, file changes, MCP tool calls, web searches, plan updates (https://developers.openai.com/codex/noninteractive).

### app-server / SDK / MCP

- `codex app-server` is "the interface Codex uses to power rich clients (for example, the Codex VS Code extension)… open source in [codex-rs/app-server]". Transports: stdio JSONL (default), `--listen ws://IP:PORT` (experimental; also serves `GET /readyz`, `/healthz`), `unix://`, `off`. Remote TUI: `codex app-server --listen ws://127.0.0.1:4500` then `codex --remote ws://127.0.0.1:4500` (https://developers.openai.com/codex/app-server.md).
- Protocol: JSON-RPC 2.0 (header omitted on the wire). `initialize` + `initialized` required once per connection. Thread methods: `thread/start`, `thread/resume`, `thread/fork` (`lastTurnId`, `ephemeral`), `thread/read` (`includeTurns`), `thread/list`, `thread/turns/list`, `thread/items/list`, `thread/loaded/list`, `thread/name/set`, `thread/archive|delete|unarchive`, `thread/compact/start`, `thread/shellCommand`, `thread/metadata/update`; turn methods: `turn/start` (input items text/image/localImage, per-turn overrides), `turn/steer` (requires `expectedTurnId`, "fails if there is no active turn on the thread"), `turn/interrupt` ("the turn ends with `status: "interrupted"`"); plus `command/exec`, `model/list`, `fs/*`, plugin/skills/marketplace methods (https://developers.openai.com/codex/app-server.md).
- Schema generation: `codex app-server generate-ts --out ./schemas` / `generate-json-schema` (https://developers.openai.com/codex/app-server.md).
- SDK: TypeScript `@openai/codex-sdk` — `new Codex()`, `codex.startThread()`, `thread.run(prompt)`, `codex.resumeThread(threadId)`; Python `openai-codex` — `Codex()`, `thread_start`, `AsyncCodex`, sandbox presets; "Published SDK builds include a pinned Codex CLI runtime dependency" (https://developers.openai.com/codex/codex-sdk.md). The SDK page states: use the SDK to automate; use app-server to build custom clients.
- MCP server mode is gone: "The `codex mcp-server` command and standalone `codex-mcp-server` binary have been removed. Use the Codex app server for existing integrations." (https://developers.openai.com/codex/codex-sdk.md).

### Busy semantics

- `turn/steer` appends input to the active turn; fails with no active turn; no new `turn/started` notification (https://developers.openai.com/codex/app-server.md).
- `turn/interrupt` cancels; success returns `{}` and the turn ends interrupted (https://developers.openai.com/codex/app-server.md).
- `turn/start` while a turn is active: not documented for user input. The one documented queue case: `toolOutput` "If a regular turn is already active, Codex queues the output for that turn." (https://developers.openai.com/codex/app-server.md) — user-turn behavior **unconfirmed**.
- Concurrent `codex exec` runs against the same rollout file: **unconfirmed**.

### External control summary

- One-shot bridge: `codex exec --json` captures `thread_id`; later `codex exec resume <thread_id> "…"`. No title at exec time; naming is app-server/TUI territory. Non-interactive sessions are hidden from `codex resume` selection unless `--include-non-interactive`.
- Deep bridge: run `codex app-server` and use `thread/start`, `thread/name/set`, `thread/resume`, `thread/list`, `turn/start`, `turn/steer`, `turn/interrupt`. This is the fullest per-session control surface of the five backends.

---

## 6. Gemini CLI

Sources: repo https://github.com/google-gemini/gemini-cli ; docs https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md , `cli-reference.md`, `headless.md`, `acp-mode.md`, `checkpointing.md`; source https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/config.ts and `packages/cli/src/gemini.tsx`.

### Session model

- "Sessions are stored in `~/.gemini/tmp/<project_hash>/chats/`, where `<project_hash>` is a unique identifier based on your project's root directory. Sessions are project-specific." (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md).
- Session history is recorded automatically: prompts/responses, tool executions, token stats, assistant thoughts. Sessions are UUIDs; `--list-sessions` output shows an index, a short id, first prompt, and relative time (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md).
- Retention settings: `general.sessionRetention {enabled, maxAge: "30d", maxCount, minRetention: "1d"}`; `model.maxSessionTurns` (interactive: informational stop; non-interactive: exits with an error) (same page).
- No session naming/titling mechanism was found in docs or CLI flags; the browser shows the first user prompt. Title support **unconfirmed/absent**.

### Lifecycle (exact commands/flags)

From https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md and `cli-reference.md`:

- `gemini --resume` / `-r` — resume latest (`--resume` maps to `RESUME_LATEST` in source: https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/config.ts); `gemini --resume 1` by index; `gemini --resume <uuid>` by ID. `gemini -r "latest" "query"` continues with a new prompt.
- `gemini --list-sessions` — list sessions for the current project and exit; `gemini --delete-session <index|id>`.
- `gemini --session-id <uuid>` — "Start a new session with a manually provided UUID." Source: if the ID exists, it errors with `Session ID "<id>" already exists. Use --resume to resume it, or provide a different ID.` (https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/config.ts, `gemini.tsx`). `--resume`, `--session-id`, and `--session-file` are mutually exclusive.
- `gemini --session-file <path>` — "Load a session from a JSON file"; source creates a **new** session ID for the imported content (https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/gemini.tsx).
- Interactive: `/resume` opens the Session Browser (browse, preview, search, select, delete with `x`); `/chat …` aliases; checkpoints: `/resume save <name>`, `/resume list`, `/resume resume <name>` (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md). There is no `/new`; each run without `-r` is a new session.
- "New thread" = new UUID session (new process run). Old sessions resume by index/UUID and remain until retention deletes them.

### Headless mode

- `gemini -p/--prompt "query"` forces non-interactive; `--output-format text|json|stream-json`; JSON = `{response, stats, error?}`; stream-json events: `init` (session ID, model), `message`, `tool_use`, `tool_result`, `error`, `result`; exit codes `0`, `1`, `42` (input error), `53` (turn limit) (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md).
- Headless resume: docs don't show it, but the source resolves `--resume`/`--session-id`/`--session-file` in `resolveSessionId()` before the mode branch, and `runNonInteractive({…, resumedSessionData})` receives the resumed data (https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/gemini.tsx). So `gemini -p -r "<id>" "query"` is supported by the code path; the combination is not documented. The CLI reference's documented form is `gemini -r "latest" "query"` (interactive-style).

### ACP / external control

- `gemini --acp` starts "an Agent Client Protocol server over stdin and stdout": JSON-RPC 2.0; methods `initialize`, `authenticate`, `newSession`, `loadSession`, `prompt`, `cancel`, plus `setSessionMode`, `unstable_setSessionModel`; file system access is proxied through the ACP client (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md).
- Note: current source defines `--acp` ("Starts the agent in ACP mode") and keeps `--experimental-acp` as deprecated with help text "Starts the agent in ACP mode (deprecated, use --acp instead)" (https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/config.ts). The older cheatsheet still lists `--experimental-acp` (https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md); both are official files, so cite `--acp` as current.
- The docs' ACP method list has **no `session/list`**; whether the implementation supports listing over ACP is **unconfirmed**.
- No HTTP server mode was found. A bridge is required either way (spawn `gemini --acp` or `gemini -p`).

### Busy semantics

- Not documented for concurrent prompts in interactive, headless, or ACP modes → **unconfirmed**. Each `-p` invocation is a separate process; concurrently resuming the same session from two processes is not addressed in docs.

---

## 7. ACP (Agent Client Protocol), one paragraph

ACP standardizes editor↔agent communication over JSON-RPC: local agents run as subprocesses speaking JSON-RPC over stdio; remote agents over HTTP/WebSocket are "a work in progress" (https://agentclientprotocol.com/overview/introduction). Today all five backends are reachable through ACP, but in three different grades: **native** for OpenCode (`opencode acp`; capabilities advertise `session/list`, `session/resume`, `session/fork`, `session/close`, `session/delete`, plus one-prompt-at-a-time enforcement — https://opencode.ai/v2/docs/cli/acp/) and Gemini CLI (`gemini --acp`; `newSession`, `loadSession`, `prompt`, `cancel` — https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md); **adapter** for Claude (`agentclientprotocol/claude-agent-acp`) and Codex (`agentclientprotocol/codex-acp`), both maintained by the ACP org; and **community adapter** for pi (`svkozak/pi-acp`). All five appear in the ACP registry (https://agentclientprotocol.com/get-started/registry). What ACP would offer Browsertalk: one uniform session protocol (`session/new`, `session/prompt`, `session/load`, and for some agents `session/list`/`session/resume`) that a single bridge could speak to several backends, at the cost of a bridge anyway, adapter-specific capability differences, and no `session/list` guarantee (Gemini, pi-ACP, claude-agent-acp, codex-acp capability surfaces were not enumerated here — **unconfirmed** per adapter). What it does not offer: a way to bypass process spawning, since ACP itself is stdio-first. For opencode specifically, direct HTTP is strictly more capable than its ACP surface (durable inbox, steer/queue, interrupt-with-resume).

---

## 8. Strategy implications

The strategies that emerge for Browsertalk, and which backends constrain or favor them. "Favored" means the backend's own model makes it natural; "constrained" means documented behavior makes it awkward or impossible.

### S1. Per-day session (today's locked model)

Create `Browsertalk · <project> · <date>` on first send, reuse until local midnight.

| Backend | Verdict |
|---|---|
| opencode | **Favored.** Named create + list by title; prompt by ID; queue/steer. Fully matches the current code path |
| pi | **Favored.** `--session-id <project>-<date>` creates deterministically; `-n`/`set_session_name` names it; RPC can create and rename |
| Codex | **Supported, with a bridge.** app-server `thread/start` + `thread/name/set` gives a name that doubles as a resume handle (`codex resume <name>`). Exec-only bridges get a UUID and no title; exec sessions are hidden from `codex resume` unless `--include-non-interactive` |
| Claude Code | **Constrained.** Creation with a chosen ID works (`--session-id`), and the SDK can title (`title`, `renameSession`), but sessions created by `-p`/SDK **do not appear in the user's session picker or `--continue`**. The "findable in the TUI" property of the current model is lost unless sessions are created by a human interactive launch |
| Gemini CLI | **Supported but unnamed.** `--session-id <uuid>` gives a deterministic identity, but no naming mechanism exists, so the session browser shows only the first prompt. Per-day discoverability is weak |

### S2. Sticky single thread per project ("one long thread")

Never roll over; every feedback appends to one session per project.

| Backend | Verdict |
|---|---|
| Claude Code | **Favored by its own design.** `-c/--continue` and `-p --resume <id>` both append to the same session; `/compact` + auto-compact manage growth; `/clear` is the deliberate reset. This is the "one long thread" style the owner described |
| opencode | **Supported.** Prompting the same `ses_` ID indefinitely; compaction exists (`POST /:id/compact`); no daily split |
| pi | **Supported.** `-c` or a fixed `--session-id`; compaction and branch-summary handle growth |
| Codex | **Supported.** app-server `thread/resume` + `turn/start` appends to the same `thr_`; `thread/compact/start` compacts |
| Gemini | **Supported.** `-r <id> "query"` (and `-p -r <id>` per source) appends; no title, so the thread is only findable by UUID/index in the browser |

### S3. Per-send session (new session per feedback)

| Backend | Verdict |
|---|---|
| All | Creation is possible everywhere, but this maximizes session-list clutter and loses cross-feedback context — the two reasons the current model rejected it. Claude Code's `-p` invisibility actually hides the clutter but also hides the sessions; Gemini sessions are unnamed; opencode/pi sessions are titleable |

### S4. Manual pick (user chooses the target session per send, or once per binding)

Requires listing:

| Backend | List path | Notes |
|---|---|---|
| opencode | `GET /api/session` with `search`/`directory`/`cursor` | Direct from the extension |
| Codex | app-server `thread/list` (`cwd`, `searchTerm`, `archived`, pagination) | Bridge (app-server) |
| Claude Code | SDK `listSessions({dir})` or the interactive picker | Bridge with Node/Python SDK; raw JSONL parsing discouraged by docs |
| pi | No list RPC/CLI; read session directory or use Node SDK | Bridge |
| Gemini | `gemini --list-sessions` (index + short id) or session browser | Bridge |

### S5. Hybrid: sticky + rollover on demand ("+ new session")

Keep one thread per project, but let the user create a fresh one (today's panel "+ new session" behavior) — e.g. roll over when the session is large or the topic changes.

| Backend | Verdict |
|---|---|
| opencode | Favored: `POST /api/session` anytime, old one stays resumable |
| Claude Code | Favored semantics: `/clear`-equivalent (new conversation; old stays resumable), but a machine-created new session again is picker-invisible |
| pi | Supported: `new_session` RPC or a fresh `--session-id`; old file remains |
| Codex | Supported: `thread/start`; old thread remains in `thread/list`/`codex resume` |
| Gemini | Supported: next run is a new UUID; old sessions remain in retention |

### What the seam must abstract

Facts differ on six axes; the `AgentBackend` interface today (`createSession` + `sendFeedback(sessionID)`) covers only axis 1 and silently assumes axis 2.

1. **Session identity and addressability.** `ses_…` vs UUID vs file path (`~/.pi/agent/sessions/...` vs `~/.claude/projects/...` vs `~/.codex/sessions/...` vs `~/.gemini/tmp/...`). `SessionRef.id` is not always a server ID: for pi/Claude a path or UUID may be the handle; for Codex a thread id or name.
2. **Creation with a name.** `title` (opencode), `--name`/`title`/`renameSession` (Claude, with picker caveat), `-n`/`set_session_name` (pi), `thread/name/set` (Codex app-server), **nothing** (Gemini). Capability flag needed: `namedCreation`.
3. **Reuse mechanics.** Direct-addressing transports (opencode HTTP, pi RPC `switch_session`, Codex app-server `turn/start`) vs process-invocation flags (`--continue`/`--resume` on Claude, `codex exec resume`, `gemini -r`). Two shapes of `sendInto(session)`: "target existing handle" vs "spawn a process with a resume flag".
4. **Listing.** opencode and Codex app-server can list natively; Claude needs the SDK; pi needs directory reads or SDK; Gemini needs the CLI or directory reads. Capability flag: `listSessions`, and whether the list is filterable by directory/title.
5. **Busy/delivery.** Queue-by-default (opencode durable inbox; Claude message queue), steer-or-error (pi RPC requires `streamingBehavior`; Codex `turn/steer` requires an active turn; opencode over ACP errors on concurrent prompt), interrupt availability (all except Gemini, where it is unconfirmed). `DeliveryMode = 'queue' | 'steer'` is not universal; pi's model is a three-way (steer / followUp / error) and Codex separates steer (active turn only) from queue (toolOutput only, documented).
6. **Channel lifetime.** opencode = stateless HTTP per request. pi RPC, Codex app-server, and Claude stream-json are long-lived process channels that hold state and stream events; per-send process spawning (`claude -p --resume`, `codex exec resume`, `pi --print --session`, `gemini -p -r`) is the fallback for a bridge that does not want to manage processes.

Strategy matrix summary (what each backend constrains):

| Strategy | opencode | Claude Code | pi | Codex | Gemini |
|---|---|---|---|---|---|
| Per-day | favored | picker-invisible via -p/SDK | favored | ok via app-server naming | unnamed |
| Sticky | ok | favored | ok | ok | ok |
| Per-send | ok | hidden clutter | ok | ok | ok |
| Manual pick | direct | via SDK (bridge) | via files/SDK (bridge) | via app-server (bridge) | via CLI (bridge) |
| Named creation | yes | partial (picker caveat) | yes | yes (app-server) | no |

Two cross-cutting findings for the design:

- Claude Code is the outlier that makes the "one long thread" style the path of least resistance, because sessions created programmatically are not user-visible. Per-day sessions there are possible but invisible in the TUI — the opposite of the stated reason for the current strategy ("findable in TUI").
- A bridge process (already planned for pi in `product.md`) unlocks everything except opencode: Claude (CLI or SDK), pi (RPC), Codex (app-server), Gemini (ACP or `-p`). ACP is a candidate uniform protocol for the bridge, with opencode and Gemini native, Claude/Codex via ACP-org adapters, pi via a community adapter. opencode remains the only backend Browsertalk can drive with no bridge at all.

### Explicit gaps (unconfirmed)

- opencode: on-disk session storage path/format; whether the TUI renders session titles (API titles are confirmed).
- Claude Code: any local socket/HTTP control protocol beyond CLI/SDK (background-supervisor socket protocol is undocumented); whether `--name` applies to `-p` runs (the SDK `title` option is confirmed); exact queue-vs-interrupt default for SDK-streamed messages without an explicit timing.
- pi: no `list_sessions` RPC (absence checked in `rpc-commands.md`); whether `--session-id` is accepted together with `--mode rpc` (docs say CLI options select session behavior in RPC, but no explicit combination is shown).
- Codex: `turn/start` behavior while a turn is active; concurrent `codex exec` runs on one rollout; exact `codex exec resume` flag list (the docs render it via a client-side table component).
- Gemini: concurrent prompt semantics in any mode; `session/list` support over ACP; naming/title support; whether `-p` + `-r` is officially supported (source path only).
- ACP capability surfaces of the Claude/Codex/pi adapters were not enumerated individually.
