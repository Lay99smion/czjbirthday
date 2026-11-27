import { assetUrl } from "./assets.js";

export function createCountdownMusic() {
  const audio = new Audio(assetUrl("/beautiful.mp3"));
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.45;
  let requestId = 0;
  let wanted = false;
  let disposed = false;

  async function start() {
    if (disposed || document.hidden) return false;
    const request = ++requestId;
    wanted = true;
    await audio.play();
    if (request !== requestId || disposed || document.hidden) {
      if (!wanted || disposed || document.hidden) audio.pause();
      return false;
    }
    return !audio.paused;
  }

  function pause() {
    requestId++;
    wanted = false;
    audio.pause();
  }

  function reset() {
    pause();
    audio.currentTime = 0;
  }

  function dispose() {
    disposed = true;
    reset();
    audio.removeAttribute("src");
    audio.load();
  }

  return { start, pause, reset, dispose };
}
