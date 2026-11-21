export const WISH_LIMIT = 100;

function submillisecond(value) {
  // Postgres timestamps can distinguish submissions within the same millisecond.
  return Number((value.match(/\.(\d+)/)?.[1] || "").padEnd(6, "0").slice(3, 6));
}

// Mirror database ordering while the saved wish is animated into the bottle.
export function addSavedWish(wishes, savedWish) {
  const pinned = savedWish.is_pinned ? savedWish : wishes.find((wish) => wish.is_pinned);
  const byId = new Map();
  for (const wish of [savedWish, ...wishes]) {
    if (!wish.is_pinned && wish.id !== pinned?.id && !byId.has(wish.id)) byId.set(wish.id, wish);
  }
  const unique = [...byId.values()];
  unique.sort((a, b) => {
    const dateOrder = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateOrder) return dateOrder;
    const precisionOrder = submillisecond(b.created_at) - submillisecond(a.created_at);
    if (precisionOrder) return precisionOrder;
    return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
  });
  return pinned ? [pinned, ...unique.slice(0, WISH_LIMIT - 1)] : unique.slice(0, WISH_LIMIT);
}
