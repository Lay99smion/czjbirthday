import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl } from '../src/assets.js';

test('photos, audio, and home links follow the deployment base path', () => {
  for (const base of ['/czjbirthday/', '/czjbirthday']) {
    assert.equal(assetUrl('/memories/time1.webp', base), '/czjbirthday/memories/time1.webp');
    assert.equal(assetUrl('/蜡笔小新.m4a', base), '/czjbirthday/蜡笔小新.m4a');
    assert.equal(assetUrl('', base), '/czjbirthday/');
  }
  assert.equal(assetUrl('/time1.webp'), '/time1.webp');
  assert.equal(assetUrl('pic2.webp', '/'), '/pic2.webp');
});
