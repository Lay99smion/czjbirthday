import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, markRaw, nextTick } from "vue";
import { memories } from "../src/memories.js";

// Exercise the real Vue component handlers without needing a browser download.
// Layout and animation appearance still require browser verification.
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.matchMedia = () => ({ matches: false });
globalThis.innerHeight = 800;
globalThis.document = { hidden: false, body: { offsetHeight: 0 }, addEventListener() {}, removeEventListener() {} };
globalThis.Document = class {};
globalThis.ShadowRoot = class {};
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  getComputedStyle: () => ({ transitionDelay: "0s", transitionDuration: "0s", animationDelay: "0s", animationDuration: "0s" }),
};
const cache = new Map();
async function component(name, overrides = {}) {
  const filename = new URL(name === 'App' ? '../src/App.vue' : `../src/components/${name}.vue`, import.meta.url);
  if (cache.has(filename.href)) return cache.get(filename.href);
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
  cache.set(filename.href, result);
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
async function mount(name, props = {}, overrides = {}) {
  const root = element("root");
  const app = renderer.createApp((await component(name, overrides)).module.default, props);
  app.mount(root); await nextTick();
  return { root, app, one: cls => all(root, node => hasClass(node, cls))[0] };
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

test("the film pauses, can be dragged, and plays the full photo vortex before continuing", async () => {
  let complete = 0;
  const view = await mount("MemoryFilm", { onComplete: () => complete++ });
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
  assert.equal(complete, 0, 'the last photo must lead into the vortex before navigating');
  assert.ok(view.one('memory-vortex'));
  const tiers = all(view.one('memory-vortex'), node => hasClass(node, 'vortex-tier'));
  assert.equal(tiers.length, 3, 'photos are separated into upper, middle, and lower orbits');
  assert.ok(tiers.every(tier => all(tier, node => node.tag === 'img').length > 0));
  assert.deepEqual(all(view.one('memory-vortex'), node => node.tag === 'img').map(node => node.props.src).sort(), memories.map(photo => photo.src).sort());
  all(controls, node => node.tag === 'button')[0].props.onClick(); await nextTick();
  const stillCurrent = all(view.root, node => hasClass(node, 'film-frame') && hasClass(node, 'current'))[0];
  assert.equal(all(stillCurrent, node => node.tag === 'img')[0].props.src, memories.at(-1).src, 'navigation is locked during the vortex');
  for (let time = 11550; time <= 15500; time += 50) await advance(time);
  assert.equal(complete, 1);
  assert.equal(frames.size, 0, 'the exit clock stops after completing');
  view.app.unmount();
  assert.equal(frames.size, 0);
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

test("a hidden page pauses the vortex instead of skipping to the gift", async t => {
  t.after(() => { document.hidden = false; });
  let complete = 0;
  const view = await mount('MemoryFilm', { onComplete: () => complete++ });
  t.after(() => { view.app.unmount(); frames.clear(); });
  const rail = view.one('film-rail');
  rail.props.onPointerdown({ isPrimary: true, button: 0, pointerId: 1, clientX: 600 });
  rail.props.onPointermove({ pointerId: 1, clientX: 600 - (memories.length - 1) * 276 });
  rail.props.onPointerup({ pointerId: 1 }); await nextTick();
  const start = performance.now() + 1300;
  for (let time = start; time <= start + 3600; time += 50) await advance(time);
  assert.ok(view.one('memory-vortex'));
  document.hidden = true;
  for (let time = start + 3650; time <= start + 7600; time += 50) await advance(time);
  assert.equal(complete, 0);
  document.hidden = false;
  for (let time = start + 7650; time <= start + 11600; time += 50) await advance(time);
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
  assert.equal(view.one('memory-vortex'), undefined);
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
  const view = await mount('WishSky', { onSecret: input => triggers.push(input) });
  const input = all(view.root, node => node.tag === 'input')[0];
  input.props['onUpdate:modelValue']('  杨炼  '); await nextTick();
  assert.equal(triggers.length, 0, 'typing alone must not interrupt Chinese input');
  view.one('wish-form').props.onSubmit({ preventDefault() {}, isComposing: true }); await nextTick();
  assert.equal(triggers.length, 0);
  view.one('wish-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0], input);
  assert.equal(view.one('wish-bubble'), undefined);
  assert.equal(input.value, '');
  input.props['onUpdate:modelValue']('杨炼生日快乐'); await nextTick();
  view.one('wish-form').props.onSubmit({ preventDefault() {} }); await nextTick();
  assert.equal(triggers.length, 1, 'longer wishes containing the name remain ordinary wishes');
  assert.equal(text(view.one('wish-bubble')), '杨炼生日快乐');
  view.app.unmount(); frames.clear();
});

test("the bird must arrive before its envelope opens, and the unfinished letter can be closed", async () => {
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
  assert.match(text(view.one('bird-secret-placeholder')), /稍后补上/);
  assert.equal(view.one('bird-secret-body'), undefined);
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
