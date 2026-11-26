export const CAKE_FIREWORKS_START = 13.1;
export const CAKE_INTRO_DURATION = 19.8;

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// The background fireworks begin only after the top star is fully illuminated.
export function cakeIntroFrame(seconds, aspect = 1, reducedMotion = false) {
  const pullback = reducedMotion ? 1 : smooth((seconds - 0.35) / 11.8);
  const lights = reducedMotion ? 1 : smooth((seconds - 1.2) / 10.8);
  const star = reducedMotion ? 1 : smooth((seconds - 11.2) / 1.7);
  const finalDistance = Math.max(14.8, 6.3 / (2 * Math.tan(Math.PI * 21 / 180) * Math.max(aspect, 0.25) * 0.88));
  return {
    pullback,
    lights,
    star,
    fireworksTime: reducedMotion ? 1.4 : seconds < CAKE_FIREWORKS_START ? -1 : seconds - CAKE_FIREWORKS_START,
    cameraX: -0.55 + pullback * 0.9,
    cameraY: 0.9 + pullback * 6.0,
    cameraZ: 4.25 + pullback * (finalDistance - 4.25),
    targetY: 0.95 + pullback * 2.05,
    reveal: reducedMotion || seconds >= 11.6,
    complete: seconds >= (reducedMotion ? 3.2 : CAKE_INTRO_DURATION),
  };
}

export function cakeRibbonPoint(progress) {
  const t = clamp(progress);
  const radius = 3.0 * (1 - t) ** 0.64 + 0.14;
  const angle = Math.PI * 0.72 + t * Math.PI * 6.5;
  return {
    x: Math.cos(angle) * radius,
    y: 0.62 + t * 5.52,
    z: Math.sin(angle) * radius,
  };
}
