<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import { createWarpField } from "./warp";
import { createFireworks } from "./fireworks";
import { createBirthdayMusic } from "./birthdayMusic";
import { createMemoryFilmMusic } from "./memoryFilmMusic";
import MemoryFilm from "./components/MemoryFilm.vue";
import WishWall from "./components/WishWall.vue";
import GiftLetter from "./components/GiftLetter.vue";
import StarCollection from "./components/StarCollection.vue";
import SecretNote from "./components/SecretNote.vue";
import SecretRoomEntry from "./components/SecretRoomEntry.vue";
import BirdLetter from "./components/BirdLetter.vue";
import BirthdayTicket from "./components/BirthdayTicket.vue";
import { albumPhotos as photos } from "./memories";
import { preloadMemoryPhotos } from "./memoryPhotos";
import { assetUrl } from "./assets";
import {
  countPlacedTiles,
  createScrambledPuzzle,
  isPuzzleSolved,
  swapPuzzleTiles,
} from "./puzzle";

const SECRET = new URLSearchParams(location.search).get("secret") === "yl";
const SecretRoom = defineAsyncComponent(() => import("./components/SecretRoom.vue"));
const WISH_PAGE = new URLSearchParams(location.search).get("page") === "wishes";
const birthdayName = "陈照敬";
const birthdayDate = "1月10日";
const wishWallUrl = `${assetUrl("")}?page=wishes`;
const warpCharacterUrl = assetUrl("/labixiaoxin.png");
const birthdayMusic = createBirthdayMusic();
const memoryFilmMusic = createMemoryFilmMusic();
const stage = ref("cover");
const opened = ref(false);
const isOpening = ref(false);
const soundOn = ref(true);
const letterAudioActive = ref(false);
const photoOpen = ref(false);
const memoryTransitionActive = ref(false);
const moonTaps = ref(0);
const letterReady = ref(false);
const smokeVisible = ref(false);
const shell = ref(null);
const micState = ref("idle");
const holdProgress = ref(0);
const candleOut = ref(false);
const warpActive = ref(false);
const warpLeaving = ref(false);
const warpCanvas = ref(null);
const fireworksActive = ref(false);
const fireworksCanvas = ref(null);
const heartOpen = ref(false);
const secretLetterOpen = ref(false);
const latestWish = ref("");
const ticketEntry = ref(null);
const puzzleTiles = ref(createScrambledPuzzle());
const selectedTile = ref(null);
const puzzleSolved = ref(false);
const photoIndex = ref(0);
const photoBusy = ref(false);
const starCanvas = ref(null);
const stageOrder = ["main", "letter", "puzzle", "cake"];
const currentStep = computed(() => stageOrder.indexOf(stage.value));
const placedCount = computed(() => countPlacedTiles(puzzleTiles.value));

let renderer,
  scene,
  camera,
  stars,
  frame = 0;
let holdFrame = 0,
  micFrame = 0;
let micContext, micStream, micSource, analyser;
let tiltX = 0,
  tiltY = 0;
let touchY = 0,
  holdStarted = 0,
  blowFrames = 0;
