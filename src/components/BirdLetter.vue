<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { secretLetter } from "../secretLetter";

const emit = defineEmits(["close"]);
const phase = ref("flying");
const closeButton = ref(null);
const messenger = ref(null);
const keepButton = ref(null);
const heading = computed(() => phase.value === "flying" ? "有一封信，正向你飞来。" : phase.value === "delivered" ? "嘘，小鸟带来了一点秘密。" : secretLetter.title);

async function arrive(event) {
  if (event.target !== event.currentTarget || event.animationName !== "birdArrival" || phase.value !== "flying") return;
  phase.value = "delivered";
  await nextTick();
  messenger.value?.focus({ preventScroll: true });
}
function openLetter() {
  if (phase.value !== "delivered") return;
  phase.value = "open";
  nextTick(() => keepButton.value?.focus({ preventScroll: true }));
}
function onKeydown(event) {
  if (event.key === "Escape") { event.preventDefault(); emit("close"); }
  if (event.key !== "Tab") return;
  event.preventDefault();
  const stops = [closeButton.value, phase.value === "delivered" ? messenger.value : phase.value === "open" ? keepButton.value : null].filter(Boolean);
  const index = stops.indexOf(document.activeElement);
  stops[(index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
}
onMounted(async () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) phase.value = "delivered";
  await nextTick();
  closeButton.value?.focus({ preventScroll: true });
});
</script>

<template>
  <div class="bird-letter-overlay" :class="`bird-phase-${phase}`" role="dialog" aria-modal="true" aria-labelledby="bird-letter-heading" @keydown="onKeydown" @touchstart.stop @touchend.stop>
    <button ref="closeButton" class="bird-letter-close" type="button" aria-label="收起小鸟的来信" @click="emit('close')">×</button>
    <div class="bird-letter-stars" aria-hidden="true"><i v-for="n in 12" :key="n" :style="{ '--i': n }">✦</i></div>
    <div class="bird-letter-content">
      <span class="section-kicker">A LITTLE SECRET, JUST FOR YOU</span>
      <h2 id="bird-letter-heading" aria-live="polite">{{ heading }}</h2>
      <Transition name="bird-note" mode="out-in">
        <div v-if="phase !== 'open'" key="messenger" class="bird-delivery">
          <button ref="messenger" class="bird-messenger" :class="{ landed: phase === 'delivered' }" type="button" :disabled="phase === 'flying'" aria-label="打开小鸟衔来的信封" @animationend="arrive" @click="openLetter">
            <svg class="courier-bird" viewBox="0 0 300 210" aria-hidden="true">
              <path class="bird-wing bird-wing-back" d="M153 115 Q116 70 66 60 Q83 108 126 133Z" fill="#b3bdcf" />
              <path d="M107 119 L52 100 L68 122 L43 135 L113 139Z" fill="#d8d5cf" />
              <path d="M92 118 Q123 81 175 96 Q186 68 211 73 Q235 75 236 95 Q234 113 213 117 Q183 150 139 145 Q112 142 92 118Z" fill="#fff0d7" />
              <path d="M107 127 Q153 150 198 122 Q173 152 137 145Z" fill="#ddc9b2" />
              <path class="bird-wing bird-wing-front" d="M163 120 Q109 97 108 34 Q151 51 180 106 Q176 119 163 120Z" fill="#f7e5c5" stroke="#d3bea1" stroke-width="1.2" />
              <path class="bird-wing bird-wing-front" d="M161 112 Q133 87 125 57 M169 109 Q151 82 145 69" fill="none" stroke="#d3bea1" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="220" cy="89" r="2.6" fill="#3c3440" /><circle cx="220.7" cy="88.2" r=".7" fill="#fff" />
              <path d="M235 91 L253 98 L235 103Z" fill="#d6aa68" />
              <path d="M249 98 Q255 109 246 124" fill="none" stroke="#d6bd90" stroke-width="1.4" />
              <g class="bird-carried-envelope">
                <rect x="210" y="122" width="66" height="44" rx="3" fill="#ecd4aa" stroke="#c7a271" />
                <path d="M211 164 L236 142 M275 164 L250 142 M211 123 L243 145 L275 123" fill="none" stroke="#c6a574" stroke-width="1.2" />
                <circle cx="243" cy="143" r="6" fill="#a96573" /><path d="M243 140 L244 142 L246 143 L244 144 L243 146 L242 144 L240 143 L242 142Z" fill="#f5dfb6" />
              </g>
            </svg>
          </button>
          <p class="bird-delivery-hint" role="status">{{ phase === 'flying' ? '它越过星光，来赴这一场约。' : '轻触信封，拆开这份小秘密 ↗' }}</p>
        </div>
        <article v-else key="letter" class="bird-secret-paper">
          <span class="bird-paper-mark" aria-hidden="true">✉</span>
          <p v-if="secretLetter.content" class="bird-secret-body">{{ secretLetter.content }}</p>
          <p v-else class="bird-secret-placeholder">{{ secretLetter.placeholder }}</p>
          <span class="bird-paper-sign">— 星光邮局 <span>♡</span></span>
          <button ref="keepButton" class="bird-keep-letter" type="button" @click="emit('close')">把这封信收好 <span>♡</span></button>
        </article>
      </Transition>
    </div>
  </div>
</template>
