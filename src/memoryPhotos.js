import { memories } from './memories.js';

// Warm the film's first frames during the countdown, then the rest with the cake.
// Keep image references so decoded photos can be reused by the slideshow.
const preloaded = new Map();
export function preloadMemoryPhotos({ limit = memories.length } = {}) {
  if (typeof Image === 'undefined') return;
  for (const [index, photo] of memories.entries()) {
    if (index >= limit) break;
    if (preloaded.has(photo.src)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = index < 2 ? 'high' : 'low';
    image.onerror = () => { preloaded.delete(photo.src); };
    preloaded.set(photo.src, image);
    image.src = photo.src;
    image.decode?.().catch(() => { /* The film offers a retry if a request fails. */ });
  }
}
