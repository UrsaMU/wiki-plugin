# @ursamu/wiki-plugin

> File-based markdown wiki for [UrsaMU](https://github.com/UrsaMU/ursamu) — pages, categories, revision history, access control, backlinks, wikilinks, Discord webhooks, and reply-watch subscriptions.

## Install

```bash
ursamu plugin install https://github.com/UrsaMU/wiki-plugin
```

Or pin to a release:

```bash
ursamu plugin install https://github.com/UrsaMU/wiki-plugin --ref v1.0.0
```

Requires UrsaMU **≥ 1.9.0**.

## Commands

| Command | Syntax | Lock | Description |
|---------|--------|------|-------------|
| `+wiki` | `+wiki [<path>]` | connected | Read a wiki page or list a directory. |
| `+wiki/search` | `+wiki/search <query>` | connected | Full-text search across all visible pages. |
| `+wiki/tags` | `+wiki/tags` | connected | List all tags with counts. |
| `+wikiwatch` | `+wikiwatch <path>` | connected | Toggle watch subscription on a page. |
| `@wiki/create` | `@wiki/create <path>=<title>/<body>` | admin+ | Create a new page. |
| `@wiki/edit` | `@wiki/edit <path>=<new body>` | admin+ | Replace page body. |
| `@wiki/delete` | `@wiki/delete <path>` | admin+ | Delete a page and its history. |
| `@wiki/move` | `@wiki/move <path>=<new-path>` | admin+ | Rename/move a page. |
| `@wiki/tag` | `@wiki/tag <path>=<tag1,tag2,...>` | admin+ | Set tags on a page. |
| `@wiki/fetch` | `@wiki/fetch <url>=<wiki-path>` | admin+ | Download a remote asset into the wiki. |
| `@wiki/lock` | `@wiki/lock <path>=<lock>` | admin+ | Set readLock (`connected\|admin\|staff\|faction:<id>`). |
| `@wiki/draft` | `@wiki/draft <path>=<on\|off>` | admin+ | Toggle draft (staff-only visibility). |
| `@wiki/webhook` | `@wiki/webhook <dir>=<url>` | admin+ | Set Discord webhook for a directory. |
| `@wiki/restore` | `@wiki/restore <path>=<timestamp>` | admin+ | Restore a page from a history snapshot. |
| `@wiki/diff` | `@wiki/diff <path>=<t1>/<t2>` | admin+ | Compare two snapshots. |
| `@wiki/history` | `@wiki/history <path>` | admin+ | List available history snapshots. |

## REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/wiki` | optional | List all visible pages. |
| `GET` | `/api/v1/wiki?q=<query>` | optional | Full-text search. |
| `GET` | `/api/v1/wiki/tags` | optional | List all tags. |
| `GET` | `/api/v1/wiki/<path>` | optional | Read a page or directory listing. |
| `POST` | `/api/v1/wiki` | Bearer (admin+) | Create a page. |
| `PATCH` | `/api/v1/wiki/<path>` | Bearer (admin+) | Update a page. |
| `PUT` | `/api/v1/wiki/<path>` | Bearer (admin+) | Upload a binary asset. |
| `DELETE` | `/api/v1/wiki/<path>` | Bearer (admin+) | Delete a page. |
| `GET` | `/api/v1/wiki/<path>/history` | optional | List revision timestamps. |
| `GET` | `/api/v1/wiki/<path>/backlinks` | optional | List pages that link here. |
| `POST` | `/api/v1/wiki/<path>/watch` | Bearer | Toggle watch subscription. |

## Access Control

Pages support a `readLock` frontmatter field:

| Value | Visible to |
|-------|-----------|
| *(unset)* | Everyone (public) |
| `connected` | Logged-in players |
| `admin` | Admin+/wizard/superuser only |
| `staff` | Admin+/wizard/superuser only (alias) |
| `faction:<id>` | Players with `faction.<id>` flag |

Draft pages (`draft: true`) are only visible to staff.

## Storage

| Collection | Schema | Purpose |
|------------|--------|---------|
| `wiki.subscriptions` | `{ id, playerId, path, createdAt }` | Per-player page watch subscriptions |

Wiki pages are stored as markdown files under the `wiki/` directory (configurable via `WIKI_DIR`).
Revision history is stored under `wiki/.history/`.

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `wiki:created` | `WikiPageRef` | Fired after a page is created. |
| `wiki:edited` | `WikiPageRef` | Fired after a page is updated. |
| `wiki:deleted` | `WikiPageRef` | Fired after a page is deleted. |
| `wiki:renamed` | `WikiPageRef` | Fired after a page is moved. |

## Discord Webhooks

Configure per-directory webhooks with `@wiki/webhook <dir>=<url>`. Webhooks fire on create, edit, delete, and rename events for pages within that directory subtree.

Only `https://` URLs with non-private hosts are accepted (SSRF-guarded).

## License

MIT
