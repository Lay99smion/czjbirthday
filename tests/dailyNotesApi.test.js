import assert from "node:assert/strict";
import { test } from "node:test";
import { createDailyNotesApi } from "../src/dailyNotesApi.js";

test("daily notes are read newest-first, without caching or editing endpoints", async () => {
  let called;
  const api = createDailyNotesApi({ url: "https://example.supabase.co/", key: "public-key", request: async (url, options) => {
    called = { url: new URL(url), options };
    return { ok: true, json: async () => [{ id: 1, date: "2026-11-27", content: "今天很好。" }] };
  } });
  const entries = await api.fetchDailyNotes();
  assert.equal(called.url.pathname, "/rest/v1/daily_notes");
  assert.equal(called.url.searchParams.get("select"), "id,date,content");
  assert.equal(called.url.searchParams.get("order"), "date.desc,id.desc");
  assert.equal(called.options.cache, "no-store");
  assert.equal(called.options.method, undefined);
  assert.equal(entries[0].content, "今天很好。");
});

test("both short entries and long multi-paragraph entries arrive intact", async () => {
  const long = "今天的小事。\n\n".repeat(8000) + "这一段有 emoji 🌙，和 <script>普通文字</script>。";
  const rows = [{ id: 2, date: "2026-11-27", content: long }, { id: 1, date: "2026-11-26", content: "晚安。" }];
  const api = createDailyNotesApi({ url: "https://example.supabase.co", key: "key", request: async () => ({ ok: true, json: async () => rows }) });
  assert.deepEqual(await api.fetchDailyNotes(), rows);
});

test("cursor pagination includes older entries on the same day and rejects malformed cursors", async () => {
  const calls = [];
  const api = createDailyNotesApi({ url: "https://example.supabase.co", key: "key", request: async (url) => {
    calls.push(new URL(url)); return { ok: true, json: async () => [] };
  } });
  await api.fetchDailyNotes({ before: { date: "2026-11-27", id: 42 } });
  assert.equal(calls[0].searchParams.get("or"), "(date.lt.2026-11-27,and(date.eq.2026-11-27,id.lt.42))");
  await assert.rejects(api.fetchDailyNotes({ before: { date: "2026-11-27", id: "42,content.neq.x" } }));
  assert.equal(calls.length, 1);
});

test("missing configuration and failed requests surface errors instead of claiming an empty diary", async () => {
  let calls = 0;
  const missing = createDailyNotesApi({ request: async () => { calls++; } });
  assert.equal(missing.configured, false);
  await assert.rejects(missing.fetchDailyNotes());
  assert.equal(calls, 0);
  const api = createDailyNotesApi({ url: "https://example.supabase.co", key: "key", request: async () => ({ ok: false }) });
  await assert.rejects(api.fetchDailyNotes(), /暂时无法读取/);
});
