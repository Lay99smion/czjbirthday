<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
const props = defineProps({ name: String, date: String });
const emit = defineEmits(["ready", "sound", "next"]);
const layer = ref(0);
const opening = ref(false);
const dragging = ref(false);
const dragOffset = ref(0);
const dragProgress = ref(0);
const magicParticles = ref([]);
const trailPoints = ref([]);
const trailPath = computed(() => trailPoints.value.map(point => `${point.x},${point.y}`).join(" "));
const SWIPE_DISTANCE = 76;
const typedText = ref("");
const letter = computed(
  () =>
    `亲爱的${props.name}：\n\n愿今天的风轻一点，星光亮一点；\n愿每一个平凡的日子，都藏着让你微笑的惊喜。\n\n新的一岁，继续勇敢地喜欢这个世界，\n也记得好好喜欢自己。\n\n生日快乐。今晚，所有的星星都为你闪耀。`,
);
const prompt = computed(
  () => ["按住盒盖，向上滑动", "按住丝带，向下滑动", "轻点碎纸，拆开贺卡"][layer.value],
);
const gesturePrompt = computed(() => {
  if (opening.value) return "魔法正在发生…";
  if (dragProgress.value >= 1) return "松开，收下一点惊喜";
  return prompt.value;
});
const foil = Array.from({ length: 25 }, (_, i) => ({
  "--x": `${Math.random() * 100}%`,
  "--delay": `${-Math.random() * 9}s`,
  "--duration": `${5 + Math.random() * 6}s`,
  "--drift": `${-50 + Math.random() * 100}px`,
  "--spin": `${-400 + Math.random() * 800}deg`,
  "--size": `${3 + Math.random() * 5}px`,
  "--color": i % 3 === 0 ? "#c997ac" : "#e8cb87",
}));
let layerTimer,
  typingFrame = 0,
  typingElapsed = 0,
  lastTypingTime = null;
