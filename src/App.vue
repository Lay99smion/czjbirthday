<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import { createWarpField } from "./warp";
import { createFireworks } from "./fireworks";
import {
  countPlacedTiles,
  createScrambledPuzzle,
  isPuzzleSolved,
  swapPuzzleTiles,
} from "./puzzle";

const SECRET = new URLSearchParams(location.search).get("secret") === "love";
const stage = ref("cover");
const opened = ref(false);
const isOpening = ref(false);
const soundOn = ref(true);
const photoOpen = ref(false);
const moonTaps = ref(0);
const typedText = ref("");
const micState = ref("idle");
const holdProgress = ref(0);
const candleOut = ref(false);
const warpActive = ref(false);
const warpCanvas = ref(null);
const fireworksActive = ref(false);
const fireworksCanvas = ref(null);
const heartOpen = ref(false);
const puzzleTiles = ref(createScrambledPuzzle());
const selectedTile = ref(null);
const puzzleSolved = ref(false);
const photoIndex = ref(0);
const photoBusy = ref(false);
const photos = [
  {
    src: "/birthday-photo.webp",
    alt: "窗边烛光与纸星星",
    caption: "把这一刻，悄悄收藏。 ♡",
  },
  {
    src: "/birthday-photo-2.webp",
    alt: "夜色里的生日礼物",
    caption: "所有惊喜，都想与你分享。 ✦",
  },
  {
    src: "/birthday-photo-3.webp",
    alt: "有星星装饰的生日蛋糕",
    caption: "甜甜的愿望，正在实现。 ♡",
  },
];
const starCanvas = ref(null);
const stageOrder = ["main", "letter", "puzzle", "cake"];
const letter =
  "亲爱的你：\n\n愿今天的风轻一点，星光亮一点；\n愿每一个平凡的日子，都藏着让你微笑的惊喜。\n\n新的一岁，继续勇敢地喜欢这个世界，\n也记得好好喜欢自己。\n\n生日快乐。今晚，所有的星星都为你闪耀。";
const currentStep = computed(() => stageOrder.indexOf(stage.value));
const placedCount = computed(() => countPlacedTiles(puzzleTiles.value));

let renderer,
  scene,
  camera,
  stars,
  frame = 0;
let typingFrame = 0,
  holdFrame = 0,
  micFrame = 0,
  musicFrame = 0;
let audioContext, micContext, micStream, micSource, analyser;
let tiltX = 0,
  tiltY = 0,
  lastNoteAt = 0,
  noteIndex = 0;
let touchY = 0,
  holdStarted = 0,
  blowFrames = 0;
let photoTouchX = 0;
let warpEffect = null;
let fireworksEffect = null;
let heartTimer = null;
const notes = [
  392, 440, 523.25, 440, 349.23, 392, 440, 392, 329.63, 349.23, 392, 329.63,
];

