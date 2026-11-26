import assert from "node:assert/strict";
import { test } from "node:test";
import { cakeIntroFrame, CAKE_INTRO_DURATION, CAKE_FIREWORKS_START } from "../src/cakeIntroMotion.js";
import { createCakeIntroSoundTrack } from "../src/cakeIntroSound.js";
import { createBirthdayMusic } from "../src/birthdayMusic.js";

test("the rendered lights trigger five rising cues, then one star before fireworks", () => {
  const cues = [];
  let seconds = 0;
  const track = createCakeIntroSoundTrack((kind, tier) => cues.push({ kind, tier, seconds }));
  for (; seconds <= CAKE_INTRO_DURATION + 1; seconds += 1 / 60) {
    const state = cakeIntroFrame(seconds);
    track.update(state);
    track.update(state); // Resize/re-render of the same frame must stay silent.
  }
  assert.deepEqual(cues.map(({ kind, tier }) => [kind, tier]), [
    ...Array.from({ length: 5 }, (_, tier) => ["cake-rise", tier]),
    ["cake-star", undefined],
  ]);
  for (const cue of cues.slice(0, 5)) {
    const light = cakeIntroFrame(cue.seconds).lights - cue.tier * 0.18;
    assert.ok(light > 0 && light < 0.03, "cue plays as its tier begins lighting");
  }
  assert.ok(cues[5].seconds > 11.2 && cues[5].seconds < 11.4);
  assert.ok(cues[5].seconds < CAKE_FIREWORKS_START);
});

test("resuming and switching to a fallback do not replay consumed cues", () => {
  const cues = [];
  const track = createCakeIntroSoundTrack((...cue) => cues.push(cue));
  track.update(cakeIntroFrame(7));
  const before = cues.length;
  for (let i = 0; i < 100; i++) track.update(cakeIntroFrame(7));
  track.update(cakeIntroFrame(0));
  track.update(cakeIntroFrame(7));
  assert.equal(cues.length, before);
  track.update(cakeIntroFrame(13));
  assert.equal(cues.filter(([kind]) => kind === "cake-rise").length, 5);
  assert.equal(cues.filter(([kind]) => kind === "cake-star").length, 1);
});

test("enabling sound mid-scene plays future cues without a backlog", () => {
  const heard = [];
  let enabled = false;
  const track = createCakeIntroSoundTrack((...cue) => { if (enabled) heard.push(cue); });
  track.update(cakeIntroFrame(7));
  enabled = true;
  track.update(cakeIntroFrame(7));
  assert.equal(heard.length, 0);
  track.update(cakeIntroFrame(13));
  assert.equal(heard.filter(([kind]) => kind === "cake-star").length, 1);
  assert.ok(heard.filter(([kind]) => kind === "cake-rise").length < 5);
});

test("reduced motion uses one star chime instead of five simultaneous tier sounds", () => {
  const cues = [];
  const track = createCakeIntroSoundTrack((...cue) => cues.push(cue), true);
  track.update(cakeIntroFrame(0, 1, true));
  track.update(cakeIntroFrame(2, 1, true));
  assert.deepEqual(cues, [["cake-star"]]);
});

test("effects unlock without a song, rise in pitch, mute in the background, and stop on disposal", async (t) => {
  const contexts = [];
  class AudioContextMock {
    state = "suspended";
    currentTime = 10;
    destination = {};
    sources = [];
    constructor() { contexts.push(this); }
    async resume() { this.state = "running"; }
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
    createGain() { return { gain: this.param(), connect() {}, disconnect() {} }; }
    param() {
      return { values: [], setValueAtTime(value, when) { this.values.push([value, when]); }, exponentialRampToValueAtTime() {} };
    }
    createOscillator() {
      const source = { frequency: this.param(), connect() {}, disconnect() {}, start(when) { this.started = when; }, stop() { this.stopped = true; } };
      this.sources.push(source);
      return source;
    }
  }
  for (const [key, value] of Object.entries({
    cancelAnimationFrame() {},
    window: { AudioContext: AudioContextMock },
    document: { hidden: false },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  const music = createBirthdayMusic();
  music.effect("cake-rise", 0);
  assert.equal(contexts.length, 0, "no audio context before a gesture");
  assert.equal(await music.unlock(), true);
  const context = contexts[0];
  assert.equal(context.sources.length, 0, "unlock must not start the birthday song");
  const pitches = [];
  for (let tier = 0; tier < 5; tier++) {
    const first = context.sources.length;
    music.effect("cake-rise", tier);
    pitches.push(context.sources[first].frequency.values[0][0]);
  }
  assert.ok(pitches.every((pitch, i) => i === 0 || pitch > pitches[i - 1]));
  const beforeStar = context.sources.length;
  music.effect("cake-star");
  assert.ok(context.sources.length > beforeStar);
  assert.ok(context.sources[beforeStar].frequency.values[0][0] > pitches[4]);
  const beforePause = context.sources.length;
  document.hidden = true;
  music.effect("cake-star");
  assert.equal(context.sources.length, beforePause);
  music.pause();
  assert.ok(context.sources.every((source) => source.stopped));
  document.hidden = false;
  music.effect("cake-star");
  assert.equal(context.sources.length, beforePause, "paused contexts stay silent");
  await music.unlock();
  music.effect("cake-rise", 4);
  assert.ok(context.sources.length > beforePause);
  music.dispose();
  assert.equal(context.state, "closed");
  assert.ok(context.sources.every((source) => source.stopped));
});
