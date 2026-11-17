<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { memories } from "../memories";

const props = defineProps({ paused: Boolean });
const emit = defineEmits(["complete", "departing"]);
const rail = ref(null);
const active = ref(0);
const dragging = ref(false);
const holding = ref(false);
const flipped = ref(null);
const playbackPaused = computed(() => holding.value || flipped.value !== null);
const completed = ref(false);
const dissolving = ref(false);
const progress = ref(0);
const photoStates = ref(memories.map(() => 'loading'));
const photoAttempts = ref(memories.map(() => 0));
const waitingNext = ref(false);
const filmHint = computed(() => {
  if (flipped.value !== null) return '已暂停 · 轻点照片，翻回正面';
  if (photoStates.value[active.value] === 'error') return '可以重试这张照片，或继续翻看其他回忆';
  if (photoStates.value[active.value] !== 'ready') return '正在准备这张回忆，稍等片刻…';
  if (waitingNext.value) return photoStates.value[active.value + 1] === 'error' ? '下一张回忆暂时没能抵达，可以手动翻页重试' : '正在准备下一张回忆…';
  return reducedMotion ? '轻点照片翻面 · 左右拖动翻页' : holding.value ? '已暂停 · 轻点照片翻面，左右拖动翻页' : '自动慢放中 · 轻点照片翻面';
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EXIT_DURATION = reducedMotion ? 320 : 2000;
let disposed = false;
let frame = 0, last = null, phase = "hold", dwell = 0, resumeAt = 0, exitElapsed = 0;
let pointer = null, pointerTarget = null, pointerX = 0, pointerScroll = 0;
let pointerMoved = false;
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
  if (dragging.value || playbackPaused.value || now < resumeAt) return;
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
  pointerMoved = false;
  dragging.value = true;
  // Keep capture on the tapped button so native clicks still flip it. Do not
  // transfer capture mid-swipe: touch devices would emit lostpointercapture.
  pointerTarget = event.target?.closest?.('.film-photo') || rail.value;
  pointerTarget.setPointerCapture(event.pointerId);
}
function pointerMove(event) {
  if (pointer !== event.pointerId) return;
  if (!pointerMoved) {
    if (Math.abs(event.clientX - pointerX) < 8) return;
    pointerMoved = true;
    flipped.value = null;
  }
  rail.value.scrollLeft = pointerScroll + pointerX - event.clientX;
  updateActive();
}
function pointerUp(event) {
  if (pointer !== event.pointerId) return;
  pointer = null;
  dragging.value = false;
  const target = pointerTarget;
  pointerTarget = null;
  if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  if (pointerMoved) settle();
}
function pointerCancel(event) {
  if (pointer !== event.pointerId) return;
  pointerMoved = true;
  pointerUp(event);
}
function togglePhoto(index, event) {
  if (dissolving.value || completed.value || props.paused || photoStates.value[index] !== 'ready') return;
  if (pointerMoved && event.detail !== 0) return;
  if (index !== active.value) return show(index);
  flipped.value = flipped.value === index ? null : index;
  rail.value.scrollTo({ left: active.value * cardStep(), behavior: reducedMotion ? 'instant' : 'smooth' });
  phase = 'hold';
  waitingNext.value = false;
  dwell = 0;
  progress.value = 0;
  last = null;
  resumeAt = performance.now() + 1200;
}
function togglePlayback() {
  if (flipped.value !== null) {
    flipped.value = null;
    holding.value = false;
    dwell = 0;
    progress.value = 0;
    last = null;
    resumeAt = performance.now() + 1200;
  } else holding.value = !holding.value;
}
function show(index) {
  if (dissolving.value || completed.value) return;
  flipped.value = null;
  active.value = Math.max(0, Math.min(memories.length - 1, index));
  rail.value.scrollTo({ left: active.value * cardStep(), behavior: reducedMotion ? "instant" : "smooth" });
  phase = "hold";
  waitingNext.value = false;
  dwell = 0;
  progress.value = 0;
  resumeAt = performance.now() + 1200;
}
watch(active, () => { flipped.value = null; });
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
        @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerCancel" @lostpointercapture="pointerCancel"
        @touchstart.stop @touchend.stop @keydown.left.prevent="show(active - 1)" @keydown.right.prevent="show(active + 1)">
        <div class="film-track">
          <figure v-for="(photo, i) in memories" :key="photo.src" class="film-frame" :class="{ current: i === active }">
            <div class="film-edge" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
            <div class="film-image" :aria-busy="photoStates[i] === 'loading'">
              <button class="film-photo" :class="{ flipped: flipped === i }" type="button" :disabled="photoStates[i] !== 'ready'" :tabindex="i === active ? 0 : -1" :aria-label="flipped === i ? `第 ${i + 1} 张照片背面：${photo.backNote || '有一句话，想慢慢写给你。'} 轻点翻回正面` : `第 ${i + 1} 张回忆照片，轻点查看背面的话`" :aria-pressed="flipped === i" @click="togglePhoto(i, $event)">
                <span class="film-flip">
                  <span class="film-face film-front" :aria-hidden="flipped === i">
                    <img :src="photoAttempts[i] ? `${photo.src}?retry=${photoAttempts[i]}` : photo.src" :alt="photo.alt" :class="{ ready: photoStates[i] === 'ready' }" loading="eager" :fetchpriority="i < 2 ? 'high' : 'low'" decoding="async" draggable="false" @load="photoLoaded(i, $event)" @error="photoFailed(i)" />
                    <span class="film-flip-prompt" aria-hidden="true">轻点翻面 ↻</span>
                    <span class="film-frame-number">FRAME {{ String(i + 1).padStart(2, '0') }}</span>
                  </span>
                  <span class="film-face film-back" :aria-hidden="flipped !== i">
                    <span class="film-back-kicker">BEHIND THIS MOMENT</span>
                    <span class="film-back-star" aria-hidden="true">✦</span>
                    <span class="film-back-note">{{ photo.backNote || '有一句话，想慢慢写给你。' }}</span>
                    <span class="film-back-return">轻点，回到这一刻 ↻</span>
                  </span>
                </span>
              </button>
              <div v-if="photoStates[i] !== 'ready'" class="film-photo-status">
                <span aria-hidden="true">✦</span>
                <p>{{ photoStates[i] === 'error' ? '这张回忆暂时没能抵达' : '正在准备这张回忆…' }}</p>
                <button v-if="photoStates[i] === 'error'" type="button" @pointerdown.stop @click.stop="retryPhoto(i)">重新加载</button>
              </div>
            </div>
            <div class="film-edge" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
          </figure>
        </div>
      </div>
      <div class="memory-note" aria-live="polite"><span>✦</span><Transition name="note" mode="out-in"><p :key="active">{{ memories[active].caption }}</p></Transition></div>
      <div class="film-controls">
        <button type="button" aria-label="上一张回忆" :disabled="active === 0" @click="show(active - 1)">‹</button>
        <span>{{ String(active + 1).padStart(2, '0') }} <i>/ {{ String(memories.length).padStart(2, '0') }}</i></span>
        <button type="button" :aria-label="playbackPaused ? '继续自动放映' : '暂停自动放映'" :aria-pressed="playbackPaused" @click="togglePlayback">{{ playbackPaused ? '▷' : 'Ⅱ' }}</button>
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

<style scoped>
.film-photo{position:relative;display:block;width:100%;aspect-ratio:3/4;padding:0;border:0;background:#10131c;color:inherit;perspective:900px;text-align:center;touch-action:none}
.film-photo:disabled{cursor:default}
.film-flip{position:absolute;inset:0;display:block;transform-style:preserve-3d;transition:transform .65s cubic-bezier(.2,.65,.3,1)}
.film-photo.flipped .film-flip{transform:rotateY(180deg)}
.film-face{position:absolute;inset:0;display:block;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.film-front{background:#10131c}
.film-frame-number{position:absolute;bottom:10px;right:9px;padding:4px 5px;color:#fff4d3;background:#090d20a6;letter-spacing:.12em;font:8px monospace}
.film-flip-prompt{position:absolute;left:9px;bottom:10px;padding:4px 7px;border:1px solid #eedab340;border-radius:99px;background:#090d20a6;color:#f1dfbf;font-family:inherit;font-size:10px;line-height:1.5;letter-spacing:.04em}
.film-back{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:22px 20px;background:radial-gradient(ellipse at 30% 20%,#fff6e5,#e9d9bd);color:#675047;transform:rotateY(180deg);box-shadow:inset 0 0 28px #a58b6133}
.film-back:before{content:'';position:absolute;inset:12px;border:1px solid #ad8c6347;pointer-events:none}
.film-back-kicker{color:#97785e;font:8px/1.8 Georgia,serif;letter-spacing:.16em}
.film-back-star{color:#a78355;font-size:19px}
.film-back-note{position:relative;max-width:100%;font:clamp(14px,4.3vw,18px)/1.95 'Songti SC',serif;letter-spacing:.04em;white-space:pre-wrap;overflow-wrap:anywhere}
.film-back-return{margin-top:3px;color:#92735e;font-size:10px;line-height:1.8;letter-spacing:.04em}
@media(max-height:640px){.film-back{gap:10px;padding:18px 15px}.film-back-kicker{font-size:7px;letter-spacing:.08em}.film-back-note{font-size:14px;line-height:1.8}.film-back-star{font-size:15px}.film-back-return{font-size:9px}.film-flip-prompt{font-size:9px;padding:3px 5px}.film-frame-number{font-size:7px;right:4px}}
@media(prefers-reduced-motion:reduce){.film-photo .film-flip,.film-photo.flipped .film-flip{transform:none;transition:none}.film-face{transform:none}.film-front{visibility:visible}.film-back{visibility:hidden}.film-photo.flipped .film-front{visibility:hidden}.film-photo.flipped .film-back{visibility:visible}}
</style>
