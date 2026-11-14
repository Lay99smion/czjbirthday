<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { memories } from "../memories";

const props = defineProps({ paused: Boolean });
const emit = defineEmits(["complete"]);
const rail = ref(null);
const active = ref(0);
const dragging = ref(false);
const holding = ref(false);
const completed = ref(false);
const dissolving = ref(false);
const progress = ref(0);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TIER_DURATION = 2800;
const EXIT_DURATION = reducedMotion ? 320 : 3580;
const vortexTiers = [
  { y: 'clamp(-155px, -20dvh, -100px)', radius: 'min(44vw, 27dvh)', scale: 1.05 },
  { y: '-6px', radius: 'min(36vw, 23dvh)', scale: .88 },
  { y: 'clamp(90px, 18dvh, 145px)', radius: 'min(28vw, 18dvh)', scale: .74 },
].map((tier, level) => {
  const photos = memories.filter((_, i) => i % 3 === level);
  return {
    style: {
      '--tier-y': tier.y, '--tier-radius': tier.radius,
      '--tier-scale': tier.scale, '--tier-delay': `${level * 300}ms`,
    },
    photos: photos.map((photo, i) => ({
      ...photo,
      style: {
        '--angle': `${i * 360 / photos.length + level * 32}deg`,
        '--photo-delay': `${level * 300 + Math.min(i * 30, 120)}ms`,
        '--tilt': `${i % 2 ? 5 : -5}deg`,
      },
    })),
  };
});
const vortexFlow = Array.from({ length: 110 }, (_, i) => {
  const t = i / 109;
  const angle = t * Math.PI * 5;
  const radius = 280 * (1 - t);
  return `${300 + Math.cos(angle) * radius},${300 + Math.sin(angle) * radius}`;
}).join(' ');
let frame = 0, last = 0, phase = "hold", dwell = 0, resumeAt = 0, exitElapsed = 0;
let pointer = null, pointerX = 0, pointerScroll = 0;
const DWELL = 3400;

function cardWidth() {
  return rail.value?.querySelector(".film-frame")?.offsetWidth || 240;
}
function cardStep() { return cardWidth() + 36; }
function updateActive() {
  active.value = Math.max(0, Math.min(memories.length - 1, Math.round(rail.value.scrollLeft / cardStep())));
}
function finish() {
  if (completed.value || dissolving.value || props.paused) return;
  dissolving.value = true;
  exitElapsed = 0;
  last = 0;
}
function tick(now) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min(now - (last || now), 50);
  last = now;
  if (!rail.value || props.paused || document.hidden || completed.value) return;
  if (dissolving.value) {
    exitElapsed += dt;
    if (exitElapsed >= EXIT_DURATION) {
      completed.value = true;
      cancelAnimationFrame(frame);
      frame = 0;
      emit("complete");
    }
    return;
  }
  if (dragging.value || holding.value || now < resumeAt) return;
  if (reducedMotion) return;
  if (phase === "hold") {
    dwell += dt;
    progress.value = Math.min(1, dwell / DWELL);
    if (dwell >= DWELL) {
      if (active.value === memories.length - 1) return finish();
      phase = "move";
      dwell = 0;
      progress.value = 0;
    }
  } else {
    const target = (active.value + 1) * cardStep();
    rail.value.scrollLeft = Math.min(target, rail.value.scrollLeft + dt * .095);
    if (rail.value.scrollLeft >= target - 1) {
      active.value++;
      phase = "hold";
    }
  }
}
function settle() {
  if (!rail.value || dissolving.value || completed.value) return;
  updateActive();
  rail.value.scrollTo({ left: active.value * cardStep(), behavior: reducedMotion ? "instant" : "smooth" });
  phase = "hold";
  dwell = 0;
  progress.value = 0;
  resumeAt = performance.now() + 1200;
}
function pointerDown(event) {
  if (dissolving.value || completed.value || !event.isPrimary || event.button > 0) return;
  pointer = event.pointerId;
  pointerX = event.clientX;
  pointerScroll = rail.value.scrollLeft;
  dragging.value = true;
  rail.value.setPointerCapture(event.pointerId);
}
function pointerMove(event) {
  if (pointer !== event.pointerId) return;
  rail.value.scrollLeft = pointerScroll + pointerX - event.clientX;
  updateActive();
}
function pointerUp(event) {
  if (pointer !== event.pointerId) return;
  pointer = null;
  dragging.value = false;
  if (rail.value.hasPointerCapture(event.pointerId)) rail.value.releasePointerCapture(event.pointerId);
  settle();
}
function show(index) {
  if (dissolving.value || completed.value) return;
  active.value = Math.max(0, Math.min(memories.length - 1, index));
  rail.value.scrollTo({ left: active.value * cardStep(), behavior: reducedMotion ? "instant" : "smooth" });
  phase = "hold";
  dwell = 0;
  progress.value = 0;
  resumeAt = performance.now() + 1200;
}
watch(() => props.paused, () => { last = 0; });
function resetClock() { last = 0; }
onMounted(async () => {
  await nextTick();
  frame = requestAnimationFrame(tick);
  window.addEventListener("resize", settle);
  document.addEventListener("visibilitychange", resetClock);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener("resize", settle);
  document.removeEventListener("visibilitychange", resetClock);
});
</script>

