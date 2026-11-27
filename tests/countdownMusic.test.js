import assert from "node:assert/strict";
import { test } from "node:test";
import { createCountdownMusic } from "../src/countdownMusic.js";

function setup(t, play) {
  const instances = [];
  class AudioMock {
    paused = true;
    currentTime = 0;
    constructor(src) { this.src = src; instances.push(this); }
    async play() { if (play) await play(); this.paused = false; }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === "src") this.src = ""; }
    load() { this.loaded = true; }
  }
  for (const [key, value] of Object.entries({ Audio: AudioMock, document: { hidden: false } })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  return instances;
}

test("beautiful.mp3 loops, pauses without seeking, and resets when leaving the countdown", async (t) => {
  const instances = setup(t);
  const music = createCountdownMusic();
  const audio = instances[0];
  assert.equal(audio.src, "/beautiful.mp3");
  assert.equal(audio.loop, true);
  assert.equal(await music.start(), true);
  audio.currentTime = 42;
  music.pause();
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 42);
  await music.start();
  assert.equal(audio.currentTime, 42);
  music.reset();
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.paused, true);
  assert.equal(instances.length, 1, "reuse one audio element instead of overlapping tracks");
  music.dispose();
  assert.equal(audio.src, "");
  assert.equal(await music.start(), false);
});

test("a delayed autoplay result cannot restart music after pause or backgrounding", async (t) => {
  let resolve;
  setup(t, () => new Promise((done) => { resolve = done; }));
  const music = createCountdownMusic();
  const starting = music.start();
  music.pause();
  resolve();
  assert.equal(await starting, false);
  document.hidden = true;
  assert.equal(await music.start(), false);
  music.dispose();
});

test("blocked autoplay can be retried on a gesture using the same element", async (t) => {
  let blocked = true;
  const instances = setup(t, async () => { if (blocked) throw new Error("NotAllowedError"); });
  const music = createCountdownMusic();
  await assert.rejects(music.start(), /NotAllowedError/);
  blocked = false;
  assert.equal(await music.start(), true);
  assert.equal(instances.length, 1);
  music.dispose();
});