async function initStars() {
  if (!starCanvas.value || SECRET) return;
  if (renderer) {
    if (!frame && !document.hidden) animateStars();
    return;
  }
  try {
    const {
      AdditiveBlending,
      BufferAttribute,
      BufferGeometry,
      PerspectiveCamera,
      Points,
      PointsMaterial,
      Scene,
      WebGLRenderer,
    } = await import("three");
    if (!starCanvas.value || document.hidden) return;
    scene = new Scene();
    camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 20;
    const geometry = new BufferGeometry();
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    stars = new Points(
      geometry,
      new PointsMaterial({
        color: 0xffedc4,
        size: 0.085,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(stars);
    renderer = new WebGLRenderer({
      canvas: starCanvas.value,
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    resizeStars();
    animateStars();
  } catch (error) {
    console.info("星空已切换为 CSS 背景", error);
  }
}

function resizeStars() {
  if (!renderer || !camera) return;
  const w = innerWidth,
    h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function animateStars() {
  if (!renderer || document.hidden) return;
  frame = requestAnimationFrame(animateStars);
  const t = performance.now() * 0.00006;
  stars.rotation.y +=
    (tiltX * 0.065 + Math.sin(t) * 0.025 - stars.rotation.y) * 0.025;
  stars.rotation.x += (tiltY * 0.045 - stars.rotation.x) * 0.025;
  stars.rotation.z += 0.00009;
  renderer.render(scene, camera);
}

async function requestOrientation() {
  try {
    if (typeof DeviceOrientationEvent === "undefined") return;
    const permission =
      typeof DeviceOrientationEvent.requestPermission === "function"
        ? DeviceOrientationEvent.requestPermission()
        : Promise.resolve("granted");
    if ((await permission) === "granted")
      window.addEventListener("deviceorientation", onOrientation, {
        passive: true,
      });
  } catch {
    /* Tilt is optional. */
  }
}

async function startWarp() {
  if (!opened.value || warpActive.value) return;
  warpActive.value = true;
  await nextTick();
  if (!warpCanvas.value) {
    warpActive.value = false;
    return;
  }
  gsap.set(".main-title", { opacity: 0, scale: 0.72, y: 20 });
  warpEffect = createWarpField(warpCanvas.value, () => {
    warpEffect?.destroy();
    warpEffect = null;
    warpActive.value = false;
    nextTick(() =>
      gsap.to(".main-title", {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 1.2,
        ease: "back.out(1.5)",
      }),
    );
  });
  if (!document.hidden) warpEffect.start();
}

function onOrientation(event) {
  tiltX = Math.max(-1, Math.min(1, (event.gamma || 0) / 35));
  tiltY = Math.max(-1, Math.min(1, (event.beta || 0) / 50));
}

function playTone(frequency, when) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.025, when + 0.045);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.65);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(when);
  osc.stop(when + 0.7);
}

function musicLoop() {
  if (!audioContext || document.hidden || !soundOn.value) return;
  musicFrame = requestAnimationFrame(musicLoop);
  if (audioContext.currentTime - lastNoteAt > 0.48) {
    lastNoteAt = audioContext.currentTime;
    playTone(notes[noteIndex++ % notes.length], lastNoteAt);
  }
}

function startMusic() {
  if (!soundOn.value || document.hidden) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    if (!musicFrame) musicLoop();
  } catch {
    soundOn.value = false;
  }
}

function toggleMusic() {
  soundOn.value = !soundOn.value;
  if (soundOn.value) startMusic();
  else {
    cancelAnimationFrame(musicFrame);
    musicFrame = 0;
    audioContext?.suspend();
  }
}

async function openEnvelope() {
  if (isOpening.value || opened.value) return;
  isOpening.value = true;
  startMusic(); // Called directly from the first tap for iOS/WeChat audio policy.
  requestOrientation(); // iOS permission prompt must originate from a tap.
  gsap
    .timeline({
      onComplete: async () => {
        opened.value = true;
        stage.value = "main";
        startWarp();
        await nextTick();
        initStars();
      },
    })
    .to(".envelope", { y: -28, scale: 1.08, duration: 0.4, ease: "power2.out" })
    .to(".envelope-flap", {
      rotateX: 180,
      duration: 0.55,
      ease: "power2.inOut",
    })
    .to(
      ".envelope-letter",
      { y: -118, duration: 0.55, ease: "power2.out" },
      "-=0.2",
    )
    .to(
      ".cover-content",
      { opacity: 0, scale: 1.12, duration: 0.55, ease: "power2.in" },
      "-=0.15",
    );
}

function goStage(next) {
  if (
    photoOpen.value ||
    warpActive.value ||
    heartOpen.value ||
    fireworksActive.value ||
    stage.value === next ||
    !opened.value ||
    (candleOut.value && next !== "ending")
  )
    return;
  if (next === "ending") return;
  stopHold();
  stopMicrophone();
  if (stage.value === "cake" && next === "puzzle") {
    puzzleSolved.value = false;
    selectedTile.value = null;
    puzzleTiles.value = createScrambledPuzzle();
  }
  stage.value = next;
  if (next === "letter") {
    typedText.value = "";
    startTyping();
  }
  nextTick(() =>
    gsap.fromTo(
      ".stage-content",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" },
    ),
  );
}

function restartExperience() {
  heartTimer?.kill();
  warpEffect?.destroy();
  fireworksEffect?.destroy();
  warpEffect = null;
  fireworksEffect = null;
  confetti.reset();
  stopHold();
  stopMicrophone();
  cancelAnimationFrame(typingFrame);
  cancelAnimationFrame(musicFrame);
  cancelAnimationFrame(frame);
  typingFrame = 0;
  musicFrame = 0;
  frame = 0;
  audioContext?.suspend();
  stage.value = "cover";
  opened.value = false;
  isOpening.value = false;
  warpActive.value = false;
  fireworksActive.value = false;
  heartOpen.value = false;
  candleOut.value = false;
  micState.value = "idle";
  holdProgress.value = 0;
  typedText.value = "";
  moonTaps.value = 0;
  photoOpen.value = false;
  puzzleSolved.value = false;
  selectedTile.value = null;
  puzzleTiles.value = createScrambledPuzzle();
}

function resetPuzzle() {
  if (puzzleSolved.value || heartOpen.value) return;
  selectedTile.value = null;
  puzzleTiles.value = createScrambledPuzzle();
}

function tapPuzzle(position) {
  if (puzzleSolved.value || heartOpen.value || stage.value !== "puzzle") return;
  if (selectedTile.value === null) {
    selectedTile.value = position;
    return;
  }
  if (selectedTile.value === position) {
    selectedTile.value = null;
    return;
  }
  puzzleTiles.value = swapPuzzleTiles(
    puzzleTiles.value,
    selectedTile.value,
    position,
  );
  selectedTile.value = null;
  if (isPuzzleSolved(puzzleTiles.value)) {
    puzzleSolved.value = true;
    heartOpen.value = true;
    heartTimer?.kill();
    heartTimer = gsap.delayedCall(5, () => {
      heartOpen.value = false;
      goStage("cake");
    });
  }
}

function startTyping() {
  cancelAnimationFrame(typingFrame);
  const existingCount = typedText.value.length;
  let start = 0;
  const tick = (time) => {
    if (stage.value !== "letter" || document.hidden) return;
    start ||= time - existingCount * 42;
    const count = Math.min(letter.length, Math.floor((time - start) / 42));
    typedText.value = letter.slice(0, count);
    if (count < letter.length) typingFrame = requestAnimationFrame(tick);
  };
  typingFrame = requestAnimationFrame(tick);
}

function onTouchStart(event) {
  touchY = event.changedTouches[0]?.clientY || 0;
}
function onTouchEnd(event) {
  if (
    !opened.value ||
    photoOpen.value ||
    warpActive.value ||
    heartOpen.value ||
    fireworksActive.value ||
    stage.value === "ending"
  )
    return;
  const dy = (event.changedTouches[0]?.clientY || 0) - touchY;
  if (Math.abs(dy) < 65) return;
  const index = stageOrder.indexOf(stage.value);
  if (dy < 0 && index < stageOrder.length - 1) goStage(stageOrder[index + 1]);
  if (dy > 0 && index > 0) goStage(stageOrder[index - 1]);
}

function tapMoon() {
  moonTaps.value++;
  gsap.fromTo(
    ".moon-button",
    { rotate: -12, scale: 1.2 },
    { rotate: 0, scale: 1, duration: 0.35, ease: "back.out(2)" },
  );
  if (moonTaps.value >= 5) {
    moonTaps.value = 0;
    openAlbum();
  }
}

function openAlbum() {
  photoIndex.value = 0;
  photoOpen.value = true;
  photos.forEach(({ src }) => {
    const image = new Image();
    image.src = src;
  });
  nextTick(() =>
    gsap.fromTo(
      ".polaroid",
      { opacity: 0, rotateY: -55, rotateZ: -14, y: 50, scale: 0.75 },
      {
        opacity: 1,
        rotateY: 0,
        rotateZ: -4,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "back.out(1.4)",
      },
    ),
  );
}

function flipPhoto(direction) {
  if (photoBusy.value || photos.length < 2) return;
  const card = document.querySelector(".polaroid");
  if (!card) return;
  photoBusy.value = true;
  gsap
    .timeline({
      onComplete: () => {
        photoBusy.value = false;
      },
    })
    .to(card, {
      rotateY: direction > 0 ? -90 : 90,
      rotateZ: direction > 0 ? -12 : 8,
      x: direction > 0 ? -42 : 42,
      scale: 0.82,
      opacity: 0.15,
      duration: 0.32,
      ease: "power2.in",
    })
    .call(() => {
      photoIndex.value =
        (photoIndex.value + direction + photos.length) % photos.length;
      gsap.set(card, {
        rotateY: direction > 0 ? 90 : -90,
        rotateZ: direction > 0 ? 8 : -12,
        x: direction > 0 ? 42 : -42,
      });
    })
    .to(card, {
      rotateY: 0,
      rotateZ: -4,
      x: 0,
      scale: 1,
      opacity: 1,
      duration: 0.48,
      ease: "back.out(1.2)",
    });
}

function onPhotoTouchStart(event) {
  photoTouchX = event.changedTouches[0]?.clientX || 0;
}
function onPhotoTouchEnd(event) {
  const dx = (event.changedTouches[0]?.clientX || 0) - photoTouchX;
  if (Math.abs(dx) > 45) flipPhoto(dx < 0 ? 1 : -1);
}

function holdTick(time) {
  if (!holdStarted || candleOut.value) return;
  holdProgress.value = Math.min(100, ((time - holdStarted) / 2000) * 100);
  if (holdProgress.value >= 100) blowOut();
  else holdFrame = requestAnimationFrame(holdTick);
}
function startHold(event) {
  event.preventDefault();
  if (candleOut.value) return;
  holdStarted = performance.now();
  holdFrame = requestAnimationFrame(holdTick);
}
function stopHold() {
  holdStarted = 0;
  cancelAnimationFrame(holdFrame);
  if (!candleOut.value) holdProgress.value = 0;
}

async function startMicrophone() {
  if (micState.value === "listening" || candleOut.value) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    micState.value = "unavailable";
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    micContext = new (window.AudioContext || window.webkitAudioContext)();
    await micContext.resume();
    micSource = micContext.createMediaStreamSource(micStream);
    analyser = micContext.createAnalyser();
    analyser.fftSize = 1024;
    micSource.connect(analyser);
    micState.value = "listening";
    monitorMic();
  } catch {
    micState.value = "denied";
    stopMicrophone(false);
  }
}

function monitorMic() {
  if (
    micState.value !== "listening" ||
    document.hidden ||
    stage.value !== "cake"
  )
    return;
  micFrame = requestAnimationFrame(monitorMic);
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += ((data[i] - 128) / 128) ** 2;
  const rms = Math.sqrt(sum / data.length);
  blowFrames = rms > 0.09 ? blowFrames + 1 : Math.max(0, blowFrames - 2);
  if (blowFrames > 10) blowOut();
}

function stopMicrophone(reset = true) {
  cancelAnimationFrame(micFrame);
  micFrame = 0;
  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  micSource?.disconnect();
  micSource = null;
  micContext?.close();
  micContext = null;
  analyser = null;
  blowFrames = 0;
  if (reset && micState.value === "listening") micState.value = "idle";
}

function blowOut() {
  if (candleOut.value) return;
  candleOut.value = true;
  stopHold();
  stopMicrophone();
  gsap.to(".flame", {
    opacity: 0,
    scale: 0,
    y: -22,
    duration: 0.4,
    ease: "power2.out",
  });
  gsap.delayedCall(0.45, celebrate);
}

function celebrate() {
  const colors = ["#f7d88e", "#e9a8bc", "#b5c8ff", "#ffffff"];
  const fire = (x, y, count) =>
    confetti({
      particleCount: count,
      spread: 95,
      startVelocity: 48,
      gravity: 1.15,
      ticks: 90,
      origin: { x, y },
      colors,
      disableForReducedMotion: true,
    });
  fire(0.2, 0.38, 75);
  gsap.delayedCall(0.35, () => fire(0.8, 0.33, 75));
  gsap.delayedCall(0.8, () => fire(0.5, 0.24, 90));
  gsap.delayedCall(1.4, () =>
    confetti({
      particleCount: 110,
      spread: 110,
      origin: { y: 0.65 },
      colors,
      gravity: 1.15,
      ticks: 90,
      disableForReducedMotion: true,
    }),
  );
  gsap.delayedCall(3.3, startFinaleFireworks);
}

async function startFinaleFireworks() {
  confetti.reset();
  stage.value = "ending";
  fireworksActive.value = true;
  await nextTick();
  if (!fireworksCanvas.value) {
    fireworksActive.value = false;
    return;
  }
  fireworksEffect = createFireworks(fireworksCanvas.value, () => {
    fireworksEffect?.destroy();
    fireworksEffect = null;
    fireworksActive.value = false;
    nextTick(() =>
      gsap.fromTo(
        ".ending-content",
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" },
      ),
    );
  });
  if (!document.hidden) fireworksEffect.start();
}

function onVisibility() {
  document.documentElement.classList.toggle("page-hidden", document.hidden);
  if (document.hidden) {
    warpEffect?.pause();
    fireworksEffect?.pause();
    gsap.globalTimeline.pause();
    confetti.reset();
    stopHold();
    cancelAnimationFrame(frame);
    frame = 0;
    cancelAnimationFrame(typingFrame);
    typingFrame = 0;
    cancelAnimationFrame(musicFrame);
    musicFrame = 0;
    cancelAnimationFrame(micFrame);
    micFrame = 0;
    audioContext?.suspend();
    if (micState.value === "listening") stopMicrophone();
  } else {
    warpEffect?.resume();
    fireworksEffect?.resume();
    gsap.globalTimeline.resume();
    if (renderer && !frame && stage.value !== "cover") animateStars();
    if (stage.value === "letter" && typedText.value.length < letter.length)
      startTyping();
    if (soundOn.value && opened.value) startMusic();
  }
}

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resizeStars, { passive: true });
});
onBeforeUnmount(() => {
  warpEffect?.destroy();
  fireworksEffect?.destroy();
  heartTimer?.kill();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(typingFrame);
  cancelAnimationFrame(holdFrame);
  cancelAnimationFrame(musicFrame);
  stopMicrophone();
  window.removeEventListener("resize", resizeStars);
  window.removeEventListener("deviceorientation", onOrientation);
  document.removeEventListener("visibilitychange", onVisibility);
  stars?.geometry.dispose();
  stars?.material.dispose();
  renderer?.dispose();
  audioContext?.close();
});
</script>