<template>
  <div class="memory-content" :class="{ departing: dissolving }" :style="{ '--vortex-duration': `${EXIT_DURATION}ms`, '--tier-duration': `${TIER_DURATION}ms` }">
    <div class="memory-film-ui" :inert="dissolving" :aria-hidden="dissolving || undefined">
      <span class="section-kicker">LITTLE MOMENTS, FOREVER</span>
      <h2>把时光，<em>慢慢放映。</em></h2>
      <p class="memory-intro">那些闪闪发光的瞬间，都在这里。</p>
      <div ref="rail" class="film-rail" :class="{ dragging }" tabindex="0" role="region" aria-label="回忆照片胶片，可左右拖动或按方向键"
        @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerUp"
        @touchstart.stop @touchend.stop @keydown.left.prevent="show(active - 1)" @keydown.right.prevent="show(active + 1)">
        <div class="film-track">
          <figure v-for="(photo, i) in memories" :key="photo.src" class="film-frame" :class="{ current: i === active }">
            <div class="film-edge" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
            <div class="film-image"><img :src="photo.src" :alt="photo.alt" :loading="i === 0 ? 'eager' : 'lazy'" decoding="async" draggable="false" /><span>FRAME {{ String(i + 1).padStart(2, '0') }}</span></div>
            <div class="film-edge" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
          </figure>
        </div>
      </div>
      <div class="memory-note" aria-live="polite"><span>✦</span><Transition name="note" mode="out-in"><p :key="active">{{ memories[active].caption }}</p></Transition></div>
      <div class="film-controls">
        <button type="button" aria-label="上一张回忆" :disabled="active === 0" @click="show(active - 1)">‹</button>
        <span>{{ String(active + 1).padStart(2, '0') }} <i>/ {{ String(memories.length).padStart(2, '0') }}</i></span>
        <button type="button" :aria-label="holding ? '继续自动放映' : '暂停自动放映'" :aria-pressed="holding" @click="holding = !holding">{{ holding ? '▷' : 'Ⅱ' }}</button>
        <button type="button" aria-label="下一张回忆" :disabled="active === memories.length - 1" @click="show(active + 1)">›</button>
      </div>
      <div class="film-timer" aria-hidden="true"><i :style="{ transform: `scaleX(${progress})` }"></i></div>
      <p class="film-hint">{{ reducedMotion ? '左右拖动，慢慢翻看每一张' : '自动慢放中 · 也可以左右拖动' }}</p>
      <button v-if="reducedMotion && active === memories.length - 1" class="pill-button" type="button" @click="finish">拆开下一份惊喜 <span>↗</span></button>
    </div>
    <div v-if="dissolving && !reducedMotion" class="memory-vortex" :class="{ paused: props.paused }" aria-hidden="true">
      <div class="vortex-depth"></div>
      <div v-for="(tier, level) in vortexTiers" :key="level" class="vortex-tier" :style="tier.style">
        <svg class="vortex-current" viewBox="0 0 600 600"><polyline v-for="n in 3" :key="n" :points="vortexFlow" :transform="`rotate(${n * 120} 300 300)`" /></svg>
        <div v-for="photo in tier.photos" :key="photo.src" class="vortex-orbit" :style="photo.style">
          <figure class="vortex-photo"><img :src="photo.src" alt="" decoding="async" draggable="false" /></figure>
        </div>
      </div>
    </div>
    <span v-if="dissolving" class="sr-only" role="status">把每一帧回忆藏进心里，下一份惊喜正在靠近。</span>
  </div>
</template>
