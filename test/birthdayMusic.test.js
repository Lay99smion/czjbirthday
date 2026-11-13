import test from "node:test";
import assert from "node:assert/strict";
import { createBirthdayMusic } from "../src/birthdayMusic.js";

test("birthday music waits for a start action, pauses cleanly, and restarts from the beginning", async (t) => {
  const keys = ["window", "document", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map();
  const contexts = [];
  let frameId = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "suspended"; this.destination = {}; this.started = []; contexts.push(this); }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const source = { connect() {}, disconnect() {}, start: () => this.started.push(source), stop(when) { if (when === undefined) this.onended?.(); } };
      source.frequency = { setValueAtTime(value) { source.pitch = value; } };
      return source;
    }
    async resume() { this.state = "running"; }
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
  }
  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => {
    for (const key of keys) {
      if (previous.get(key)) Object.defineProperty(globalThis, key, previous.get(key));
      else delete globalThis[key];
    }
  });

  const music = createBirthdayMusic();
  assert.equal(contexts.length, 0);
  await music.start();
  assert.equal(contexts.length, 1);
  const context = contexts[0];
  const firstPitch = context.started[0].pitch;
  assert.ok(frames.size > 0);
  music.pause();
  assert.equal(frames.size, 0);
  assert.equal(context.state, "suspended");
  music.reset();
  const previousNotes = context.started.length;
  await music.start();
  assert.equal(context.started[previousNotes].pitch, firstPitch);
  music.dispose();
  assert.equal(context.state, "closed");
  assert.equal(frames.size, 0);
});
