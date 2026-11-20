const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const wishesEndpoint = supabaseUrl ? `${supabaseUrl}/rest/v1/wishes` : "";

export const wishesApiConfigured = Boolean(supabaseUrl && publishableKey);

function apiHeaders(extra = {}) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    ...extra,
  };
}

async function readResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* Keep the server response below. */ }
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || text || `HTTP ${response.status}`);
  }
  return data;
}

export async function fetchWishes() {
  if (!wishesApiConfigured) throw new Error("Supabase 配置尚未完成。");
  const response = await fetch(`${wishesEndpoint}?select=id,content,created_at&order=created_at.desc&limit=100`, {
    headers: apiHeaders(),
  });
  return readResponse(response);
}

export async function submitWish(content) {
  if (!wishesApiConfigured) throw new Error("Supabase 配置尚未完成。");
  const response = await fetch(wishesEndpoint, {
    method: "POST",
    headers: apiHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({ content }),
  });
  const rows = await readResponse(response);
  return rows?.[0];
}
