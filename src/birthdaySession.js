import { canAccessBirthday, resolveCountdownDeadline } from "./birthdayCountdown.js";

const DEMO_KEY = "birthday-starlight:demo-deadline";
const OPENING_KEY = "birthday-starlight:seen-opening";

function sessionStorageOrNull() {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

export function resolveBirthdaySessionDeadline(config, { now = Date.now(), storage = sessionStorageOrNull() } = {}) {
  const deadline = resolveCountdownDeadline(config, now);
  // The real birthday always comes from configuration, never a stored unlock.
  if (config.targetAt !== null && config.targetAt !== undefined) return deadline;
  try {
    const saved = JSON.parse(storage?.getItem(DEMO_KEY) ?? "null");
    if (saved?.seconds === config.demoSeconds && Number.isFinite(saved.deadline))
      return saved.deadline;
  } catch { /* Storage can be disabled; the countdown still works. */ }
  try { storage?.setItem(DEMO_KEY, JSON.stringify({ seconds: config.demoSeconds, deadline })); }
  catch { /* A disabled store must not prevent the first countdown. */ }
  return deadline;
}

export function rememberBirthdayOpening(deadline, storage = sessionStorageOrNull()) {
  try { storage?.setItem(OPENING_KEY, String(deadline)); }
  catch { /* Remembering the opening is optional. */ }
}

export function initialBirthdayStage({ deadline, returningHome = false, navigationType, now = Date.now() }, storage = sessionStorageOrNull()) {
  if (!canAccessBirthday(deadline, now)) return "countdown";
  if (returningHome) return "cover";
  try {
    if (navigationType === "back_forward" && storage?.getItem(OPENING_KEY) === String(deadline))
      return "cover";
  } catch { /* Fall through to the normal opening. */ }
  return "countdown";
}