<template>
  <main
    class="app-shell"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <section v-if="SECRET" class="secret-page">
      <div class="secret-spark">✦</div>
      <div class="secret-card">
        <span class="eyebrow">A LITTLE SECRET FOR YOU</span>
        <div class="secret-heart">♥</div>
        <h1>你是我藏在<br />星光里的秘密</h1>
        <p>
          如果今天的愿望有回音，<br />那一定是宇宙也在轻轻说：<br />很高兴，你来到这个世界。
        </p>
        <div class="secret-divider">✦ &nbsp; ✦ &nbsp; ✦</div>
        <a href="/" class="pill-button">返回生日夜空 <span>↗</span></a>
      </div>
      <p class="secret-footer">ONLY FOR YOU · WITH LOVE</p>
    </section>

    <template v-else>
      <canvas ref="starCanvas" class="star-canvas" aria-hidden="true"></canvas>
      <div class="star-fallback" aria-hidden="true"></div>
      <div class="orbit orbit-one" aria-hidden="true"></div>
      <div class="orbit orbit-two" aria-hidden="true"></div>

      <header v-if="opened" class="topbar">
        <button
          class="icon-button moon-button"
          type="button"
          aria-label="小月亮，轻点看看"
          @click="tapMoon"
        >
          ☾
        </button>
        <small class="moon-whisper">1，2，3，4，5 · 月光里，也许藏着一点秘密</small>
        <div class="topbar-center"><span class="topbar-label">A NIGHT FOR YOU <span>✦</span></span></div>
        <button
          class="icon-button sound-button"
          type="button"
          :aria-label="soundOn ? '关闭音乐' : '开启音乐'"
          @click="toggleMusic"
        >
          {{ soundOn ? "♫" : "♪" }}<i v-if="!soundOn" class="sound-slash"></i>
        </button>
      </header>

      <section v-if="stage === 'cover'" class="cover-page">
        <div class="cover-stars" aria-hidden="true">✦ <span>✧</span> ✦</div>
        <div class="cover-content">
          <div class="cover-kicker">
            <span class="line"></span> 一封来自星星的信
            <span class="line"></span>
          </div>
          <h1>今晚，<br /><em>有一束光</em>为你亮起</h1>
          <p class="cover-subtitle">把这份小小的惊喜，送给特别的你</p>
          <button
            class="envelope-wrap"
            type="button"
            aria-label="点击打开生日祝福"
            @click="openEnvelope"
          >
            <span class="envelope-glow"></span>
            <span class="envelope-letter"><span>TO YOU</span><b>♡</b></span>
            <span class="envelope"
              ><span class="envelope-back"></span
              ><span class="envelope-flap"></span
              ><span class="envelope-front"></span
              ><span class="wax-seal">✦</span></span
            >
          </button>
          <button class="open-prompt" type="button" @click="openEnvelope">
            点击打开 <span>↗</span>
          </button>
        </div>
        <div class="cover-bottom">
          <span>01 / 05</span><span>轻触，开启这场小小的宇宙漫游</span>
        </div>
      </section>

      <template v-else>
        <section v-if="stage === 'main'" class="scene-page main-page">
          <div class="stage-content main-content">
            <div class="tiny-label">
              ✦ &nbsp; THE STARS ARE YOURS TONIGHT &nbsp; ✦
            </div>
            <div class="birthday-halo">
              <span class="halo-ring ring-one"></span
              ><span class="halo-ring ring-two"></span
              ><span class="halo-spark spark-one">✦</span
              ><span class="halo-spark spark-two">✧</span
              ><span class="halo-spark spark-three">✦</span>
              <div class="main-title">
                <small>HAPPY BIRTHDAY</small>
                <h2>生日<br /><em>快乐</em></h2>
                <div class="title-star">✦</div>
              </div>
            </div>
            <p class="main-message">
              愿你被爱包围，<br />也永远拥有奔向热爱的勇气。
            </p>
            <button
              class="gesture-hint"
              type="button"
              @click="goStage('letter')"
            >
              <span>向上滑动，拆开祝福信</span><b>⌃</b>
            </button>
          </div>
        </section>

        <section v-if="stage === 'letter'" class="scene-page letter-page">
          <div class="falling-lights" aria-hidden="true">
            <i v-for="n in 12" :key="n" :style="{ '--i': n }"></i>
          </div>
          <div class="stage-content letter-content">
            <div class="section-number">02 <span>/</span> 05</div>
            <span class="section-kicker">A LETTER JUST FOR YOU</span>
            <h2>写给<span>今天的你</span></h2>
            <div class="letter-paper">
              <div class="letter-paper-top">
                <span>✦</span><span>DEAR YOU</span><span>✦</span>
              </div>
              <p class="typewriter">
                {{ typedText
                }}<span v-if="typedText.length < letter.length" class="cursor"
                  >▍</span
                >
              </p>
              <div class="paper-sign">— 来自这片星空 <span>♡</span></div>
            </div>
            <button
              class="pill-button letter-next"
              type="button"
              @click="goStage('puzzle')"
            >
              拼出一份惊喜 <span>↗</span>
            </button>
            <p class="swipe-small">继续上滑也可以哦 ↑</p>
          </div>
        </section>

        <section v-if="stage === 'puzzle'" class="scene-page puzzle-page">
          <div class="stage-content puzzle-content">
            <div class="section-number">11 <span>/</span> 12</div>
            <span class="section-kicker">A LITTLE PIECE OF LOVE</span>
            <h2>把惊喜<span>拼完整</span></h2>
            <p class="puzzle-intro">
              轻点两块碎片交换位置，<br />拼好后有彩蛋！
            </p>
            <div class="puzzle-reference">
              <img
                src="/birthday-photo-2.webp"
                loading="lazy"
                alt="拼图完成参考图"
              /><span>参考图</span>
            </div>
            <div class="puzzle-grid" role="group" aria-label="九块生日照片拼图">
              <button
                v-for="(piece, position) in puzzleTiles"
                :key="position"
                class="puzzle-tile"
                :class="{
                  selected: selectedTile === position,
                  placed: piece === position,
                }"
                :style="{
                  backgroundPosition: `${(piece % 3) * 50}% ${Math.floor(piece / 3) * 50}%`,
                }"
                type="button"
                :aria-label="`第 ${position + 1} 格，拼图碎片`"
                :aria-pressed="selectedTile === position"
                @click="tapPuzzle(position)"
              ></button>
            </div>
            <div class="puzzle-bottom">
              <span
                >已归位 <b>{{ placedCount }}</b> / 9</span
              ><button type="button" @click="resetPuzzle">重新打乱 ↻</button>
            </div>
            <p class="puzzle-hint">选中一块，再点另一块交换</p>
            <button class="puzzle-next" type="button" @click="goStage('cake')">
              下一步 · 去许愿 <span>↗</span>
            </button>
          </div>
        </section>

        <section v-if="stage === 'cake'" class="scene-page cake-page">
          <div class="stage-content cake-content">
            <div class="section-number">04 <span>/</span> 05</div>
            <span class="section-kicker">MAKE A WISH</span>
            <h2>许个愿吧，<br /><em>今天你是主角。</em></h2>
            <p class="cake-intro">
              闭上眼睛想一想，<br />然后轻轻吹灭这支蜡烛。
            </p>
            <div
              class="cake-art"
              role="img"
              aria-label="一块点着蜡烛的生日蛋糕"
            >
              <div class="cake-spark s1">✧</div>
              <div class="cake-spark s2">✦</div>
              <div class="cake-spark s3">✧</div>
              <div class="flame"><span></span></div>
              <div class="wick"></div>
              <div class="candle"><i></i><i></i><i></i></div>
              <div class="cake-icing"><i></i><i></i><i></i><i></i><i></i></div>
              <div class="cake-top"></div>
              <div class="cake-layer">
                <span class="cake-dots">✦ &nbsp; ✦ &nbsp; ✦</span>
              </div>
              <div class="cake-base"></div>
              <div class="cake-plate"></div>
            </div>
            <div class="wish-actions">
              <button
                class="mic-button"
                type="button"
                :disabled="candleOut"
                @click="startMicrophone"
              >
                <span class="mic-icon">◉</span
                >{{
                  micState === "listening"
                    ? "正在听你吹气…"
                    : "启用麦克风吹蜡烛"
                }}
              </button>
              <p
                v-if="micState === 'denied' || micState === 'unavailable'"
                class="mic-note"
              >
                麦克风不可用，长按蜡烛也能许愿。
              </p>
              <div class="or-line"><span>或者</span></div>
              <button
                class="hold-button"
                type="button"
                :disabled="candleOut"
                @pointerdown="startHold"
                @pointerup="stopHold"
                @pointercancel="stopHold"
                @pointerleave="stopHold"
                @contextmenu.prevent
              >
                <span
                  class="hold-fill"
                  :style="{ width: holdProgress + '%' }"
                ></span
                ><span class="hold-label">长按这里 2 秒吹灭蜡烛</span>
              </button>
            </div>
          </div>
        </section>

        <section v-if="stage === 'ending'" class="scene-page ending-page">
          <div class="heart-rain" aria-hidden="true">
            <span v-for="n in 15" :key="n" :style="{ '--i': n }">♥</span>
          </div>
          <div class="stage-content ending-content">
            <div class="ending-icon">✦</div>
            <span class="section-kicker">YOUR WISH IS ON ITS WAY</span>
            <h2>愿你的每一天，<br /><em>都闪闪发光。</em></h2>
            <p>新的一岁，平安、热烈、自由。<br />所有美好，都会如约而至。</p>
            <div class="ending-line"></div>
            <span class="ending-love">生日快乐，亲爱的你 ♡</span>
            <button class="restart-button" type="button" @click="restartExperience">从头再看一遍 <span>↺</span></button>
          </div>
          <footer>Made with <span>❤️</span> by Lay</footer>
        </section>

        <nav v-if="stage !== 'ending'" class="step-nav" aria-label="页面进度">
          <span
            v-for="(item, i) in stageOrder"
            :key="item"
            :class="{ active: currentStep === i }"
          ></span>
        </nav>
      </template>

      <div
        v-if="heartOpen"
        class="heart-overlay"
        role="status"
        aria-live="polite"
        @touchstart.stop
        @touchend.stop
      >
        <span class="heart-kicker">YOU FOUND IT</span>
        <div class="beating-heart" aria-hidden="true">♥</div>
        <svg class="ecg" viewBox="0 0 360 100" aria-hidden="true">
          <path
            class="ecg-base"
            d="M0 50 H78 L93 50 L105 31 L119 73 L133 12 L147 50 H360"
          />
          <path
            class="ecg-pulse"
            d="M0 50 H78 L93 50 L105 31 L119 73 L133 12 L147 50 H360"
          />
        </svg>
        <strong>祝你保持一颗炽热的心</strong><small>下一站，去许一个愿望</small>
      </div>

      <div
        v-if="fireworksActive"
        class="fireworks-overlay"
        role="status"
        aria-live="polite"
        @touchstart.stop
        @touchend.stop
      >
        <canvas
          ref="fireworksCanvas"
          class="fireworks-canvas"
          aria-hidden="true"
        ></canvas>
        <div class="fireworks-copy">
          <span>✦ &nbsp; WISHES IN THE SKY &nbsp; ✦</span
          ><strong>把愿望交给夜空</strong>
        </div>
      </div>

      <div
        v-if="warpActive"
        class="warp-overlay"
        role="status"
        aria-live="polite"
        @touchstart.stop
        @touchend.stop
      >
        <canvas
          ref="warpCanvas"
          class="warp-canvas"
          aria-hidden="true"
        ></canvas>
        <div class="warp-vignette" aria-hidden="true"></div>
        <div class="warp-portal" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="warp-copy">
          <span>✦ &nbsp; A LITTLE UNIVERSE &nbsp; ✦</span
          ><strong>正在穿越<br />你的生日宇宙</strong
          ><small>愿望已经出发</small>
        </div>
        <div class="warp-progress" aria-hidden="true"><i></i></div>
      </div>

      <div
        v-if="photoOpen"
        class="photo-modal"
        role="dialog"
        aria-modal="true"
        aria-label="隐藏照片相册"
        @click.self="photoOpen = false"
        @touchstart.stop="onPhotoTouchStart"
        @touchend.stop="onPhotoTouchEnd"
      >
        <button
          class="modal-close"
          type="button"
          aria-label="关闭照片"
          @click="photoOpen = false"
        >
          ×
        </button>
        <div class="album-heading"><span>MOONLIGHT MEMORIES</span><b>✦</b></div>
        <div class="photo-stage">
          <div class="polaroid" @click="flipPhoto(1)">
            <img
              :src="photos[photoIndex].src"
              :alt="photos[photoIndex].alt"
              loading="lazy"
            />
            <div class="polaroid-caption">{{ photos[photoIndex].caption }}</div>
          </div>
        </div>
        <div class="album-controls">
          <button type="button" aria-label="上一张照片" @click="flipPhoto(-1)">
            ‹
          </button>
          <div class="album-count">
            <span>{{ String(photoIndex + 1).padStart(2, "0") }}</span> /
            {{ String(photos.length).padStart(2, "0") }}
          </div>
          <button type="button" aria-label="下一张照片" @click="flipPhoto(1)">
            ›
          </button>
        </div>
        <div class="album-dots">
          <span
            v-for="(_, i) in photos"
            :key="i"
            :class="{ active: i === photoIndex }"
          ></span>
        </div>
        <p class="modal-hint">左右滑动 · 或点照片翻到下一张</p>
      </div>
    </template>
  </main>
</template>
