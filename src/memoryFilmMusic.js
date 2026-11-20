import { assetUrl } from "./assets";

export function createMemoryFilmMusic() {
  const audio = new Audio(assetUrl("/birthday.mp3"));
  audio.loop = true;
  audio.preload = "none";
  let requestId = 0;

  // Unlock this media element on the envelope tap for mobile browser policies.
  function unlock() {
    const request = ++requestId;
    audio.muted = true;
    try {
      Promise.resolve(audio.play()).then(() => {
        if (request !== requestId) return;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }).catch(() => {
        if (request === requestId) audio.muted = false;
      });
    } catch {
      audio.muted = false;
    }
  }

  async function start() {
    const request = ++requestId;
    if (document.hidden) return false;
    audio.muted = false;
    await audio.play();
    if (request !== requestId) return false;
    if (document.hidden) {
      audio.pause();
      return false;
    }
    return !audio.paused;
  }

  function pause() {
    requestId++;
    audio.pause();
  }

  function reset() {
    pause();
    audio.currentTime = 0;
  }

  function dispose() {
    pause();
    audio.removeAttribute("src");
    audio.load();
  }

  return { unlock, start, pause, reset, dispose };
}
