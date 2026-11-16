import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, h, markRaw, nextTick, shallowRef } from "vue";
import { memories } from "../src/memories.js";
import { secretLetter } from "../src/secretLetter.js";

// Exercise the real Vue component handlers without needing a browser download.
// Layout and animation appearance still require browser verification.
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.matchMedia = () => ({ matches: false });
globalThis.innerHeight = 800;
const documentEvents = new EventTarget();
globalThis.document = {
  hidden: false, body: { offsetHeight: 0 },
  addEventListener: (...args) => documentEvents.addEventListener(...args),
  removeEventListener: (...args) => documentEvents.removeEventListener(...args),
  dispatchEvent: event => documentEvents.dispatchEvent(event),
};
globalThis.Document = class {};
globalThis.ShadowRoot = class {};
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  getComputedStyle: () => ({ transitionDelay: "0s", transitionDuration: "0s", animationDelay: "0s", animationDuration: "0s" }),
};
const cache = new Map();
async function component(name, overrides = {}) {
  const filename = new URL(name === 'App' ? '../src/App.vue' : `../src/components/${name}.vue`, import.meta.url);
  const cacheKey = `${filename.href}:${JSON.stringify(overrides)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const { descriptor } = parse(await readFile(filename, "utf8"));
  let { content } = compileScript(descriptor, {
    id: name,
    inlineTemplate: true,
    templateOptions: { compilerOptions: { hoistStatic: false } },
  });
  const imports = [...content.matchAll(/(?:from\s+|import\()["']([^"']+)["']/g)];
  for (const match of imports) {
    const specifier = match[1];
    let resolved;
    if (overrides[specifier]) resolved = overrides[specifier];
    else if (!specifier.startsWith('.')) resolved = import.meta.resolve(specifier);
    else if (specifier.endsWith(".vue")) resolved = (await component(specifier.split("/").at(-1).slice(0, -4))).url;
    else resolved = new URL(specifier.endsWith(".js") ? specifier : `${specifier}.js`, filename).href;
    content = content.replace(match[0], match[0].replace(specifier, resolved));
  }
  const url = `data:text/javascript;base64,${Buffer.from(content).toString("base64")}`;
  const result = { url, module: await import(url) };
  cache.set(cacheKey, result);
  return result;
}
function all(node, predicate) {
  return [node, ...(node.children || []).flatMap(child => all(child, predicate))].filter(predicate);
}
function text(node) { return node.tag === 'comment' ? '' : [node.text || "", ...(node.children || []).map(text)].join(""); }
function hasClass(node, name) { return (node.props?.class || "").split(" ").includes(name); }
function element(tag, textValue = "") {
  const node = { tag, tagName: tag.toUpperCase(), text: textValue, props: {}, children: [], parent: null, scrollLeft: 0, offsetWidth: 240, clientHeight: 730,
    style: { setProperty() {} }, classList: { add() {}, remove() {} },
    ownerDocument: document, getRootNode: () => ({}),
    addEventListener() {}, removeEventListener() {},
    focus() { document.activeElement = node; },
    blur() { if (document.activeElement === node) document.activeElement = null; },
    setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 260, height: 220 }),
    scrollTo({ left }) { this.scrollLeft = left; },
    querySelector(selector) { return all(this, item => selector === 'button' ? item.tag === 'button' : hasClass(item, selector.slice(1)))[0]; },
  };
  if (tag === 'audio') Object.assign(node, {
    currentTime: 0, duration: 15, paused: true,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    load() { this.currentTime = 0; },
  });
  return markRaw(node);
}
const renderer = createRenderer({
  createElement: element, createText: value => element("text", value), createComment: value => element("comment", value),
  setText: (node, value) => { node.text = value; }, setElementText: (node, value) => { node.text = value; node.children = []; },
  patchProp: (node, name, old, value) => { node.props[name] = value; },
  parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1],
  insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node); node.parent = parent;
  },
  remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; },
});
async function mount(name, props = {}, overrides = {}, { loadPhotos = true } = {}) {
  const root = element("root");
  const Component = (await component(name, overrides)).module.default;
  const currentProps = shallowRef(props);
  const app = renderer.createApp({ render: () => h(Component, currentProps.value) });
  app.mount(root); await nextTick();
  if (loadPhotos) {
    for (const image of all(root, node => node.tag === 'img')) {
      await image.props.onLoad?.({ currentTarget: image });
    }
    await nextTick();
  }
  return {
    root, app, one: cls => all(root, node => hasClass(node, cls))[0],
    async setProps(values) { currentProps.value = { ...currentProps.value, ...values }; await nextTick(); },
  };
}
async function advance(time) {
  const pending = [...frames.values()]; frames.clear();
  for (const callback of pending) callback(time);
  await nextTick();
}

test("opening the envelope keeps photos unmounted until the star flight completes", async t => {
  const oldLocation = globalThis.location;
  const oldInfo = console.info;
  globalThis.location = { search: '' };
  console.info = () => {}; // The fake host uses the app's CSS star fallback.
  t.after(() => {
    globalThis.location = oldLocation;
    console.info = oldInfo;
    delete globalThis.finishIntroEnvelope;
    delete globalThis.finishIntroFlight;
    frames.clear();
  });
  const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const view = await mount('App', {}, {
    gsap: moduleUrl(`export const gsap = { timeline(options) { globalThis.finishIntroEnvelope = options.onComplete; return { to() { return this; } }; } };`),
    './warp': moduleUrl(`export function createWarpField(canvas, complete) { globalThis.finishIntroFlight = complete; return { start() {}, pause() {}, resume() {}, destroy() {} }; }`),
    three: moduleUrl('export {};'),
  });
  t.after(() => view.app.unmount());
  assert.ok(view.one('cover-page'));
  assert.equal(all(view.root, node => node.tag === 'img').length, 0);
  view.one('envelope-wrap').props.onClick();
  await globalThis.finishIntroEnvelope();
  await nextTick();
  assert.ok(view.one('warp-overlay'));
  assert.equal(view.one('memory-page'), undefined);
  assert.equal(all(view.root, node => node.tag === 'img').length, 0, 'photos must not exist behind the opening flight');
  await advance(0); await advance(16);
  assert.equal(view.one('memory-page'), undefined);
  globalThis.finishIntroFlight(); await nextTick();
  assert.ok(view.one('memory-page'));
  assert.deepEqual(all(view.root, node => node.tag === 'img').map(node => node.props.src), memories.map(photo => photo.src));
  assert.ok(view.one('warp-overlay'), 'the opaque flight layer remains mounted during its exit fade');
  await advance(32); await advance(48);
  assert.equal(view.one('warp-overlay'), undefined);
});

test("the three stars reveal only the selected message and gate the complete blessing", async () => {
  let unlocked = 0;
  const view = await mount("StarCollection", { onComplete: () => unlocked++ });
  assert.equal(view.one("unlock-blessing"), undefined);
  assert.equal(all(view.root, node => hasClass(node, "collect-star")).length, 3);
  const messages = ["小陈少爷", "不要再为琐事烦恼", "我们一定要成为很好很好的朋友"];
  for (let i = 0; i < 3; i++) {
    const stars = all(view.root, node => hasClass(node, "collect-star"));
    stars[i].props.onClick({ currentTarget: stars[i] }); await nextTick();
    assert.equal(text(all(view.root, node => node.props?.id === 'whisper-message')[0]), messages[i]);
    assert.equal(view.one("unlock-blessing"), undefined);
    view.one("star-whisper").querySelector('button').props.onClick(); await nextTick();
    await advance(0); await advance(16);
  }
  assert.equal(unlocked, 0);
  assert.ok(view.one("unlock-blessing"));
  view.one("unlock-blessing").props.onClick();
  assert.equal(unlocked, 1);
  view.app.unmount(); frames.clear();
});

test("the film pauses, can be dragged, and closes with light without duplicating photos", async () => {
  let complete = 0;
  const departures = [];
  const view = await mount("MemoryFilm", { onComplete: () => complete++, onDeparting: value => departures.push(value) });
  const rail = view.one("film-rail");
  // Drag directly to the last photo, then give it time to be read.
  rail.props.onPointerdown({ isPrimary: true, button: 0, pointerId: 1, clientX: 600 });
  rail.props.onPointermove({ pointerId: 1, clientX: 600 - (memories.length - 1) * 276 });
  rail.props.onPointerup({ pointerId: 1 }); await nextTick();
  await advance(0); await advance(16);
  const currentFrame = all(view.root, node => hasClass(node, 'film-frame') && hasClass(node, 'current'))[0];
  assert.equal(all(currentFrame, node => node.tag === 'img')[0].props.src, memories.at(-1).src);
  assert.equal(complete, 0);
  const controls = view.one("film-controls");
  const pause = all(controls, node => node.tag === 'button')[1];
  pause.props.onClick(); await nextTick();
  for (let time = 2000; time <= 8000; time += 50) await advance(time);
  assert.equal(complete, 0);
  pause.props.onClick(); await nextTick();
  for (let time = 8050; time <= 11500; time += 50) await advance(time);
  assert.equal(complete, 0, 'the last photo must fade before navigating');
  assert.ok(view.one('memory-exit'));
  assert.deepEqual(departures, [true], 'background animation can pause for the exit');
  assert.equal(all(view.one('memory-exit'), node => node.tag === 'img' || node.tag === 'canvas').length, 0);
  assert.deepEqual(all(view.root, node => node.tag === 'img').map(node => node.props.src), memories.map(photo => photo.src));
  all(controls, node => node.tag === 'button')[0].props.onClick(); await nextTick();
  const stillCurrent = all(view.root, node => hasClass(node, 'film-frame') && hasClass(node, 'current'))[0];
  assert.equal(all(stillCurrent, node => node.tag === 'img')[0].props.src, memories.at(-1).src, 'navigation is locked during the exit');
  for (let time = 11550; time <= 15500; time += 50) await advance(time);
  assert.equal(complete, 1);
  assert.equal(frames.size, 0, 'the exit clock stops after completing');
  view.app.unmount();
  assert.equal(frames.size, 0);
  assert.deepEqual(departures, [true, false], 'background animation resumes after leaving the film');
});

test("the film automatically visits every photo before the next step", async () => {
  let complete = 0;
  const view = await mount("MemoryFilm", { onComplete: () => complete++ });
  for (let time = 0; time <= 8000; time += 50) await advance(time);
  assert.equal(complete, 0);
  for (let time = 8050; time <= memories.length * 7000; time += 50) await advance(time);
  assert.equal(complete, 1);
  assert.ok(text(view.one("memory-note")).includes(memories.at(-1).caption));
  view.app.unmount(); frames.clear();
});

test("a cold slideshow waits for decoded photos before starting and moving to the next one", async t => {
  const view = await mount('MemoryFilm', {}, {}, { loadPhotos: false });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const photos = all(view.root, node => node.tag === 'img');
  assert.ok(photos.every(photo => photo.props.loading === 'eager'));
  for (let time = 0; time <= 10000; time += 50) await advance(time);
  assert.equal(view.one('film-rail').scrollLeft, 0, 'empty frames must not autoplay');
  assert.match(text(view.one('film-hint')), /正在准备这张回忆/);
  let finishDecode;
  photos[0].decode = () => new Promise(resolve => { finishDecode = resolve; });
  const loading = photos[0].props.onLoad({ currentTarget: photos[0] });
  await advance(10050);
  assert.equal(hasClass(photos[0], 'ready'), false, 'a received file still needs decoding');
  finishDecode(); await loading; await nextTick();
  assert.equal(hasClass(photos[0], 'ready'), true);
  for (let time = 10100; time <= 15100; time += 50) await advance(time);
  assert.equal(view.one('film-rail').scrollLeft, 0, 'the current photo stays visible while the next is loading');
  assert.match(text(view.one('film-hint')), /正在准备下一张/);
  await photos[1].props.onLoad({ currentTarget: photos[1] });
  for (let time = 15150; time <= 18650; time += 50) await advance(time);
  assert.ok(view.one('film-rail').scrollLeft >= 275);
  const current = all(view.root, node => hasClass(node, 'film-frame') && hasClass(node, 'current'))[0];
  assert.equal(all(current, node => node.tag === 'img')[0].props.src, memories[1].src);
});

test("a failed photo shows a retry and only starts its reading time after loading", async t => {
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ }, {}, { loadPhotos: false });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const image = all(view.root, node => node.tag === 'img')[0];
  image.props.onError(); await nextTick();
  const status = view.one('film-photo-status');
  assert.match(text(status), /暂时没能抵达/);
  for (let time = 0; time <= 10000; time += 50) await advance(time);
  assert.equal(complete, 0);
  assert.equal(view.one('film-rail').scrollLeft, 0);
  all(status, node => node.tag === 'button')[0].props.onClick({ stopPropagation() {} });
  await nextTick();
  assert.match(image.props.src, /\?retry=1$/);
  assert.match(text(view.one('film-photo-status')), /正在准备/);
  await image.props.onLoad({ currentTarget: image }); await nextTick();
  assert.ok(hasClass(image, 'ready'));
});

async function reachFilmExit(view) {
  const rail = view.one('film-rail');
  rail.props.onPointerdown({ isPrimary: true, button: 0, pointerId: 1, clientX: 600 });
  rail.props.onPointermove({ pointerId: 1, clientX: 600 - (memories.length - 1) * 276 });
  rail.props.onPointerup({ pointerId: 1 }); await nextTick();
  let time = performance.now() + 1300;
  const deadline = time + 5000;
  while (!view.one('memory-exit') && time <= deadline) {
    await advance(time);
    time += 50;
  }
  assert.ok(view.one('memory-exit'));
  await advance(time);
  return time;
}

test("the light transition lasts two seconds even when frames arrive slowly", async t => {
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const start = await reachFilmExit(view);
  for (let time = start + 200; time <= start + 1800; time += 200) await advance(time);
  assert.equal(complete, 0, 'the two-second transition must finish before navigating');
  await advance(start + 2000);
  assert.equal(complete, 1, 'low frame rate must not stretch the transition');
  assert.equal(frames.size, 0);
});

test("opening the album pauses the light transition until it closes", async t => {
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const start = await reachFilmExit(view);
  await advance(start + 500);
  await view.setProps({ paused: true });
  assert.ok(hasClass(view.one('memory-content'), 'paused'));
  await advance(start + 10000);
  assert.equal(complete, 0);
  await view.setProps({ paused: false });
  await advance(start + 10100);
  await advance(start + 11500);
  assert.equal(complete, 0);
  await advance(start + 11600);
  assert.equal(complete, 1);
});

test("a hidden page pauses the light transition instead of skipping to the gift", async t => {
  t.after(() => { document.hidden = false; });
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const start = await reachFilmExit(view);
  await advance(start + 500);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  await advance(start + 10000);
  assert.equal(complete, 0);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  await advance(start + 10100);
  assert.equal(complete, 0, 'resuming must not count time spent in the background');
  await advance(start + 11600);
  assert.equal(complete, 1);
});

test("reduced motion continues with a short fade and no spinning photos", async t => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  t.after(() => { globalThis.matchMedia = previous; });
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ });
  const controls = view.one('film-controls');
  const next = all(controls, node => node.tag === 'button').at(-1);
  for (let i = 1; i < memories.length; i++) { next.props.onClick(); await nextTick(); }
  view.one('pill-button').props.onClick(); await nextTick();
  assert.equal(complete, 0);
  assert.equal(view.one('memory-exit'), undefined);
  for (let time = 0; time <= 400; time += 50) await advance(time);
  assert.equal(complete, 1);
  view.app.unmount(); frames.clear();
});

test("the gift opens in three layers, then types the clear letter one character at a time", async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sounds = [];
  let ready = 0;
  const view = await mount("GiftLetter", { name: '陈照敬', date: '1月10日', onReady: () => ready++, onSound: kind => sounds.push(kind) });
  assert.equal(view.one("letter-paper"), undefined);
  for (let i = 0; i < 3; i++) {
    const button = view.one("gift-box");
    button.props.onClick({ detail: 0 }); button.props.onClick({ detail: 0 });
    assert.equal(sounds.length, i + 1, 'rapid double taps must not skip a layer');
    t.mock.timers.tick(650); await nextTick();
    await advance(0); await advance(16); await nextTick();
    if (i < 2) {
      assert.equal(view.one("letter-paper"), undefined);
      assert.equal(ready, 0);
    }
  }
  assert.deepEqual(sounds, ['lid', 'ribbon', 'paper']);
  assert.equal(ready, 1);
  assert.ok(view.one("letter-paper"));
  assert.equal(all(view.root, node => node.tag === 'path').length, 0);
  assert.equal(text(view.one("typewriter")).replace('▍', ''), '');
  for (let time = 60; time <= 480; time += 42) await advance(time);
  const partial = text(view.one("typewriter")).replace('▍', '');
  assert.ok(partial.startsWith('亲爱的陈照敬：'));
  assert.ok(!partial.includes('今晚，所有的星星'));
  for (let time = 522; time <= 10000; time += 42) await advance(time);
  assert.match(text(view.one("typewriter")), /今晚，所有的星星都为你闪耀。$/);
  assert.equal(view.one("cursor"), undefined);
  view.app.unmount(); frames.clear();
});

test("gift gestures require an upward pull, a downward pull, and then a tap", async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sounds = [];
  let ready = 0;
  const view = await mount('GiftLetter', { name: '陈照敬', date: '1月10日', onReady: () => ready++, onSound: kind => sounds.push(kind) });
  const pointer = (button, handler, y, pointerType = 'touch') => button.props[handler]({
    isPrimary: true, button: 0, pointerId: 1, pointerType,
    clientX: 130, clientY: y, currentTarget: button,
    preventDefault() {}, stopPropagation() {},
  });
  const finishLayer = async () => {
    t.mock.timers.tick(650); await nextTick();
    await advance(0); await advance(16); await nextTick();
  };
  let button = view.one('gift-box');
  button.props.onClick({ detail: 1 }); await nextTick();
  assert.equal(sounds.length, 0, 'a tap must not skip the first swipe');
  pointer(button, 'onPointerdown', 100);
  pointer(button, 'onPointermove', 200);
  pointer(button, 'onPointerup', 200); await nextTick();
  assert.equal(sounds.length, 0, 'pulling down must not open the first layer');
  pointer(button, 'onPointerdown', 150);
  pointer(button, 'onPointerup', 120); await nextTick();
  assert.equal(sounds.length, 0, 'short pulls must spring back');
  pointer(button, 'onPointerdown', 180);
  pointer(button, 'onPointermove', 70);
  pointer(button, 'onPointercancel', 70); await nextTick();
  assert.equal(sounds.length, 0, 'canceled gestures must never open a layer');
  pointer(button, 'onPointerdown', 180);
  pointer(button, 'onPointermove', 80); await nextTick();
  assert.ok(all(view.one('gift-magic-trail'), node => node.tag === 'i').length > 0);
  pointer(button, 'onPointerup', 80);
  assert.deepEqual(sounds, ['lid']);
  await finishLayer();
  button = view.one('gift-box');
  pointer(button, 'onPointerdown', 170, 'mouse');
  pointer(button, 'onPointerup', 70, 'mouse'); await nextTick();
  assert.deepEqual(sounds, ['lid'], 'the second layer requires a downward gesture');
  pointer(button, 'onPointerdown', 70, 'mouse');
  pointer(button, 'onPointerup', 170, 'mouse');
  pointer(button, 'onPointerup', 170, 'mouse');
  assert.deepEqual(sounds, ['lid', 'ribbon']);
  await finishLayer();
  assert.equal(ready, 0);
  button = view.one('gift-box');
  pointer(button, 'onPointerdown', 150);
  pointer(button, 'onPointerup', 50); await nextTick();
  assert.equal(sounds.length, 2, 'a swipe alone must not open the third layer');
  button.props.onClick({ detail: 1, clientX: 130, clientY: 100, currentTarget: button });
  await finishLayer();
  assert.deepEqual(sounds, ['lid', 'ribbon', 'paper']);
  assert.equal(ready, 1);
  assert.ok(view.one('letter-paper'));
  view.app.unmount(); frames.clear();
});

test('the letter recording only starts on tap and releases the music on stop and completion', async t => {
  const events = [];
  const view = await mount('LetterAudio', { onActive: value => events.push(value) });
  t.after(() => view.app.unmount());
  const media = all(view.root, node => node.tag === 'audio')[0];
  assert.equal(media.props.src, '/蜡笔小新.m4a');
  assert.equal(media.props.preload, 'none');
  assert.equal(media.paused, true);
  assert.deepEqual(events, []);
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  await nextTick();
  assert.deepEqual(events, [true]);
  assert.equal(media.paused, false);
  assert.equal(view.one('letter-audio-button').props['aria-pressed'], true);
  media.currentTime = 6;
  media.props.onTimeupdate(); await nextTick();
  assert.match(text(view.one('letter-audio-time')), /0:06/);
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 0);
  assert.deepEqual(events, [true, false]);
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  media.props.onEnded(); await nextTick();
  assert.deepEqual(events, [true, false, true, false]);
  assert.equal(view.one('letter-audio-button').props['aria-pressed'], false);
});

test('a cancelled recording cannot restart after a delayed play promise resolves', async t => {
  const events = [];
  const view = await mount('LetterAudio', { onActive: value => events.push(value) });
  t.after(() => view.app.unmount());
  const media = all(view.root, node => node.tag === 'audio')[0];
  let finishPlay;
  media.play = () => new Promise(resolve => { media.paused = false; finishPlay = resolve; });
  const pending = view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  await nextTick();
  assert.deepEqual(events, [true], 'background music pauses before the recording finishes loading');
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  finishPlay(); await pending; await nextTick();
  assert.equal(media.paused, true);
  assert.equal(view.one('letter-audio-button').props['aria-pressed'], false);
  assert.deepEqual(events, [true, false]);
});

test('recording failures, hidden pages, and leaving the letter release the background music', async t => {
  const events = [];
  const view = await mount('LetterAudio', { onActive: value => events.push(value) });
  t.after(() => { document.hidden = false; });
  const media = all(view.root, node => node.tag === 'audio')[0];
  media.play = () => Promise.reject(new Error('request failed'));
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  await nextTick();
  assert.deepEqual(events, [true, false]);
  assert.ok(view.one('letter-audio-error'));
  let reloads = 0;
  media.load = () => reloads++;
  media.play = () => { media.paused = false; return Promise.resolve(); };
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  assert.equal(reloads, 1, 'retry reloads a failed media resource');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(media.paused, true);
  assert.deepEqual(events, [true, false, true, false]);
  document.hidden = false;
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  view.app.unmount();
  assert.equal(media.paused, true);
  assert.deepEqual(events, [true, false, true, false, true, false]);
});

test('the gift recording pauses app music, preserves mute choices, and restores music when leaving', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousLocation = globalThis.location;
  const previousInfo = console.info;
  globalThis.location = { search: '' };
  console.info = () => {};
  const events = [];
  globalThis.letterMusicEvents = events;
  const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const view = await mount('App', {}, {
    gsap: moduleUrl(`export const gsap = { timeline(options) { globalThis.finishLetterEnvelope = options.onComplete; return { to() { return this; } }; }, fromTo() {} };`),
    './warp': moduleUrl(`export function createWarpField(canvas, complete) { globalThis.finishLetterFlight = complete; return { start() {}, pause() {}, resume() {}, destroy() {} }; }`),
    './birthdayMusic': moduleUrl(`export function createBirthdayMusic() { return { start() { globalThis.letterMusicEvents.push('music:start'); return Promise.resolve(); }, pause() { globalThis.letterMusicEvents.push('music:pause'); }, effect() {}, reset() {}, dispose() {} }; }`),
    three: moduleUrl('export {};'),
  });
  t.after(() => {
    view.app.unmount(); frames.clear();
    globalThis.location = previousLocation;
    console.info = previousInfo;
    delete globalThis.letterMusicEvents;
    delete globalThis.finishLetterEnvelope;
    delete globalThis.finishLetterFlight;
  });
  view.one('envelope-wrap').props.onClick();
  await globalThis.finishLetterEnvelope(); await nextTick();
  globalThis.finishLetterFlight(); await nextTick();
  await advance(0); await advance(16);
  for (const image of all(view.root, node => node.tag === 'img')) await image.props.onLoad?.({ currentTarget: image });
  const exitStart = await reachFilmExit(view);
  await advance(exitStart + 2000);
  assert.ok(view.one('letter-page'));
  for (let i = 0; i < 3; i++) {
    view.one('gift-box').props.onClick({ detail: 0 });
    t.mock.timers.tick(650); await nextTick();
    await advance(0); await advance(16);
  }
  assert.ok(view.one('letter-paper'));
  const media = all(view.root, node => node.tag === 'audio')[0];
  media.play = () => { events.push('voice:play'); media.paused = false; return Promise.resolve(); };
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  assert.deepEqual(events.slice(-2), ['music:pause', 'voice:play']);
  const starts = () => events.filter(event => event === 'music:start').length;
  const before = starts();
  view.one('sound-button').props.onClick(); // Off, then on during the recording.
  view.one('sound-button').props.onClick();
  assert.equal(starts(), before, 'turning music on cannot overlap the recording');
  media.props.onEnded(); await nextTick();
  assert.equal(starts(), before + 1);
  view.one('sound-button').props.onClick(); // Keep the user-selected mute.
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  media.props.onEnded(); await nextTick();
  assert.equal(starts(), before + 1, 'recording completion must preserve mute');
  view.one('sound-button').props.onClick();
  await view.one('letter-audio-button').props.onClick({ stopPropagation() {} });
  const beforeLeaving = starts();
  view.one('letter-next').props.onClick(); await nextTick();
  assert.ok(view.one('puzzle-page'));
  assert.equal(media.paused, true);
  assert.equal(starts(), beforeLeaving + 1, 'leaving the letter stops the voice and restores the music');
});

const ticketModuleUrl = new URL('../src/birthdayTicket.js', import.meta.url).href;
const ticketMockModule = `data:text/javascript;base64,${Buffer.from(`
  export {createTicketSvg, normalizeTicketWish, ticketWishError, TICKET_WISH_LIMIT} from ${JSON.stringify(ticketModuleUrl)};
  export function loadTicketPhoto(...args) { return globalThis.ticketHarness.load(...args); }
  export function renderTicketPng(...args) { return globalThis.ticketHarness.render(...args); }
`).toString('base64')}`;

test('the keepsake page requires a wish, exports PNG, and invalidates old images after editing', async t => {
  const renders = [];
  const wishes = [];
  let backs = 0;
  globalThis.ticketHarness = {
    load: async src => { assert.equal(src, '/time1.webp'); return 'data:image/jpeg;base64,cGhvdG8='; },
    render: async svg => { renders.push(svg); return new Blob(['png'], { type: 'image/png' }); },
  };
  const view = await mount('BirthdayTicket', { name: '陈照敬', date: '1月10日', photo: '/time1.webp', onWish: value => wishes.push(value), onBack: () => backs++ }, { '../birthdayTicket': ticketMockModule });
  t.after(() => { view.app.unmount(); delete globalThis.ticketHarness; });
  const input = all(view.root, node => node.tag === 'textarea')[0];
  await view.one('ticket-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.match(text(view.one('ticket-error')), /先写/);
  assert.equal(document.activeElement, input);
  assert.equal(renders.length, 0);
  input.props['onUpdate:modelValue']('平安快乐，也要勇敢 <&>'); await nextTick();
  const preview = await (await fetch(view.one('birthday-ticket-image').props.src)).text();
  assert.ok(preview.includes('&lt;&amp;&gt;'));
  await view.one('ticket-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(renders.length, 1);
  assert.ok(renders[0].includes('陈照敬'));
  const download = view.one('ticket-download');
  assert.equal(download.props.download, '陈照敬-生日纪念票.png');
  assert.equal((await (await fetch(download.props.href)).blob()).type, 'image/png');
  assert.match(text(view.one('ticket-status')), /纪念票已生成/);
  input.props['onUpdate:modelValue']('希望每天都有小惊喜'); await nextTick();
  assert.equal(view.one('ticket-download'), undefined, 'an old PNG must not be saved with a new wish');
  assert.match(text(view.one('ticket-status')), /重新生成/);
  assert.equal(wishes.at(-1), '希望每天都有小惊喜');
  view.one('ticket-back').props.onClick();
  assert.equal(backs, 1);
  assert.match(text(view.one('ticket-back')), /返回生日页面/);
});

test('the ticket page prefills a submitted wish, retries failed photos, and recovers from export errors', async t => {
  let loads = 0, renders = 0;
  globalThis.ticketHarness = {
    load: async () => { if (++loads === 1) throw new Error('offline'); return 'data:image/jpeg;base64,cGhvdG8='; },
    render: async () => { if (++renders === 1) throw new Error('export failed'); return new Blob(['png'], { type: 'image/png' }); },
  };
  const view = await mount('BirthdayTicket', { name: '陈照敬', date: '1月10日', photo: '/time1.webp', initialWish: '新的一岁平安自由' }, { '../birthdayTicket': ticketMockModule });
  t.after(() => { view.app.unmount(); delete globalThis.ticketHarness; });
  const input = all(view.root, node => node.tag === 'textarea')[0];
  assert.equal(input.value, '新的一岁平安自由');
  assert.ok(view.one('ticket-photo-retry'));
  await view.one('ticket-photo-retry').props.onClick(); await nextTick();
  assert.equal(loads, 2);
  assert.equal(view.one('ticket-photo-retry'), undefined);
  await view.one('ticket-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.match(text(view.one('ticket-error')), /没能生成/);
  assert.equal(view.one('ticket-download'), undefined);
  await view.one('ticket-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.ok(view.one('ticket-download'));
});

test('leaving the ticket page during generation releases its preview and ignores the late export', async t => {
  let complete;
  let renders = 0;
  globalThis.ticketHarness = {
    load: async () => 'data:image/jpeg;base64,cGhvdG8=',
    render: () => { renders++; return new Promise(resolve => { complete = resolve; }); },
  };
  const view = await mount('BirthdayTicket', { name: '陈照敬', date: '1月10日', photo: '/time1.webp', initialWish: '平安快乐' }, { '../birthdayTicket': ticketMockModule });
  t.after(() => { delete globalThis.ticketHarness; });
  const previewUrl = view.one('birthday-ticket-image').props.src;
  const pending = view.one('ticket-form').props.onSubmit({ preventDefault() {} });
  await nextTick();
  await view.one('ticket-form').props.onSubmit({ preventDefault() {} });
  assert.equal(renders, 1, 'repeated taps must not create multiple exports');
  view.app.unmount();
  complete(new Blob(['png'], { type: 'image/png' })); await pending;
  await assert.rejects(fetch(previewUrl), 'the abandoned preview URL must be released');
});

test("a wish rises, becomes light, and is lost when the page component remounts", async () => {
  const view = await mount("WishSky");
  const input = all(view.root, node => node.tag === 'input')[0];
  input.props['onUpdate:modelValue']('愿我们都平安快乐'); await nextTick();
  view.one("wish-form").props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(text(view.one("wish-bubble")), '愿我们都平安快乐');
  assert.equal(input.value, '');
  view.one("wish-bubble").props.onAnimationend({ animationName: 'wishRise' }); await nextTick();
  assert.equal(view.one("wish-bubble"), undefined);
  assert.equal(all(view.root, node => node.tag === 'i').length, 14);
  view.app.unmount();
  const fresh = await mount("WishSky");
  assert.equal(fresh.one("wish-bubble"), undefined);
  assert.equal(fresh.one("wish-burst"), undefined);
  fresh.app.unmount(); frames.clear();
});

test("only the submitted secret name summons the bird, without creating a wish bubble", async () => {
  const triggers = [];
  const wishes = [];
  const view = await mount('WishSky', { onSecret: input => triggers.push(input), onWish: value => wishes.push(value) });
  const input = all(view.root, node => node.tag === 'input')[0];
  input.props['onUpdate:modelValue']('  杨炼  '); await nextTick();
  assert.equal(triggers.length, 0, 'typing alone must not interrupt Chinese input');
  view.one('wish-form').props.onSubmit({ preventDefault() {}, isComposing: true }); await nextTick();
  assert.equal(triggers.length, 0);
  view.one('wish-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0], input);
  assert.equal(view.one('wish-bubble'), undefined);
  assert.deepEqual(wishes, [], 'the secret keyword must not become the ticket wish');
  assert.equal(input.value, '');
  input.props['onUpdate:modelValue']('杨炼生日快乐'); await nextTick();
  view.one('wish-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(triggers.length, 1, 'longer wishes containing the name remain ordinary wishes');
  assert.equal(text(view.one('wish-bubble')), '杨炼生日快乐');
  assert.deepEqual(wishes, ['杨炼生日快乐']);
  view.app.unmount(); frames.clear();
});

test("the bird must arrive before its envelope opens, and the configured letter can be closed", async () => {
  let closed = 0;
  const view = await mount('BirdLetter', { onClose: () => closed++ });
  const bird = view.one('bird-messenger');
  assert.equal(bird.props.disabled, true);
  bird.props.onClick(); await nextTick();
  assert.equal(view.one('bird-secret-paper'), undefined);
  bird.props.onAnimationend({ animationName: 'birdArrival', target: {}, currentTarget: bird }); await nextTick();
  assert.equal(bird.props.disabled, true, 'child animations must not end the flight');
  bird.props.onAnimationend({ animationName: 'birdArrival', target: bird, currentTarget: bird }); await nextTick();
  assert.equal(bird.props.disabled, false);
  assert.equal(document.activeElement, bird);
  bird.props.onClick(); await nextTick();
  await advance(0); await advance(16);
  assert.ok(view.one('bird-secret-paper'));
  const bodyClass = secretLetter.content ? 'bird-secret-body' : 'bird-secret-placeholder';
  assert.equal(text(view.one(bodyClass)), secretLetter.content || secretLetter.placeholder);
  view.one('bird-keep-letter').props.onClick();
  assert.equal(closed, 1);
  view.app.unmount(); frames.clear();
});

test("reduced motion makes the bird's envelope available immediately", async t => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  t.after(() => { globalThis.matchMedia = previous; });
  let closed = 0;
  const view = await mount('BirdLetter', { onClose: () => closed++ });
  assert.equal(view.one('bird-messenger').props.disabled, false);
  view.one('bird-letter-overlay').props.onKeydown({ key: 'Escape', preventDefault() {} });
  assert.equal(closed, 1);
  view.app.unmount(); frames.clear();
});