let photoTouchX = 0;
let warpEffect = null;
let fireworksEffect = null;
let heartTimer = null;
let secretReturnFocus = null;
let disposing = false;
function openSecretLetter(input) {
  if (secretLetterOpen.value) return;
  secretReturnFocus = input;
  secretLetterOpen.value = true;
  playUiSound("star");
}
function restoreSecretFocus() {
  secretReturnFocus?.focus({ preventScroll: true });
  secretReturnFocus = null;
}
function openBirthdayTicket() {
  stage.value = "ticket";
}
function returnFromTicket() {
  stage.value = "ending";
  nextTick(() => ticketEntry.value?.focus({ preventScroll: true }));
}
const celebrationCalls = new Set();
function later(seconds, callback) {
  const call = gsap.delayedCall(seconds, () => {
    celebrationCalls.delete(call);
    callback();
  });
  celebrationCalls.add(call);
  return call;
}
function clearCelebration() {
  celebrationCalls.forEach((call) => call.kill());
  celebrationCalls.clear();
}
function playUiSound(kind) {
  if (soundOn.value && !letterAudioActive.value) birthdayMusic.effect(kind);
}
function onPointerMove(event) {
  if (
    memoryTransitionActive.value ||
    event.pointerType === "touch" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  tiltX = (event.clientX / innerWidth - 0.5) * 2;
  tiltY = (event.clientY / innerHeight - 0.5) * 2;
  shell.value?.style.setProperty("--px", `${tiltX * 7}px`);
  shell.value?.style.setProperty("--py", `${tiltY * 5}px`);
}
function resetParallax() {
  tiltX = 0;
  tiltY = 0;
  shell.value?.style.setProperty("--px", "0px");
  shell.value?.style.setProperty("--py", "0px");
}

async function initStars() {
  if (!starCanvas.value || SECRET) return;
  if (renderer) {
    if (!frame && !document.hidden && !memoryTransitionActive.value)
      animateStars();
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
  if (!renderer || document.hidden || memoryTransitionActive.value) return;
  frame = requestAnimationFrame(animateStars);
  const t = performance.now() * 0.00006;
  stars.rotation.y +=
    (tiltX * 0.065 + Math.sin(t) * 0.025 - stars.rotation.y) * 0.025;
  stars.rotation.x += (tiltY * 0.045 - stars.rotation.x) * 0.025;
  stars.rotation.z += 0.00009;
  renderer.render(scene, camera);
}

watch(memoryTransitionActive, (active) => {
  cancelAnimationFrame(frame);
  frame = 0;
  if (!active && renderer && !document.hidden && opened.value) animateStars();
});

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
    stage.value = "main";
    return;
  }
  warpEffect = createWarpField(warpCanvas.value, () => {
    warpEffect?.destroy();
    warpEffect = null;
    warpLeaving.value = true;
    stage.value = "main";
    warpActive.value = false;
  });
  if (!document.hidden) warpEffect.start();
}

function onOrientation(event) {
  if (memoryTransitionActive.value) return;
  tiltX = Math.max(-1, Math.min(1, (event.gamma || 0) / 35));
  tiltY = Math.max(-1, Math.min(1, (event.beta || 0) / 50));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  shell.value?.style.setProperty("--px", `${tiltX * 7}px`);
  shell.value?.style.setProperty("--py", `${tiltY * 5}px`);
}

function startMusic() {
  if (disposing || !soundOn.value || letterAudioActive.value || document.hidden)
    return;
  if (stage.value === "main") {
    birthdayMusic.pause();
    memoryFilmMusic.start().catch(onMusicError);
  } else {
    memoryFilmMusic.pause();
    birthdayMusic.start().catch(onMusicError);
  }
}

function onMusicError() {
  soundOn.value = false;
  birthdayMusic.pause();
  memoryFilmMusic.pause();
}

function onLetterAudio(active) {
  if (letterAudioActive.value === active) return;
  letterAudioActive.value = active;
  if (active) {
    birthdayMusic.pause();
    memoryFilmMusic.pause();
  } else if (opened.value) startMusic();
}

function toggleMusic() {
  soundOn.value = !soundOn.value;
  if (soundOn.value) {
    if (stage.value !== "main") memoryFilmMusic.unlock();
    startMusic();
  } else {
    birthdayMusic.pause();
    memoryFilmMusic.pause();
  }
}

watch(
  stage,
  () => {
    if (stage.value === "main") birthdayMusic.pause();
    else memoryFilmMusic.pause();
    if (
      opened.value &&
      soundOn.value &&
      !letterAudioActive.value &&
      !document.hidden
    )
      startMusic();
  },
  { flush: "post" },
);

