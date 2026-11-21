<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { wishPosition } from "../wishBottleLayout";

const props = defineProps({
  wishes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});
const host = ref(null);
const root = ref(null);
const ready = ref(false);
const collecting = ref(false);
const revealing = ref(false);
const escapingId = ref(null);
const incomingId = ref(null);
const pickButton = ref(null);
const readingCard = ref(null);
const selectedId = ref(null);
const selectedWish = computed(() => props.wishes.find((wish) => wish.id === selectedId.value));
const selectedIndex = computed(() => props.wishes.findIndex((wish) => wish.id === selectedId.value));
const fallbackStars = computed(() => props.wishes.map((wish) => {
  const point = wishPosition(wish.id);
  return { ...wish, left: 50 + point.x * 38, top: 56 - point.y * 22, delay: `${-point.phase}s` };
}));
const escapingStar = computed(() => fallbackStars.value.find((wish) => wish.id === escapingId.value));
let scene = null;
let disposed = false;
let fallbackTimer = null;
let finishFallback = null;
let revealTimer = null;
let finishReveal = null;
let selectionVersion = 0;

async function selectWish(id) {
  if (collecting.value || revealing.value || disposed) return;
  const request = ++selectionVersion;
  revealing.value = true;
  selectedId.value = null;
  scene?.setSelected(null);
  escapingId.value = id;
  try {
    if (scene) await scene.reveal(id);
    else await new Promise((resolve) => {
      finishReveal = resolve;
      revealTimer = window.setTimeout(resolve, matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1700);
    });
  } catch {
    useFallback();
  } finally {
    finishReveal = null;
    revealTimer = null;
    revealing.value = false;
    escapingId.value = null;
    if (request === selectionVersion && !disposed && !collecting.value && props.wishes.some((wish) => wish.id === id)) {
      selectedId.value = id;
      scene?.setSelected(id);
      nextTick(() => readingCard.value?.focus({ preventScroll: true }));
    }
  }
}

function pickWish() {
  if (!props.wishes.length) return;
  const index = selectedIndex.value < 0
    ? Math.floor(Math.random() * props.wishes.length)
    : (selectedIndex.value + 1) % props.wishes.length;
  selectWish(props.wishes[index].id);
}

function closeWish() {
  selectedId.value = null;
  scene?.setSelected(null);
  pickButton.value?.focus({ preventScroll: true });
}

function useFallback() {
  ready.value = false;
  scene?.dispose();
  scene = null;
}

async function collect(id) {
  if (disposed) return;
  selectionVersion++;
  clearTimeout(revealTimer);
  finishReveal?.();
  collecting.value = true;
  incomingId.value = id;
  selectedId.value = null;
  scene?.setSelected(null);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.value?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  await nextTick();
  try {
    if (scene) {
      scene.setWishes(props.wishes);
      await scene.collect(id);
    } else {
      await new Promise((resolve) => {
        finishFallback = resolve;
        fallbackTimer = window.setTimeout(resolve, reduced ? 200 : 1800);
      });
    }
  } catch {
    useFallback();
  } finally {
    finishFallback = null;
    fallbackTimer = null;
    if (!disposed) {
      collecting.value = false;
      incomingId.value = null;
      scene?.setSelected(id);
    }
  }
}

watch(() => props.wishes, (wishes) => {
  scene?.setWishes(wishes);
  if (selectedId.value && !wishes.some((wish) => wish.id === selectedId.value)) selectedId.value = null;
});

