/**
 * Two-tier format-hook helper for wiki listings.
 *
 * `WIKILISTFORMAT` overrides the entire rendered block; `WIKIROWFORMAT`
 * overrides each per-entry row. Resolution order mirrors the WHO/PS
 * pattern in ursamu core:
 *
 *   1. `#0` (game-wide skin) attribute
 *   2. enactor (`u.me`) attribute
 *   3. plugin handler registry (`registerFormatHandler`)
 *   4. built-in default
 *
 * `%0` inside a format string receives the default rendered block or row.
 */
import {
  dbojs,
  resolveFormat,
  type FormatSlot,
} from "@ursamu/ursamu";
import type { IDBObj, IUrsamuSDK } from "@ursamu/ursamu";

export type WikiFormatSlot = "WIKILISTFORMAT" | "WIKIROWFORMAT";

/** Consult `#0` first, then the enactor; return null if neither overrides. */
export async function resolveGlobalFormat(
  u: IUrsamuSDK,
  slot: WikiFormatSlot,
  defaultArg: string,
): Promise<string | null> {
  const root = await dbojs.queryOne({ id: "0" }).catch(() => null);
  if (root) {
    const rootObj = root as unknown as IDBObj;
    const onRoot = await resolveFormat(u, rootObj, slot as FormatSlot, defaultArg);
    if (onRoot != null) return onRoot;
  }
  return await resolveFormat(u, u.me, slot as FormatSlot, defaultArg);
}

/**
 * Render a list-style display with the two format slots applied. Caller
 * supplies a header (already wrapped in `%ch`/`%cn`), the per-entry rows,
 * and an optional footer. Each row passes through `WIKIROWFORMAT`; the
 * resulting block passes through `WIKILISTFORMAT`. If the block slot
 * overrides, exactly one `u.send` fires.
 */
export async function emitListing(
  u: IUrsamuSDK,
  opts: { header?: string; rows: string[]; footer?: string },
): Promise<void> {
  const renderedRows: string[] = [];
  for (const row of opts.rows) {
    const override = await resolveGlobalFormat(u, "WIKIROWFORMAT", row);
    renderedRows.push(override != null ? override : row);
  }

  const lines: string[] = [];
  if (opts.header) lines.push(opts.header);
  lines.push(...renderedRows);
  if (opts.footer) lines.push(opts.footer);
  const defaultBlock = lines.join("\n");

  const blockOverride = await resolveGlobalFormat(u, "WIKILISTFORMAT", defaultBlock);
  if (blockOverride != null) {
    u.send(blockOverride);
    return;
  }

  for (const line of lines) u.send(line);
}
