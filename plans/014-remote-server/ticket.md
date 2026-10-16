# 014: Remote server opt-in

**What to build:** Settings gains "Allow a remote server" (off by default). With it on, the server URL may point at another machine over http(s) — the pairing token and feedback then cross the network; credentials in the URL stay refused either way. Off, the loopback guard stays exactly as shipped. The error names the option so a pasted tailnet URL is self-explanatory.

Owner decisions (2026-10-16 question round): enable as an opt-in (not always-on, not removed); remote accepts http and https (tailnet http rides WireGuard; the opt-in copy says the link must be encrypted or trusted).

**Blocked by:** none.

**Status:** done · 05151fa

## Checklist

- [x] `connection/endpoint.ts`: `parseLoopbackUrl` → `parseServerUrl(value, { allowRemote })`; remote hosts accepted only when allowed; credentials/protocol checks unchanged; `SERVER_URL_ERRORS.remote` names the option; tests updated
- [x] `storage/settings.ts` + keys: `settings.allowRemote` (default false); `setSettings` validates the effective URL against the effective flag; turning the option off while a remote URL is stored is refused with the remote error
- [x] Policy threading: `connection/resolve.ts` (ConfiguredConnection gains `allowRemote`; both resolvers apply the settings flag), `connection/service.ts` bind, `connection/migrate.ts`, `connection/protocol.ts` `isConnectionIdentity` becomes syntax-level (policy enforced at resolve/bind/transport); `BackendConnectionConfig` → `OpenCodeBackendConfig` → `OpenCodeApiConfig` gain `allowRemote`, used by `requestJson` + `redeemPairingCode`; `send.ts` admits with the current settings flag
- [x] Options page: checkbox + warning copy; `use-settings-page` gains `allowRemote` / `saveAllowRemote`; tests updated
- [x] Consent disclosure wording: local server by default, remote only with the option on
- [x] Docs: `README.md` "Localhost only", `PRIVACY.md`, `CHROMEWEBSTORE.md` (5 spots), `product.md` (security + non-goal), `CONTEXT.md` (Remote server term)
- [x] `bun run compile` + `bun run test` + `bun run build` pass; CDP smoke: remote URL refused with the option off, accepted and attempted with it on; one conventional commit

## Outcome

Shipped in the phase commit (`feat(connection): opt-in remote server`; sha recorded by the follow-up docs commit). `bun run compile` exit 0; `bun run test` 49 files / 738 tests; `bun run build` exit 0. Live CDP smoke against the reachable tailnet server: 4/4.

**Shipped**

- `connection/endpoint.ts`: `parseServerUrl(value, { allowRemote })` replaces `parseLoopbackUrl`. Syntax, protocol, and credentials checks unchanged; a non-loopback host is refused unless allowed. `SERVER_URL_ERRORS.remote` now names the option: "…or turn on \"Allow a remote server\"".
- `storage/settings.ts` + `settings.allowRemote` (off by default). `setSettings` validates the effective URL against the effective flag, so enabling and saving a remote URL can happen in one patch, and turning the option off while a remote URL is stored is refused with the same error.
- Policy threading: `ConfiguredConnection` carries `allowRemote` from settings; `resolveConnection` applies the current flag; `bindOrigin` too; `migrate` uses the settings flag. `isConnectionIdentity` is syntax-level now (a brief comment says why) — the policy is enforced where the connection is used: resolve, bind, transport. `BackendConnectionConfig` → `OpenCodeBackendConfig` → `OpenCodeApiConfig` carry `allowRemote`; `requestJson` and `redeemPairingCode` enforce it, so a stored remote endpoint is refused by default even if it bypasses the earlier gates. `send.ts` builds the backend with the current settings flag, so queued items follow the policy at send time; the frozen endpoint itself is kept.
- Options page: "Allow a remote server" checkbox with warning copy (token and feedback cross the network; keep the link encrypted or trusted); `use-settings-page` gains `allowRemote` / `saveAllowRemote`.
- Consent disclosure and all outbound copy (`README.md`, `PRIVACY.md`, `CHROMEWEBSTORE.md`, `product.md`) now say: loopback by default, another machine only with the opt-in. `product.md` non-goal removed; decisions table gains the remote row; `CONTEXT.md` gains the "Remote server" term.

**Live check** (throwaway script `~/.cache/opencode-tmp/browsertalk-014-smoke/smoke14.mjs`, not committed)

- Fresh profile, remote URL `http://afifsohailig4.taila5c1b8.ts.net:15001/` typed with the option off → refused with the new message; storage untouched.
- Option ticked → flag stored; Save → canonical endpoint stored (trailing slash dropped).
- Side panel resolves the remote configured connection ("not connected · Not paired").
- Pairing a bogus code now reaches the remote host: the error is "That pairing code is wrong or expired" — the mapped 401 from the g4 machine over Tailscale (curl confirms that endpoint returns exactly that), not the local guard.

**Divergences / decisions**

- The policy is evaluated from current settings at every use point (resolve, bind, transport, send), not baked into stored destinations. Turning the option off while an item is queued for a remote server makes that item fail honestly with the guard error.
- The message change rippled into ~11 test literals; all converted, none dropped.
- `isConnectionIdentity` accepting remote endpoints syntactically is safe: without a stored token the only outcome is "Not paired".

**Next-phase must-know**

- Remote is opt-in per install, not per connection; the flag is global in settings.
- Chrome-for-Web-Store copy is updated in-repo; the store listing and privacy URL need the same wording at the next submission.
