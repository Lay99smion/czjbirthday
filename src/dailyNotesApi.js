export function createDailyNotesApi({ url, key, request = globalThis.fetch }) {
  const root = url?.trim().replace(/\/+$/, "");
  const configured = Boolean(root && key?.trim());

  // This project only reads. Entries are maintained in the Supabase Table Editor.
  async function fetchDailyNotes({ before, signal } = {}) {
    if (!configured) throw new Error("碎碎念数据服务尚未配置。");
    const query = new URLSearchParams({
      select: "id,date,content",
      order: "date.desc,id.desc",
      limit: "20",
    });
    if (before) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(before.date) || !/^\d+$/.test(String(before.id)))
        throw new Error("碎碎念翻页位置无效。");
      query.set("or", `(date.lt.${before.date},and(date.eq.${before.date},id.lt.${before.id}))`);
    }
    const response = await request(`${root}/rest/v1/daily_notes?${query}`, {
      headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("暂时无法读取碎碎念。");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("碎碎念数据格式无效。");
    return rows.filter((row) => row && /^\d+$/.test(String(row.id)) && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && typeof row.content === "string");
  }
  return { configured, fetchDailyNotes };
}

const api = createDailyNotesApi({
  url: import.meta.env?.VITE_SUPABASE_URL,
  key: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
});
export const dailyNotesApiConfigured = api.configured;
export const fetchDailyNotes = api.fetchDailyNotes;