async function openEnvelope() {
  if (isOpening.value || opened.value) return;
  isOpening.value = true;
  if (soundOn.value) memoryFilmMusic.unlock();
  startMusic(); // Called directly from the first tap for iOS/WeChat audio policy.
  requestOrientation(); // iOS permission prompt must originate from a tap.
  gsap
    .timeline({
      onComplete: async () => {
        opened.value = true;
        stage.value = "warp";
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
    warpLeaving.value ||
    heartOpen.value ||
    fireworksActive.value ||
    stage.value === next ||
    !opened.value ||
    (stage.value === "main" && next !== "letter") ||
    (stage.value === "letter" && !letterReady.value) ||
    stage.value === "stars" ||
    candleOut.value
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
    letterReady.value = false;
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
  clearCelebration();
  warpEffect?.destroy();
  fireworksEffect?.destroy();
  warpEffect = null;
  fireworksEffect = null;
  confetti.reset();
  stopHold();
  stopMicrophone();
  cancelAnimationFrame(frame);
  frame = 0;
  birthdayMusic.reset();
  memoryFilmMusic.reset();
  stage.value = "cover";
  opened.value = false;
  isOpening.value = false;
  letterAudioActive.value = false;
  warpActive.value = false;
  warpLeaving.value = false;
  fireworksActive.value = false;
  heartOpen.value = false;
  secretLetterOpen.value = false;
  latestWish.value = "";
  secretReturnFocus = null;
  candleOut.value = false;
  micState.value = "idle";
  holdProgress.value = 0;
  letterReady.value = false;
  smokeVisible.value = false;
  moonTaps.value = 0;
  photoOpen.value = false;
  memoryTransitionActive.value = false;
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

function onTouchStart(event) {
  touchY = event.changedTouches[0]?.clientY || 0;
}
function onTouchEnd(event) {
  if (
    event.target.closest?.(".letter-paper, .secret-note, .film-rail") ||
    !opened.value ||
    photoOpen.value ||
    warpActive.value ||
    heartOpen.value ||
    fireworksActive.value ||
    ["ending", "stars", "main", "ticket"].includes(stage.value)
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
  playUiSound("blow");
  gsap.to(".flame", {
    opacity: 0,
    scale: 0,
    y: -22,
    duration: 0.4,
    ease: "power2.out",
  });
  smokeVisible.value = true;
  later(2.7, () => {
    smokeVisible.value = false;
    celebrate();
  });
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
  later(0.35, () => fire(0.8, 0.33, 75));
  later(0.8, () => fire(0.5, 0.24, 90));
  later(1.4, () =>
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
  later(3.3, startFinaleFireworks);
}

async function startFinaleFireworks() {
  confetti.reset();
  stage.value = "stars";
  fireworksActive.value = true;
  await nextTick();
  if (!fireworksCanvas.value) {
    fireworksActive.value = false;
    return;
  }
  fireworksEffect = createFireworks(
    fireworksCanvas.value,
    () => {
      fireworksEffect?.destroy();
      fireworksEffect = null;
      fireworksActive.value = false;
    },
    () => playUiSound("firework"),
  );
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
    cancelAnimationFrame(micFrame);
    micFrame = 0;
    birthdayMusic.pause();
    memoryFilmMusic.pause();
    if (micState.value === "listening") stopMicrophone();
  } else {
    warpEffect?.resume();
    fireworksEffect?.resume();
    gsap.globalTimeline.resume();
    if (renderer && !frame && stage.value !== "cover") animateStars();
    if (soundOn.value && opened.value) startMusic();
  }
}

onMounted(() => {
  if (!SECRET && !WISH_PAGE) {
    preloadMemoryPhotos();
    const warpImage = new Image();
    warpImage.src = warpCharacterUrl;
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resizeStars, { passive: true });
});
onBeforeUnmount(() => {
  disposing = true;
  warpEffect?.destroy();
  fireworksEffect?.destroy();
  heartTimer?.kill();
  clearCelebration();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(holdFrame);
  stopMicrophone();
  window.removeEventListener("resize", resizeStars);
  window.removeEventListener("deviceorientation", onOrientation);
  document.removeEventListener("visibilitychange", onVisibility);
  stars?.geometry.dispose();
  stars?.material.dispose();
  renderer?.dispose();
  birthdayMusic.dispose();
  memoryFilmMusic.dispose();
});
</script>

<template>
  <WishWall v-if="WISH_PAGE" :home-href="assetUrl('')" />
  <main
    v-else
    ref="shell"
    class="app-shell"
    :class="{ 'memory-transition': memoryTransitionActive }"
    @pointermove="onPointerMove"
    @pointerleave="resetParallax"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <SecretRoom
      v-if="SECRET"
      :name="birthdayName"
      :home-href="assetUrl('')"
      :character-src="warpCharacterUrl"
    />

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
        <small class="moon-whisper">轻点五下 · 月光里，也许藏着一点秘密</small>
        <div class="topbar-center">
          <span class="topbar-label">A NIGHT FOR YOU <span>✦</span></span>
        </div>
        <a class="wish-wall-nav-link wish-wall-entry" :href="wishWallUrl"
          >祝福墙</a
        >
        <button
          class="icon-button sound-button"
          type="button"
          :aria-label="soundOn ? '关闭音乐' : '开启音乐'"
          :aria-pressed="soundOn"
          @click="toggleMusic"
        >
          ♫<i v-if="!soundOn" class="sound-slash" aria-hidden="true"></i>
        </button>
      </header>

      <section v-if="stage === 'cover'" class="cover-page">
        <div class="cover-stars" aria-hidden="true">✦ <span>✧</span> ✦</div>
        <div class="cover-content">
          <div class="cover-kicker">
            <span class="line"></span> {{ birthdayDate }} · 写给{{
              birthdayName
            }}的生日信
            <span class="line"></span>
          </div>
          <h1>今晚，<br /><em>有一束光</em>为你亮起</h1>
          <p class="cover-subtitle">
            {{ birthdayName }}，把这份小小的惊喜送给你
          </p>
          <button
            class="envelope-wrap"
            type="button"
            :aria-label="`点击打开送给${birthdayName}的生日祝福`"
            @click="openEnvelope"
          >
            <span class="envelope-glow"></span>
            <span class="envelope-letter"
              ><span>TO {{ birthdayName }}</span
              ><b>♡</b></span
            >
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
          <SecretRoomEntry :disabled="isOpening" />
          <a class="wish-wall-entry" :href="wishWallUrl"
            >写一份祝福 <span>↗</span></a
          >
        </div>
      </section>

      <template v-else>
        <section v-if="stage === 'main'" class="scene-page memory-page">
          <MemoryFilm
            :paused="warpActive || warpLeaving || photoOpen"
            @departing="memoryTransitionActive = $event"
            @complete="goStage('letter')"
          />
        </section>

        <section v-if="stage === 'letter'" class="scene-page letter-page">
          <GiftLetter
            :name="birthdayName"
            :date="birthdayDate"
            @ready="letterReady = true"
            @sound="playUiSound"
            @voice="onLetterAudio"
            @next="goStage('puzzle')"
          />
        </section>

        <section v-if="stage === 'puzzle'" class="scene-page puzzle-page">
          <div class="stage-content puzzle-content">
            <span class="section-kicker">A LITTLE PIECE OF LOVE</span>
            <h2>把惊喜<span>拼完整</span></h2>
            <p class="puzzle-intro">
              轻点两块碎片交换位置，<br />拼好后有彩蛋！
            </p>
            <div class="puzzle-reference">
              <img
                :src="assetUrl('/pic2.webp')"
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
                  backgroundImage: `url('${assetUrl('/pic2.webp')}')`,
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
            <span class="section-kicker">MAKE A WISH</span>
            <h2>许个愿吧，<br /><em>今天你是主角。</em></h2>
            <p class="cake-intro">
              闭上眼睛想一想，<br />然后轻轻吹灭这支蜡烛。
            </p>
            <div
              class="cake-art"
              role="img"
              :aria-label="
                candleOut
                  ? '蜡烛已熄灭，白烟正在升起的生日蛋糕'
                  : '一块点着蜡烛的生日蛋糕'
              "
            >
              <div class="cake-spark s1">✧</div>
              <div class="cake-spark s2">✦</div>
              <div class="cake-spark s3">✧</div>
              <div class="flame" :class="{ extinguished: candleOut }">
                <span></span>
              </div>
              <div v-if="smokeVisible" class="candle-smoke" aria-hidden="true">
                <i v-for="n in 6" :key="n" :style="{ '--i': n }"></i>
              </div>
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
                :class="{ listening: micState === 'listening' }"
                type="button"
                :disabled="candleOut"
                @click="startMicrophone"
              >
                <span class="mic-icon" aria-hidden="true">◉</span
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
                ><span class="hold-label">{{
                  candleOut ? "愿望已藏进这一缕白烟里" : "长按这里 2 秒吹灭蜡烛"
                }}</span>
              </button>
            </div>
          </div>
        </section>

        <Transition name="finale-scene">
          <StarCollection
            v-if="stage === 'stars' && !fireworksActive"
            key="stars"
            @sound="playUiSound"
            @complete="stage = 'ending'"
          />

          <section
            v-else-if="stage === 'ending'"
            key="ending"
            class="scene-page ending-page"
          >
            <div class="birthday-rain" aria-hidden="true">
              <span v-for="n in 15" :key="n" :style="{ '--i': n }">{{
                n % 2 ? "🎂" : "⭐️"
              }}</span>
            </div>
            <div class="stage-content ending-content">
              <div class="ending-icon">✦</div>
              <span class="section-kicker">YOUR WISH IS ON ITS WAY</span>
              <h2>生日快乐🎂<br /><em>祝你永远18岁</em></h2>
              <p>新的一岁，平安、热烈、自由。<br />所有美好，都会如约而至。</p>
              <div class="ending-line"></div>
              <span class="ending-love">生日快乐，{{ birthdayName }}</span>
              <div class="ending-secrets">
                <SecretNote @secret="openSecretLetter" />
                <SecretRoomEntry />
              </div>
              <div class="ending-actions">
                <button
                  ref="ticketEntry"
                  class="ticket-entry"
                  type="button"
                  @click="openBirthdayTicket"
                >
                  制作生日纪念票 <span>↗</span>
                </button>
                <button
                  class="restart-button"
                  type="button"
                  @click="restartExperience"
                >
                  从头再看一遍 <span>↺</span>
                </button>
              </div>
            </div>
            <footer>Made with <span>❤️</span> by Lay</footer>
          </section>
        </Transition>

        <BirthdayTicket
          v-if="stage === 'ticket'"
          :name="birthdayName"
          :date="birthdayDate"
          :photo="assetUrl('/time1.webp')"
          :initial-wish="latestWish"
          @wish="latestWish = $event"
          @back="returnFromTicket"
        />

        <nav
          v-if="!['ending', 'stars', 'ticket'].includes(stage)"
          class="step-nav"
          aria-label="页面进度"
        >
          <span
            v-for="(item, i) in stageOrder"
            :key="item"
            :class="{ active: currentStep === i }"
          ></span>
        </nav>
      </template>

      <Transition name="courier-scene" @after-leave="restoreSecretFocus">
        <BirdLetter v-if="secretLetterOpen" @close="secretLetterOpen = false" />
      </Transition>

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

      <Transition name="warp-exit" @after-leave="warpLeaving = false">
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
          <div class="warp-content">
            <img
              class="warp-character"
              :src="warpCharacterUrl"
              alt="小新陪你穿越生日星空"
              decoding="async"
            />
            <div class="warp-copy">
              <span>✦ &nbsp; A LITTLE UNIVERSE &nbsp; ✦</span
              ><strong>正在穿越<br />{{ birthdayName }}的生日宇宙</strong
              ><small>愿望已经出发</small>
            </div>
          </div>
          <div class="warp-progress" aria-hidden="true"><i></i></div>
        </div>
      </Transition>

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
            第 <span>{{ photoIndex + 1 }}</span> 张 · 共 {{ photos.length }} 张
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
