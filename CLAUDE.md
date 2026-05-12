# wiki-plugin — Claude Code Instructions

## Project identity

External UrsaMU plugin: file-based markdown wiki with revision history,
access control, Discord webhooks, wikilinks, and reply-watch subscriptions.
Targets ursamu **^2.3.0**.

- **Ecosystem skill**: load `/ursamu-dev` before working here.
- **API reference**: `/Users/kumakun/.claude/skills/ursamu-dev/references/api-reference.md`
  is authoritative for every type, method, import path, and event payload.
  Read it before writing code. Never guess signatures.

---

## Commands

```bash
deno task check    # type-check entry (mod.ts)
deno task lint     # must be clean
deno task test     # full suite
```

## Pre-commit checklist (all must pass)

```bash
deno check --unstable-kv mod.ts
deno lint
deno test --allow-all --unstable-kv --no-check tests/
```

---

## Repo layout

```
mod.ts                       Plugin entry — re-exports default + helpers
src/index.ts                 IPlugin export, hook wiring
src/commands/reading.ts      +wiki listings — format-hook aware
src/commands/writing.ts      @wiki/new, /edit, /delete, /move, /upload
src/commands/social.ts       +wikiwatch subscriptions
src/fs.ts                    Frontmatter parse/serialize, walk/find page
src/backlinks.ts             [[wikilink]] scan + resolution
src/history.ts               Per-page revision snapshots
src/permissions.ts           Read/write lock evaluation
src/router.ts                REST handler for /api/v1/wiki
src/webhook.ts               Discord webhook fire (SSRF-guarded)
src/hooks.ts                 wiki:created/edited/deleted/renamed hub
src/db.ts                    DBO("wiki.subscriptions"), DBO("wiki.webhooks")
tests/                       Deno test files
ursamu.plugin.json           Plugin manifest consumed by ursamu loader
```

---

## Imports

```typescript
import {
  addCmd, dbojs, DBO, gameHooks, send,
  registerPluginRoute,
  resolveFormat, type FormatSlot,
  registerFormatHandler, unregisterFormatHandler,
} from "@ursamu/ursamu";
import type { ICmd, IPlugin, IDBObj, IUrsamuSDK } from "@ursamu/ursamu";
```

DBO namespace rule: collection names prefixed with `wiki.`
(e.g. `wiki.subscriptions`, `wiki.webhooks`).

---

## addCmd skeleton — `+wiki`

The reading command uses one catch-all switch pattern:
`/^\+wiki(?:\/(search|tag|recent|toc|backlinks))?\s*(.*)/i`. Sub-commands
branch inside the main `exec`, never as separate `addCmd`s (catch-all
gotcha — see ursamu CLAUDE.md).

```typescript
addCmd({
  name: "+wiki",
  pattern: /^\+wiki(?:\/(\S+))?\s*(.*)/i,
  lock: "connected",
  category: "Wiki",
  help: `+wiki[/<switch>] [<path>]  — Browse the wiki.`,
  exec: async (u) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = (u.cmd.args[1] ?? "").trim();
    // ...
  },
});
```

### Lock levels — same as core

`""`, `"connected"`, `"connected builder+"`, `"connected admin+"`,
`"connected wizard"`.

---

## Format hooks (v2.3+)

Wiki listings support two slots resolved via `resolveFormat`:

| Slot | `%0` value | Effect |
|------|------------|--------|
| `WIKILISTFORMAT` | Default rendered block | Full-listing override |
| `WIKIROWFORMAT`  | Default rendered row   | Per-entry row override |

Two-tier lookup (mirrors WHO/PS): `#0` (game-wide) → enactor (`u.me`) →
plugin handler → built-in default.

Helper (in `src/commands/reading.ts`):

```typescript
async function resolveGlobalFormat(u, slot, defaultArg) {
  const root = await dbojs.queryOne({ id: "0" });
  if (root) {
    const onRoot = await resolveFormat(u, root as IDBObj, slot as FormatSlot, defaultArg);
    if (onRoot != null) return onRoot;
  }
  return await resolveFormat(u, u.me, slot as FormatSlot, defaultArg);
}
```

Cast unknown slot names as `slot as FormatSlot` — plugin-defined slot
names are not in the core union but `resolveFormat` accepts any string
at runtime.

Every list-style display in `reading.ts` (root index, directory listing,
search, /tag, /recent, /backlinks) routes through the same helper.

---

## Key SDK idioms

```typescript
// Strip MUSH codes BEFORE DB ops or length checks (always)
const clean = u.util.stripSubs(u.cmd.args[0]).trim();

// DB writes — op must be "$set" | "$inc" | "$unset" only
await subscriptions.modify({ id }, "$set", { ... });

// Target resolution — always guard
const target = await u.util.target(u.me, raw, true);
if (!target) { u.send("Not found."); return; }
```

---

## MUSH color codes

| Code | Effect | Code | Effect |
|------|--------|------|--------|
| `%ch` | Bold | `%cn` | Reset (close every open code) |
| `%cr` | Red | `%cg` | Green |
| `%cb` | Blue | `%cy` | Yellow |
| `%cw` | White | `%cc` | Cyan |
| `%r`  | Newline | `%t` | Tab |

---

## Plugin lifecycle (three phases — non-negotiable)

```
Phase 1 — module load   import "./commands/*.ts" → addCmd() fires at load
Phase 2 — init()        register routes, attach wikiHooks listeners → true
Phase 3 — remove()      detach hooks with the SAME named function reference
```

Pair every `wikiHooks.on(evt, fn)` in `init()` with `wikiHooks.off(evt, fn)`
in `remove()` using the same named reference.

---

## Test patterns

Required boilerplate for tests that touch service layer:

```typescript
const OPTS = { sanitizeResources: false, sanitizeOps: false };
Deno.test("desc", OPTS, async () => { /* ... */ });
```

Format-hook integration tests follow the mail-plugin pattern: real
`dbojs` + `registerFormatHandler` from the JSR export. Required cases:

- no attrs → default rendering preserved
- `@wikilistformat` set → block override wins, exactly one `send`
- `@wikirowformat` set → per-row override wraps each entry
- two-tier: `#0` consulted before enactor
- plugin handler fallback runs when no attribute is set

Close DB in the last test: `await DBO.close()`.

---

## Code style (non-negotiable)

- Early return over nested conditions.
- No function longer than 50 lines.
- No file longer than 200 lines (commands/reading.ts is the exception
  while format-hook wiring is in flight).
- No bare `catch` — always `catch (e: unknown)`.
- Library-first.
- Max nesting depth 3.

---

## Audit checklist

- [ ] `u.util.stripSubs()` on user strings before DB ops or length checks
- [ ] DB writes use `$set` / `$inc` / `$unset`
- [ ] `u.util.target()` results null-checked
- [ ] All `%c*` codes closed with `%cn`
- [ ] Every `addCmd` has `help:` with syntax + ≥2 examples
- [ ] `wikiHooks.on()` paired with matching `wikiHooks.off()`
- [ ] DBO namespace prefixed (`wiki.*`)
- [ ] REST handlers return 401 before any work when `userId` is null
- [ ] `init()` returns `true`
- [ ] Format-hook calls use `resolveGlobalFormat` two-tier helper

---

## PRs and commits

- No Claude/AI attribution in PR titles, commit messages, or code comments.
- Squash-merge feature PRs.
- Tag versions after merge: `git tag v<version> && git push --tags`.
