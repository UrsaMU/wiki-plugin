/**
 * Integration test: @wikilistformat / @wikirowformat hooks on wiki listings.
 *
 * Uses real `dbojs` from jsr:@ursamu/ursamu and the plugin-handler registry
 * (registerFormatHandler) — both are publicly exported. Verifies the
 * two-tier resolution (#0 → enactor) and confirms the listing-helper
 * `emitListing` honors both block and row overrides while preserving the
 * default rendering otherwise.
 *
 * %0 is the default rendered string (block or row) supplied to the handler.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  dbojs,
  DBO,
  registerFormatHandler,
  unregisterFormatHandler,
  type FormatHandler,
  type FormatSlot,
  type IDBObj,
  type IUrsamuSDK,
} from "@ursamu/ursamu";
import { emitListing } from "../src/format.ts";

const OPTS = { sanitizeResources: false, sanitizeOps: false };
const SLOW = { timeout: 15000 };

const ROOT  = "0";
const ACTOR = "920001";

async function cleanup() {
  for (const id of [ROOT, ACTOR]) {
    await dbojs.delete({ id }).catch(() => {});
  }
}

async function seed() {
  await cleanup();
  await dbojs.create({
    id: ROOT,
    flags: "room",
    data: { name: "Root", attributes: [] },
  });
  await dbojs.create({
    id: ACTOR,
    flags: "player connected",
    data: { name: "Alice" },
  });
}

function mockU(): IUrsamuSDK & { _sent: string[] } {
  const sent: string[] = [];
  const me = {
    id: ACTOR,
    name: "Alice",
    flags: new Set(["player", "connected"]),
    state: { name: "Alice" },
    location: "",
    contents: [],
  } as unknown as IDBObj;

  const u = {
    me,
    socketId: "wiki-fmt-sock",
    send: (m: string) => { sent.push(m); },
    util: {
      stripSubs: (s: string) => s,
      displayName: (o: IDBObj) => o.name ?? "Unknown",
      center: (s: string) => s,
      ljust: (s: string, w: number) => s.padEnd(w),
      rjust: (s: string, w: number) => s.padStart(w),
    },
  } as unknown as IUrsamuSDK & { _sent: string[] };

  (u as unknown as { _sent: string[] })._sent = sent;
  return u;
}

const sampleRows = ["alpha", "beta", "gamma"];
const sampleHeader = "%ch=== WIKI ===%cn\n--------------------";
const sampleFooter = "--------------------";

Deno.test("wiki: no attrs, no handler — default rendering preserved", { ...OPTS, ...SLOW }, async () => {
  await seed();
  const u = mockU();
  await emitListing(u, { header: sampleHeader, rows: sampleRows, footer: sampleFooter });
  // header + each row + footer, separately sent.
  assertEquals(u._sent.length, 1 + sampleRows.length + 1);
  const out = u._sent.join("\n");
  assertStringIncludes(out, "alpha");
  assertStringIncludes(out, "beta");
  assertStringIncludes(out, "gamma");
  await cleanup();
});

Deno.test("wiki: WIKILISTFORMAT plugin handler replaces the whole block", { ...OPTS, ...SLOW }, async () => {
  await seed();
  const handler: FormatHandler = (_u, _t, defaultBlock) => `<<BLOCK>>\n${defaultBlock}\n<</BLOCK>>`;
  registerFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
  try {
    const u = mockU();
    await emitListing(u, { header: sampleHeader, rows: sampleRows, footer: sampleFooter });
    const out = u._sent.join("\n");
    assertStringIncludes(out, "<<BLOCK>>");
    assertStringIncludes(out, "<</BLOCK>>");
    // Block override fires exactly one send.
    assertEquals(u._sent.length, 1);
  } finally {
    unregisterFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
    await cleanup();
  }
});

Deno.test("wiki: WIKIROWFORMAT plugin handler wraps each row", { ...OPTS, ...SLOW }, async () => {
  await seed();
  const handler: FormatHandler = (_u, _t, row) => `ROW>${row}<ROW`;
  registerFormatHandler("WIKIROWFORMAT" as FormatSlot, handler);
  try {
    const u = mockU();
    await emitListing(u, { header: sampleHeader, rows: sampleRows, footer: sampleFooter });
    const out = u._sent.join("\n");
    const matches = out.match(/ROW>/g) ?? [];
    assertEquals(matches.length, sampleRows.length);
    assertStringIncludes(out, "alpha");
    assertStringIncludes(out, "gamma");
  } finally {
    unregisterFormatHandler("WIKIROWFORMAT" as FormatSlot, handler);
    await cleanup();
  }
});

Deno.test("wiki: two-tier — #0 consulted before enactor", { ...OPTS, ...SLOW }, async () => {
  await seed();
  const seen: string[] = [];
  const handler: FormatHandler = (_u, target, _arg) => { seen.push(target.id); return null; };
  registerFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
  try {
    const u = mockU();
    await emitListing(u, { header: sampleHeader, rows: sampleRows, footer: sampleFooter });
    assertEquals(seen[0], ROOT, "should consult #0 first");
    assertEquals(seen[1], ACTOR, "then fall through to enactor");
  } finally {
    unregisterFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
    await cleanup();
  }
});

Deno.test("wiki: plugin handler fallback runs when no attr is set", { ...OPTS, ...SLOW }, async () => {
  await seed();
  const handler: FormatHandler = (_u, _t, defaultBlock) => `HANDLER:${defaultBlock.split("\n")[0]}`;
  registerFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
  try {
    const u = mockU();
    await emitListing(u, { header: sampleHeader, rows: sampleRows, footer: sampleFooter });
    const out = u._sent.join("\n");
    assertStringIncludes(out, "HANDLER:");
  } finally {
    unregisterFormatHandler("WIKILISTFORMAT" as FormatSlot, handler);
    await cleanup();
    await DBO.close();
  }
});