onMounted(async () => {
  try {
    const { createWishBottleScene } = await import("../wishBottleScene");
    if (disposed) return;
    scene = createWishBottleScene(host.value, { onSelect: selectWish, onUnavailable: useFallback });
    scene.setWishes(props.wishes);
    ready.value = true;
  } catch {
    useFallback();
    host.value?.replaceChildren();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  scene?.dispose();
  clearTimeout(fallbackTimer);
  clearTimeout(revealTimer);
  finishFallback?.();
  finishReveal?.();
});

defineExpose({ collect });
</script>

<template>
  <section ref="root" class="wish-bottle" :class="{ 'is-collecting': collecting, 'is-revealing': revealing, 'has-selection': selectedWish }" aria-label="星光祝福收集瓶">
    <div class="bottle-stage">
      <div class="bottle-orbit bottle-orbit-one" aria-hidden="true"></div>
      <div class="bottle-orbit bottle-orbit-two" aria-hidden="true"></div>
      <span class="bottle-speck bottle-speck-one" aria-hidden="true">✧</span>
      <span class="bottle-speck bottle-speck-two" aria-hidden="true">✦</span>
      <div class="bottle-floor" aria-hidden="true"></div>
      <div ref="host" class="bottle-canvas" aria-hidden="true"></div>

      <div v-if="!ready" class="bottle-fallback">
        <svg viewBox="0 0 320 420" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="wish-bottle-glass" x1="65" y1="210" x2="255" y2="240" gradientUnits="userSpaceOnUse">
              <stop stop-color="#bbd8e5" stop-opacity=".18" />
              <stop offset=".3" stop-color="#9cb7d1" stop-opacity=".035" />
              <stop offset=".7" stop-color="#9cb7d1" stop-opacity=".055" />
              <stop offset="1" stop-color="#d7e9ed" stop-opacity=".2" />
            </linearGradient>
            <linearGradient id="wish-bottle-edge" x1="65" y1="65" x2="250" y2="370" gradientUnits="userSpaceOnUse">
              <stop stop-color="#d5e9ef" stop-opacity=".8" />
              <stop offset=".5" stop-color="#b0d0e1" stop-opacity=".2" />
              <stop offset="1" stop-color="#dfd4b7" stop-opacity=".6" />
            </linearGradient>
          </defs>
          <path d="M125 69L125 104C125 127 73 133 66 170C61 194 63 317 66 339C69 364 88 371 160 371C232 371 251 364 254 339C257 317 259 194 254 170C247 133 195 127 195 104L195 69Z" fill="url(#wish-bottle-glass)" stroke="url(#wish-bottle-edge)" stroke-width="1.5" />
          <ellipse cx="160" cy="68" rx="37" ry="9" fill="#16283a" stroke="#c3d8dd" stroke-opacity=".65" stroke-width="3" />
          <path d="M124 102Q160 111 196 102M125 106Q160 115 195 106" stroke="#d9be8b" stroke-opacity=".8" />
          <path d="M80 185Q74 251 80 323M241 186Q247 238 241 264" stroke="#d0e8ef" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" />
          <ellipse cx="160" cy="356" rx="82" ry="9" stroke="#d3dde3" stroke-opacity=".25" />
          <path d="M189 108Q219 121 218 166" stroke="#ceae79" />
          <g transform="rotate(9 218 176)">
            <rect x="201" y="157" width="35" height="47" rx="2" fill="#dfd1b3" />
            <text x="218.5" y="177" text-anchor="middle" fill="#806b48" font-size="13">✦</text>
            <text x="218.5" y="191" text-anchor="middle" fill="#806b48" font-size="5">FOR YOU</text>
          </g>
        </svg>
        <div class="bottle-fallback-stars">
          <button
            v-for="(wish, index) in fallbackStars"
            :key="wish.id"
            type="button"
            class="bottle-fallback-star"
            :class="{ incoming: (collecting && incomingId === wish.id) || escapingId === wish.id || selectedId === wish.id }"
            :style="{ left: `${wish.left}%`, top: `${wish.top}%`, animationDelay: wish.delay }"
            :aria-label="`阅读第 ${index + 1} 份祝福`"
            :disabled="collecting || revealing"
            @click="selectWish(wish.id)"
          >✦</button>
        </div>
        <span v-if="collecting" class="bottle-fallback-flight" aria-hidden="true">✦</span>
        <span v-if="revealing" class="bottle-fallback-escape" :style="{ '--star-x': `${escapingStar?.left || 50}%`, '--star-y': `${escapingStar?.top || 56}%` }" aria-hidden="true">✦</span>
      </div>

      <Transition name="bottle-notice">
        <span v-if="collecting || revealing" class="bottle-collect-notice" role="status">{{ collecting ? '一份心意，正在变成星光' : '一束星光，正向你飞来' }}</span>
      </Transition>

      <div class="bottle-reading-slot" aria-live="polite" aria-atomic="true">
        <Transition name="bottle-reading">
          <article v-if="selectedWish" ref="readingCard" class="bottle-reading" tabindex="-1" aria-label="瓶中的祝福" @keydown.esc.stop.prevent="closeWish">
            <div class="bottle-reading-top"><span>{{ selectedWish.is_pinned ? '第一份祝福 · 永久珍藏' : '瓶里的一束光' }}</span><button type="button" aria-label="收起这份祝福" @click="closeWish">×</button></div>
            <p>{{ selectedWish.content }}</p>
            <div class="bottle-reading-bottom">
              <span class="bottle-reading-sign">{{ selectedIndex + 1 }} / {{ wishes.length }} 份心意</span>
              <button type="button" class="bottle-reading-next" @click="pickWish">再读一份 <span aria-hidden="true">✧</span></button>
            </div>
          </article>
        </Transition>
      </div>
    </div>

    <div class="bottle-caption">
      <p class="bottle-count">{{ loading && !wishes.length ? '正在收集星光…' : `已珍藏 ${wishes.length} 份祝福` }}</p>
      <p class="bottle-hint">{{ wishes.length ? '轻点星光，让一份祝福飞向你' : '瓶子已经准备好，等第一份心意到来' }}</p>
      <button ref="pickButton" type="button" class="bottle-pick" :disabled="!wishes.length || collecting || revealing" @click="pickWish">
        <span aria-hidden="true">✧</span> {{ selectedWish ? '再读一份祝福' : '拾起一份祝福' }}
      </button>
    </div>

  </section>
</template>

<style scoped>
.wish-bottle{position:relative;min-width:0;scroll-margin-block:20px}
.bottle-stage{position:relative;height:440px;isolation:isolate}
.bottle-canvas{position:absolute;inset:0;z-index:2;touch-action:pan-y}.bottle-canvas:deep(canvas){display:block;width:100%;height:100%}
.bottle-floor{position:absolute;left:17%;right:17%;bottom:8px;height:58px;border-radius:50%;background:radial-gradient(ellipse,#e1bd7829 0%,#c7a16d0e 42%,transparent 72%);filter:blur(7px)}
.bottle-orbit{position:absolute;z-index:-1;left:50%;top:50%;border:1px solid #d4ba7f13;border-radius:50%;pointer-events:none}.bottle-orbit-one{width:91%;height:74%;transform:translate(-50%,-50%) rotate(-30deg)}.bottle-orbit-two{width:114%;height:43%;transform:translate(-50%,-40%) rotate(-30deg);border-style:dashed;border-color:#d4ba7f0d}
.bottle-speck{position:absolute;color:#dfc28f;text-shadow:0 0 18px #f6cd8f66;animation:bottleSpeck 5s ease-in-out infinite alternate}.bottle-speck-one{top:24%;left:12%;font-size:23px}.bottle-speck-two{top:55%;right:10%;font-size:13px;animation-delay:-2s}
.bottle-fallback{position:absolute;z-index:1;inset:0;width:320px;max-width:100%;margin:auto}.bottle-fallback svg{display:block;width:100%;height:100%}.bottle-fallback-stars{position:absolute;inset:0}
.bottle-fallback-star{position:absolute;display:grid;place-items:center;transform:translate(-50%,-50%);width:28px;height:28px;border:0;background:none;color:#ffe4a9;font-size:12px;text-shadow:0 0 5px #fff0ba,0 0 15px #f2c06ba8;animation:bottleStar 3.8s ease-in-out infinite alternate}.bottle-fallback-star.selected{color:#fffaf0;font-size:17px}.bottle-fallback-star:focus-visible{outline:1px solid #ffe4a9;border-radius:50%}
.bottle-fallback-star.incoming{visibility:hidden}.bottle-fallback-flight{position:absolute;left:50%;top:18%;color:#fff3d5;text-shadow:0 0 12px #ffe0a9,0 0 25px #ffcf88;font-size:24px;animation:bottleFlight 1.8s ease-in-out both}
.bottle-fallback-escape{position:absolute;z-index:3;color:#fff3d5;text-shadow:0 0 10px #ffe0a9,0 0 28px #ffcf88;font-size:28px;pointer-events:none;animation:bottleEscape 1.7s ease-in-out both}
.bottle-collect-notice{position:absolute;z-index:3;left:50%;top:3%;transform:translateX(-50%);padding:9px 15px;white-space:nowrap;border:1px solid #e6c98a40;border-radius:30px;background:#172239e6;color:#f2deb6;font-size:14px;box-shadow:0 0 24px #e9b66e14;pointer-events:none}
.bottle-caption{position:relative;z-index:3;text-align:center;margin-top:-4px}.bottle-count{margin:0;color:#ecd5a6;font:500 18px/1.6 'Songti SC','Noto Serif SC',serif;letter-spacing:.1em}.bottle-hint{margin:8px 0 16px;color:#9faec6;font-size:14px;line-height:1.7}.bottle-pick{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:9px 19px;border:1px solid #ddc38b55;border-radius:30px;background:#e7cb9310;color:#e9d5ae;font-size:14px;transition:background .2s,border-color .2s}.bottle-pick:hover{background:#e7cb9320;border-color:#ddc38b99}.bottle-pick:disabled{opacity:.45;cursor:default}.bottle-pick span{font-size:19px}.bottle-pick:focus-visible,.bottle-reading button:focus-visible{outline:2px solid #f4d59b;outline-offset:4px}
.bottle-reading-slot{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:none}.bottle-reading{position:relative;display:flex;flex-direction:column;width:100%;max-width:350px;max-height:100%;padding:21px 24px 19px;border:1px solid #e6ce9d80;border-radius:5px 19px 19px 19px;background:linear-gradient(135deg,#28364cf2,#15213af5);box-shadow:0 20px 60px #03091799,0 0 50px #dfbb6f1c;backdrop-filter:blur(16px);pointer-events:auto;outline:none}.bottle-reading:focus-visible{outline:1px solid #f4d59b;outline-offset:4px}.bottle-reading-top{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;color:#d6be90;font-size:14px}.bottle-reading-top button{display:grid;place-items:center;min-width:40px;min-height:40px;margin:-8px -10px -8px 0;border:0;background:none;color:#b8c2d2;font-size:25px}.bottle-reading>p{min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:21px 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#fff0d5;font:18px/1.95 'Songti SC','Noto Serif SC',serif;letter-spacing:.035em}.bottle-reading-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;padding-top:12px;border-top:1px solid #dac18a26}.bottle-reading-sign{color:#a6b4c7;font-size:12px;letter-spacing:.04em}.bottle-reading-next{display:inline-flex;align-items:center;gap:7px;min-height:40px;margin:-6px -7px -6px 0;padding:7px;border:0;background:none;color:#ead1a0;font-size:14px}.bottle-reading-next span{font-size:19px}.has-selection .bottle-caption .bottle-hint{color:#c6b68f}
.bottle-notice-enter-active,.bottle-notice-leave-active,.bottle-reading-enter-active,.bottle-reading-leave-active{transition:opacity .25s,translate .25s}.bottle-notice-enter-from,.bottle-notice-leave-to,.bottle-reading-enter-from,.bottle-reading-leave-to{opacity:0;translate:0 7px}
@keyframes bottleSpeck{to{opacity:.35;transform:translateY(-7px)}}@keyframes bottleStar{to{opacity:.55;text-shadow:0 0 5px #fff0ba,0 0 22px #f2c06b}}
@keyframes bottleFlight{0%{transform:translate(-115px,75px) scale(.9);opacity:0}15%{opacity:1}45%{transform:translate(-12px,-15px) scale(1.1)}65%{transform:translate(-12px,30px) scale(.6);opacity:1}100%{transform:translate(20px,170px) scale(.35);opacity:0}}
@keyframes bottleEscape{0%{left:var(--star-x);top:var(--star-y);transform:translate(-50%,-50%) scale(.5);opacity:1}42%{left:50%;top:15%;transform:translate(-50%,-50%) scale(.7)}64%{left:27%;top:8%;transform:translate(-50%,-50%) scale(1);opacity:1}100%{left:50%;top:48%;transform:translate(-50%,-50%) scale(1.8);opacity:0}}
@media(max-width:700px){.bottle-stage{height:380px;max-width:430px;margin:0 auto}.bottle-caption{margin-top:-8px}.bottle-fallback{width:290px}.bottle-reading-slot{padding:16px}.bottle-reading{max-width:320px;padding:20px 22px 17px}.bottle-reading>p{font-size:17px;line-height:1.9}.bottle-speck-one{left:8%}.bottle-speck-two{right:6%}}
@media(prefers-reduced-motion:reduce){.bottle-speck,.bottle-fallback-star,.bottle-fallback-flight,.bottle-fallback-escape{animation:none}.bottle-fallback-flight,.bottle-fallback-escape{display:none}.bottle-notice-enter-active,.bottle-notice-leave-active,.bottle-reading-enter-active,.bottle-reading-leave-active{transition:none}}
</style>
