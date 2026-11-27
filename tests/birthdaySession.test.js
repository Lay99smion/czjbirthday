import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessBirthday } from "../src/birthdayCountdown.js";
import { initialBirthdayStage, rememberBirthdayOpening, resolveBirthdaySessionDeadline } from "../src/birthdaySession.js";

const demo = { targetAt: null, demoSeconds: 15 };
function storage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("home, radio, secret and home-return loads share the original demo deadline", () => {
  const session = storage();
  const home = resolveBirthdaySessionDeadline(demo, { now: 1000, storage: session });
  assert.equal(home, 16000);
  const radio = resolveBirthdaySessionDeadline(demo, { now: 30000, storage: session });
  assert.equal(radio, home);
  assert.equal(canAccessBirthday(radio, 30000), true);
  const backHome = resolveBirthdaySessionDeadline(demo, { now: 40000, storage: session });
  assert.equal(initialBirthdayStage({ deadline: backHome, returningHome: true, now: 40000 }, session), "cover");
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 50000, storage: session }), home);
});

test("browser Back restores the cover after a completed opening, while reload can replay it", () => {
  const session = storage();
  rememberBirthdayOpening(16000, session);
  assert.equal(initialBirthdayStage({ deadline: 16000, now: 30000, navigationType: "back_forward" }, session), "cover");
  assert.equal(initialBirthdayStage({ deadline: 16000, now: 30000, navigationType: "reload" }, session), "countdown");
});

test("fixed birthday gating cannot be bypassed by a completed demo or return URL", () => {
  const session = storage();
  resolveBirthdaySessionDeadline(demo, { now: 0, storage: session });
  rememberBirthdayOpening(15000, session);
  const fixed = { ...demo, targetAt: "2027-01-10T00:00:00+08:00" };
  const deadline = resolveBirthdaySessionDeadline(fixed, { now: 30000, storage: session });
  assert.equal(deadline, Date.parse(fixed.targetAt));
  assert.equal(initialBirthdayStage({ deadline, now: 30000, returningHome: true, navigationType: "back_forward" }, session), "countdown");
});

test("a fresh session starts its own demo and a changed demo duration invalidates the old timer", () => {
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 1000, storage: storage() }), 16000);
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 90000, storage: storage() }), 105000);
  const session = storage();
  resolveBirthdaySessionDeadline(demo, { now: 1000, storage: session });
  assert.equal(resolveBirthdaySessionDeadline({ ...demo, demoSeconds: 30 }, { now: 2000, storage: session }), 32000);
});

test("unavailable or corrupt browser storage does not break the page", () => {
  const broken = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } };
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 1000, storage: broken }), 16000);
  assert.doesNotThrow(() => rememberBirthdayOpening(16000, broken));
  assert.equal(initialBirthdayStage({ deadline: 16000, now: 30000, navigationType: "back_forward" }, broken), "countdown");
  let saved = "broken JSON";
  const corrupt = { getItem() { return saved; }, setItem(key, value) { saved = value; } };
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 1000, storage: corrupt }), 16000);
  assert.equal(resolveBirthdaySessionDeadline(demo, { now: 20000, storage: corrupt }), 16000);
});
