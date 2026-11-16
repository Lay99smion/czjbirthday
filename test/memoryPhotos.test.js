import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadMemoryPhotos } from '../src/memoryPhotos.js';
import { memories } from '../src/memories.js';

test('cover preloading uses the film URLs, prioritizes its opening photos, and reuses requests', t => {
  const previous = globalThis.Image;
  const images = [];
  globalThis.Image = class {
    constructor() { images.push(this); }
    decode() { return Promise.resolve(); }
  };
  t.after(() => { globalThis.Image = previous; });
  preloadMemoryPhotos();
  assert.deepEqual(images.map(image => image.src), memories.map(photo => photo.src));
  assert.ok(images.slice(0, 2).every(image => image.fetchPriority === 'high'));
  assert.ok(images.slice(2).every(image => image.fetchPriority === 'low'));
  preloadMemoryPhotos();
  assert.equal(images.length, memories.length, 'replays must reuse the warm images');
  images[0].onerror();
  preloadMemoryPhotos();
  assert.equal(images.length, memories.length + 1, 'a failed preload can be tried again');
  assert.equal(images.at(-1).src, memories[0].src);
});
