// Happy Birthday in C major, with the pickup notes and phrase lengths intact.
const SCORE = [
  [67, .5], [67, .5], [69, 1], [67, 1], [72, 1], [71, 2],
  [67, .5], [67, .5], [69, 1], [67, 1], [74, 1], [72, 2],
  [67, .5], [67, .5], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
  [77, .5], [77, .5], [76, 1], [72, 1], [74, 1], [72, 3],
];
const BEAT_SECONDS = 60 / 108;

export function createBirthdayMusic() {
  let context = null;
  let master = null;
  let frame = 0;
  let running = false;
  let playRequest = 0;
  let noteIndex = 0;
  let nextNoteAt = 0;
  const sources = new Set();

  function playNote(midi, when, duration) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.exponentialRampToValueAtTime(.12, when + .014);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration + .32);
    envelope.connect(master);

    const overtone = context.createGain();
    overtone.gain.value = .18;
    overtone.connect(envelope);
    let ended = 0;
    for (const harmonic of [1, 2]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * harmonic, when);
      oscillator.connect(harmonic === 1 ? envelope : overtone);
      sources.add(oscillator);
      oscillator.onended = () => {
        sources.delete(oscillator);
        oscillator.disconnect();
        if (++ended === 2) { envelope.disconnect(); overtone.disconnect(); }
      };
      oscillator.start(when);
      oscillator.stop(when + duration + .36);
    }
  }

  function tick() {
    if (!running) return;
    while (nextNoteAt < context.currentTime + .12) {
      const [midi, beats] = SCORE[noteIndex];
      const duration = beats * BEAT_SECONDS;
      playNote(midi, nextNoteAt, duration * .86);
      nextNoteAt += duration;
      noteIndex++;
      if (noteIndex === SCORE.length) {
        noteIndex = 0;
        nextNoteAt += 1.8;
      }
    }
    frame = requestAnimationFrame(tick);
  }

  async function start() {
    const request = ++playRequest;
    // Construct and resume only in the user's tap handler.
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Web Audio is unavailable");
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = .42;
      master.connect(context.destination);
    }
    await context.resume();
    if (request !== playRequest || document.hidden || running) return;
    nextNoteAt = Math.max(nextNoteAt, context.currentTime + .04);
    running = true;
    tick();
  }

  function pause() {
    playRequest++;
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const source of sources) {
      try { source.stop(); } catch { /* Already ended. */ }
    }
    sources.clear();
    if (context?.state === "running") context.suspend();
  }

  function reset() {
    pause();
    noteIndex = 0;
    nextNoteAt = 0;
  }

  function dispose() {
    pause();
    context?.close();
  }

  return { start, pause, reset, dispose };
}
