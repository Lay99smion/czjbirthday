<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { memories } from "../memories";

const props = defineProps({ paused: Boolean });
const emit = defineEmits(["complete", "departing"]);
const rail = ref(null);
const active = ref(0);
const dragging = ref(false);
const holding = ref(false);
const completed = ref(false);
const dissolving = ref(false);
const progress = ref(0);
const photoStates = ref(memories.map(() => 'loading'));
const photoAttempts = ref(memories.map(() => 0));
const waitingNext = ref(false);
const filmHint = computed(() => {
  if (photoStates.value[active.value] === 'error') return '可以重试这张照片，或继续翻看其他回忆';
  if (photoStates.value[active.value] !== 'ready') return '正在准备这张回忆，稍等片刻…';
  if (waitingNext.value) return photoStates.value[active.value + 1] === 'error' ? '下一张回忆暂时没能抵达，可以手动翻页重试' : '正在准备下一张回忆…';
  return reducedMotion ? '左右拖动，慢慢翻看每一张' : holding.value ? '已暂停 · 左右拖动也可以翻看' : '自动慢放中 · 也可以左右拖动';
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EXIT_DURATION = reducedMotion ? 320 : 2000;
let disposed = false;
let frame = 0, last = null, phase = "hold", dwell = 0, resumeAt = 0, exitElapsed = 0;
let pointer = null, pointerX = 0, pointerScroll = 0;
const DWELL = 3400;

async function photoLoaded(index, event) {
  const image = event.currentTarget;
  const attempt = photoAttempts.value[index];
  try {
    await image.decode?.();
  } catch {
    if (disposed || attempt !== photoAttempts.value[index]) return;
    if (!image.naturalWidth) return photoFailed(index);
  }
  if (disposed || attempt !== photoAttempts.value[index]) return;
  photoStates.value[index] = 'ready';
  if (index === active.value) {
    dwell = 0;
    progress.value = 0;
    last = null;
  }
}
function photoFailed(index) {
  if (!disposed) photoStates.value[index] = 'error';
}
function retryPhoto(index) {
  photoStates.value[index] = 'loading';
  photoAttempts.value[index]++;
}

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
  last = null;
  emit("departing", true);
}
function tick(now) {
  frame = requestAnimationFrame(tick);
  const elapsed = last === null ? 0 : Math.max(0, now - last);
  const dt = Math.min(elapsed, 50);
  last = now;
  if (!rail.value || props.paused || document.hidden || completed.value) return;
  if (dissolving.value) {
    exitElapsed += elapsed;
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
  if (photoStates.value[active.value] !== 'ready') return;
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
    waitingNext.value = photoStates.value[active.value + 1] !== 'ready';
    if (waitingNext.value) return;
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
  waitingNext.value = false;
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
  waitingNext.value = false;
  dwell = 0;
  progress.value = 0;
  resumeAt = performance.now() + 1200;
}
watch(() => props.paused, () => { last = null; });
function resetClock() { last = null; }
onMounted(async () => {
  await nextTick();
  if (disposed) return;
  frame = requestAnimationFrame(tick);
  window.addEventListener("resize", settle);
  document.addEventListener("visibilitychange", resetClock);
});
onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  if (dissolving.value) emit("departing", false);
  window.removeEventListener("resize", settle);
  document.removeEventListener("visibilitychange", resetClock);
});
</script>

<template>
  <div class="memory-content" :class="{ departing: dissolving, paused: props.paused }" :style="{ '--memory-exit-duration': `${EXIT_DURATION}ms` }">
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
            <div class="film-image" :aria-busy="photoStates[i] === 'loading'">
              <img :src="photoAttempts[i] ? `${photo.src}?retry=${photoAttempts[i]}` : photo.src" :alt="photo.alt" :class="{ ready: photoStates[i] === 'ready' }" loading="eager" :fetchpriority="i < 2 ? 'high' : 'low'" decoding="async" draggable="false" @load="photoLoaded(i, $event)" @error="photoFailed(i)" />
              <div v-if="photoStates[i] !== 'ready'" class="film-photo-status">
                <span aria-hidden="true">✦</span>
                <p>{{ photoStates[i] === 'error' ? '这张回忆暂时没能抵达' : '正在准备这张回忆…' }}</p>
                <button v-if="photoStates[i] === 'error'" type="button" @pointerdown.stop @click.stop="retryPhoto(i)">重新加载</button>
              </div>
              <span>FRAME {{ String(i + 1).padStart(2, '0') }}</span>
            </div>
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
      <p class="film-hint" role="status">{{ filmHint }}</p>
      <button v-if="reducedMotion && active === memories.length - 1" class="pill-button" type="button" @click="finish">拆开下一份惊喜 <span>↗</span></button>
    </div>
    <div v-if="dissolving && !reducedMotion" class="memory-exit" aria-hidden="true">
      <i class="memory-exit-glow"></i>
      <i class="memory-exit-line"></i>
      <span class="memory-exit-star">✦</span>
    </div>
    <span v-if="dissolving" class="sr-only" role="status">把每一帧回忆藏进心里，下一份惊喜正在靠近。</span>
  </div>
</template>