let dragPointer = null, dragStartX = 0, dragStartY = 0, dragTarget = null;
let particleId = 0, lastSparkAt = -Infinity;
function pointInBox(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}
function sprinkle(point, burst = false) {
  const now = performance.now();
  if (!burst && now - lastSparkAt < 24) return;
  lastSparkAt = now;
  const sparks = Array.from({ length: burst ? 22 : 3 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const reach = burst ? 30 + Math.random() * 65 : 12 + Math.random() * 24;
    return { id: ++particleId, glyph: i % 3 === 0 ? "✦" : "·", style: {
      left: `${point.x}px`, top: `${point.y}px`,
      "--dx": `${Math.cos(angle) * reach}px`, "--dy": `${Math.sin(angle) * reach - 18}px`,
      "--spin": `${Math.random() * 180 - 90}deg`, "--life": `${.55 + Math.random() * .4}s`,
      "--size": `${5 + Math.random() * 9}px`, "--tint": layer.value === 1 && i % 2 ? "#d6ccff" : "#ffedb9",
    } };
  });
  magicParticles.value = [...magicParticles.value, ...sparks].slice(-66);
}
function removeSpark(id, event) {
  if (event.animationName === "giftSpark") magicParticles.value = magicParticles.value.filter(spark => spark.id !== id);
}
function releasePointer() {
  const pointer = dragPointer;
  const target = dragTarget;
  dragPointer = null;
  dragTarget = null;
  dragging.value = false;
  dragOffset.value = 0;
  dragProgress.value = 0;
  if (pointer !== null && target?.hasPointerCapture(pointer)) target.releasePointerCapture(pointer);
}
function onGiftPointerDown(event) {
  if (opening.value || layer.value > 1 || dragPointer !== null || !event.isPrimary || event.button > 0) return;
  event.preventDefault();
  dragPointer = event.pointerId;
  dragTarget = event.currentTarget;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragging.value = true;
  trailPoints.value = [pointInBox(event)];
  dragTarget.setPointerCapture(event.pointerId);
}
function onGiftPointerMove(event) {
  if (dragPointer !== event.pointerId) return;
  const dx = event.clientX - dragStartX;
  const dy = event.clientY - dragStartY;
  const direction = layer.value === 0 ? -1 : 1;
  const directed = Math.abs(dy) >= Math.abs(dx) ? dy * direction : 0;
  dragOffset.value = direction * Math.max(-10, Math.min(120, directed));
  dragProgress.value = Math.max(0, Math.min(1, directed / SWIPE_DISTANCE));
  const point = pointInBox(event);
  trailPoints.value = [...trailPoints.value, point].slice(-14);
  sprinkle(point);
}
function onGiftPointerUp(event) {
  if (dragPointer !== event.pointerId) return;
  // Include the release coordinates, even if the last move event was coalesced.
  onGiftPointerMove(event);
  const unlocked = dragProgress.value >= 1;
  const point = pointInBox(event);
  releasePointer();
  if (unlocked) openLayer(point);
}
function cancelGiftDrag(event) {
  if (dragPointer === event.pointerId) releasePointer();
}
function onGiftClick(event) {
  // Native keyboard and assistive clicks use detail=0; pointer taps open layer 3.
  if (layer.value !== 2 && event.detail !== 0) return;
  const point = event.detail === 0 ? { x: 130, y: 100 } : pointInBox(event);
  openLayer(point);
}
function onGiftKeydown(event) {
  if ((layer.value === 0 && event.key === "ArrowUp") || (layer.value === 1 && event.key === "ArrowDown")) {
    event.preventDefault();
    openLayer();
  }
}
function startTyping() {
  cancelAnimationFrame(typingFrame);
  lastTypingTime = null;
  const tick = (time) => {
    if (document.hidden) {
      typingFrame = 0;
      return;
    }
    if (lastTypingTime !== null)
      typingElapsed += Math.min(80, Math.max(0, time - lastTypingTime));
    lastTypingTime = time;
    typedText.value = letter.value.slice(0, Math.floor(typingElapsed / 42));
    if (typedText.value.length < letter.value.length)
      typingFrame = requestAnimationFrame(tick);
    else typingFrame = 0;
  };
  typingFrame = requestAnimationFrame(tick);
}
function onVisibility() {
  if (document.hidden) releasePointer();
  if (
    !document.hidden &&
    layer.value === 3 &&
    typedText.value.length < letter.value.length
  )
    startTyping();
}
function openLayer(point = { x: 130, y: 100 }) {
  if (opening.value || layer.value > 2) return;
  sprinkle(point, true);
  opening.value = true;
  emit("sound", ["lid", "ribbon", "paper"][layer.value]);
  layerTimer = setTimeout(() => {
    layer.value++;
    opening.value = false;
    magicParticles.value = [];
    trailPoints.value = [];
    if (layer.value === 3) {
      emit("ready");
      startTyping();
    }
  }, 650);
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() => {
  releasePointer();
  clearTimeout(layerTimer);
  cancelAnimationFrame(typingFrame);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div class="falling-foil" aria-hidden="true">
    <i v-for="(style, i) in foil" :key="i" :style="style"></i>
  </div>
  <div class="letter-balloons parallax-mid" aria-hidden="true">
    <i></i><i></i><i></i>
  </div>
  <div class="stage-content letter-content">
    <span class="section-kicker">A LETTER JUST FOR YOU</span>
    <h2>
      写给<span>{{ name }}</span>
    </h2>
    <div class="gift-area parallax-front" @touchstart.stop @touchend.stop>
      <Transition name="gift-layer" mode="out-in">
        <div
          v-if="layer < 3"
          :key="layer"
          class="gift-scene"
          :class="[`gift-layer-${layer}`, { opening, dragging }]"
          :style="{ '--gift-drag': `${dragOffset}px`, '--gift-charge': dragProgress }"
        >
          <span class="gift-count">{{
            ["01 · 一份礼物", "02 · 一缕温柔", "03 · 一点心意"][layer]
          }}</span>
          <button
            class="gift-box"
            type="button"
            :aria-label="prompt"
            :disabled="opening"
            @pointerdown.stop="onGiftPointerDown"
            @pointermove.stop="onGiftPointerMove"
            @pointerup.stop="onGiftPointerUp"
            @pointercancel.stop="cancelGiftDrag"
            @lostpointercapture="cancelGiftDrag"
            @keydown="onGiftKeydown"
            @click="onGiftClick"
            @contextmenu.prevent
            @dragstart.prevent
          >
            <span class="gift-magic-aura" aria-hidden="true"></span>
            <span class="gift-shadow"></span><span class="gift-base"></span>
            <span v-if="layer === 0" class="gift-lid"><i>✦</i></span>
            <span v-if="layer === 1" class="gift-ribbon"
              ><i></i><i></i><b>♡</b></span
            >
            <span v-if="layer === 2" class="gift-tissue"
              ><i></i><i></i><i></i><b>✉</b></span
            >
            <svg class="gift-magic-stroke" viewBox="0 0 260 220" aria-hidden="true"><polyline :points="trailPath" /></svg>
            <span class="gift-magic-trail" aria-hidden="true"><i v-for="spark in magicParticles" :key="spark.id" :style="spark.style" @animationend="removeSpark(spark.id, $event)">{{ spark.glyph }}</i></span>
          </button>
          <p class="gift-prompt">
            <span class="gift-gesture-arrow" :class="{ down: layer === 1 }" aria-hidden="true">{{ layer === 0 ? '↑' : layer === 1 ? '↓' : '✦' }}</span>{{ gesturePrompt }}
          </p>
          <div class="gift-swipe-progress" :class="{ charged: dragProgress >= 1 }" aria-hidden="true"><i :style="{ transform: `scaleX(${opening ? 1 : dragProgress})` }"></i></div>
          <small>还有一点点惊喜，藏在里面。</small>
        </div>
        <article
          v-else
          class="letter-paper"
          :aria-label="`写给${name}的生日贺卡`"
        >
          <div class="letter-paper-top">
            <span class="letter-date">{{ date }}</span
            ><span>DEAR {{ name }}</span
            ><span>✦</span>
          </div>
          <p class="typewriter">
            {{ typedText
            }}<span
              v-if="typedText.length < letter.length"
              class="cursor"
              aria-hidden="true"
              >▍</span
            >
          </p>
          <div class="paper-sign">— 来自这片星空 <span>♡</span></div>
        </article>
      </Transition>
    </div>
    <template v-if="layer === 3">
      <button
        class="pill-button letter-next"
        type="button"
        @click="$emit('next')"
      >
        拼出一份惊喜 <span>↗</span>
      </button>
      <p class="swipe-small">把这份祝福收好，继续向前 ↑</p>
    </template>
  </div>
</template>
