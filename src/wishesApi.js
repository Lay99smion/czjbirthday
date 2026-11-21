import { WISH_LIMIT } from "./wishesCollection";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const wishesEndpoint = supabaseUrl ? `${supabaseUrl}/rest/v1/wishes` : "";
const wishFields = "id,content,created_at,is_pinned";

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
  const response = await fetch(`${wishesEndpoint}?select=${wishFields}&order=is_pinned.desc,created_at.desc,id.desc&limit=${WISH_LIMIT}`, {
    headers: apiHeaders(),
  });
  return readResponse(response);
}

export async function submitWish(content) {
  if (!wishesApiConfigured) throw new Error("Supabase 配置尚未完成。");
  const response = await fetch(`${wishesEndpoint}?select=${wishFields}`, {
    method: "POST",
    headers: apiHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({ content }),
  });
  const rows = await readResponse(response);
  return rows[0];
}
