<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { cakeIntroFrame } from "../cakeIntroMotion";
import { createCakeIntroFireworks } from "../cakeIntroFireworks";
import { createNightSkyLayers } from "../nightSky";

defineProps({ name: String, date: String });
const emit = defineEmits(["complete"]);
const canvas = ref(null);
const fireworksCanvas = ref(null);
const ready = ref(false);
const revealed = ref(false);
const fallback = ref(false);
const celebrating = ref(false);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const starLayers = createNightSkyLayers();
let effect = null;
let fireworks = null;
let disposed = false;
let finished = false;
let fallbackFrame = 0;
let fallbackElapsed = 0;
let previous = null;

function complete() {
  if (finished || disposed) return;
  finished = true;
  emit("complete");
}

function updateFireworks(state) {
  if (disposed) return;
  fireworks?.render(state.fireworksTime);
  if (state.fireworksTime >= 0 && !celebrating.value) celebrating.value = true;
}

function tickFallback(now) {
  if (disposed || document.hidden || finished) return;
  if (previous !== null) fallbackElapsed += Math.min((now - previous) / 1000, 0.08);
  previous = now;
  const state = cakeIntroFrame(fallbackElapsed, 1, reducedMotion);
  updateFireworks(state);
  if (state.reveal) revealed.value = true;
  if (state.complete) complete();
  else fallbackFrame = requestAnimationFrame(tickFallback);
}

function useFallback() {
  if (disposed || fallback.value) return;
  effect?.destroy();
  effect = null;
  fallback.value = true;
  ready.value = true;
  if (!document.hidden) fallbackFrame = requestAnimationFrame(tickFallback);
}

function visibility() {
  if (document.hidden) {
    effect?.pause();
    cancelAnimationFrame(fallbackFrame);
    fallbackFrame = 0;
    previous = null;
  } else if (fallback.value && !finished) {
    previous = null;
    fallbackFrame = requestAnimationFrame(tickFallback);
  } else effect?.resume();
}

onMounted(async () => {
  document.addEventListener("visibilitychange", visibility);
  fireworks = createCakeIntroFireworks(fireworksCanvas.value);
  try {
    const { createCakeIntroScene } = await import("../cakeIntroScene");
    if (disposed) return;
    effect = createCakeIntroScene(canvas.value, {
      reducedMotion,
      onReveal: () => { revealed.value = true; },
      onFrame: updateFireworks,
      onComplete: complete,
      onError: useFallback,
    });
    ready.value = true;
  } catch {
    useFallback();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  effect?.destroy();
  fireworks?.destroy();
  cancelAnimationFrame(fallbackFrame);
  document.removeEventListener("visibilitychange", visibility);
});
</script>

<template>
  <section class="cake-intro" :class="{ 'is-ready': ready, 'is-revealed': revealed, 'has-fallback': fallback }" aria-label="繁星夜空下的生日蛋糕开场，镜头缓缓拉远，冰蓝灯带逐段点亮，顶部星光亮起后背景绽放烟花" @touchstart.stop @touchend.stop>
    <div class="cake-intro-halo" aria-hidden="true"></div>
    <div class="cake-intro-starfield" aria-hidden="true"><i v-for="(layer, index) in starLayers" :key="index" :style="layer"></i></div>
    <canvas ref="fireworksCanvas" class="cake-intro-fireworks" aria-hidden="true"></canvas>
    <canvas ref="canvas" class="cake-intro-canvas" aria-hidden="true"></canvas>
    <div v-if="fallback" class="cake-intro-fallback" aria-hidden="true">
      <div class="intro-fallback-cake">
        <div v-for="n in 5" :key="n" class="intro-fallback-tier" :style="{ '--tier': n }">
          <span class="intro-fallback-candies"><b>✦</b><b>✧</b><b>✦</b></span>
          <span class="intro-fallback-sugar-beads"><i v-for="bead in 4" :key="bead"></i></span>
        </div>
        <svg class="intro-fallback-ribbon" viewBox="0 0 400 520" fill="none">
          <path d="M-12 448C430 520 441 358 202 382S-50 308 204 295S374 222 204 212S86 157 204 139S280 92 202 66" pathLength="1" />
        </svg>
        <div class="intro-fallback-star">✦</div>
        <div class="intro-fallback-plate"></div>
      </div>
    </div>
    <header class="cake-intro-heading" :aria-hidden="!revealed">
      <span>{{ date }} · A LIGHT FOR YOU</span>
      <h1>{{ name }}，生日快乐。</h1>
    </header>
    <div class="cake-intro-caption" aria-hidden="true">
      <span class="cake-intro-caption-line"></span>
      <p>{{ !ready ? '先点亮一束微光' : revealed ? '愿这一岁，所有美好都为你亮起。' : '一束一束，把祝福点亮。' }}</p>
    </div>
    <p class="cake-intro-sr" role="status">{{ celebrating ? '顶部星光已点亮，背景烟花正在绽放，随后进入生日信。' : revealed ? '蛋糕已完整展现，正在点亮顶部星光。' : '正在从蛋糕底部逐层点亮生日灯光。' }}</p>
  </section>
</template>

<style scoped>
.cake-intro{position:absolute;inset:0;z-index:20;overflow:hidden;background:radial-gradient(ellipse at 50% 55%,#081424 0,#030914 45%,#01040a 90%);color:#e4f3ff;isolation:isolate}
.cake-intro-halo{position:absolute;inset:0;z-index:-1;opacity:.2;background:radial-gradient(ellipse at 50% 65%,#245c9b20,transparent 58%);transition:opacity 8s}
.is-ready .cake-intro-halo{opacity:1}
.cake-intro-starfield{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.cake-intro-starfield i{position:absolute;top:0;left:0;display:block;width:var(--star-size);height:var(--star-size);border-radius:50%;background:transparent;box-shadow:var(--star-shadows);opacity:.85;animation:introStarsTwinkle var(--star-duration) var(--star-delay) ease-in-out infinite alternate;will-change:opacity}
.cake-intro-fireworks{position:absolute;inset:0;z-index:0;width:100%;height:100%;pointer-events:none}
.cake-intro-canvas{position:relative;z-index:1;display:block;width:100%;height:100%;opacity:0;transition:opacity 1.2s}
.is-ready .cake-intro-canvas{opacity:1}
.has-fallback .cake-intro-canvas{opacity:0}
.cake-intro-heading{position:absolute;z-index:2;top:max(9%,calc(env(safe-area-inset-top) + 25px));left:18px;right:18px;text-align:center;opacity:0;transform:translateY(9px);transition:opacity 1.6s,transform 1.6s;pointer-events:none}
.is-revealed .cake-intro-heading{opacity:1;transform:translateY(0)}
.cake-intro-heading>span{font:12px/1.8 Georgia,serif;color:#a8cce4;letter-spacing:.2em}
.cake-intro-heading h1{margin:14px 0 0;color:#e6f6ff;font:500 clamp(23px,5.8vw,34px)/1.6 'Noto Serif SC','Songti SC',serif;letter-spacing:.09em;text-shadow:0 0 24px #81cfff38}
.cake-intro-caption{position:absolute;z-index:2;bottom:max(9%,calc(env(safe-area-inset-bottom) + 28px));left:24px;right:24px;display:flex;flex-direction:column;align-items:center;gap:17px;pointer-events:none;text-align:center}
.cake-intro-caption-line{width:1px;height:32px;background:linear-gradient(transparent,#90c9ea70)}
.cake-intro-caption p{margin:0;color:#a8c9e1;font-size:14px;line-height:1.9;letter-spacing:.13em}
.cake-intro-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.cake-intro-fallback{position:absolute;inset:0;z-index:1;display:grid;place-items:center;perspective:900px}
.intro-fallback-cake{position:relative;width:min(80vw,410px);aspect-ratio:400/520;animation:fallbackPullback 12.2s cubic-bezier(.3,.08,.3,1) both}
.intro-fallback-tier{position:absolute;left:calc(4% + (var(--tier) - 1)*8%);right:calc(4% + (var(--tier) - 1)*8%);bottom:calc(9% + (var(--tier) - 1)*15.4%);height:18%;border:1px solid #e6f4fa70;border-radius:50%/16%;background:linear-gradient(90deg,#8cabbf,#f0f2ee 40%,#cedee6 78%,#9dbacd);filter:brightness(.23);box-shadow:inset 0 -8px 20px #33557530;animation:fallbackTierLight 2s calc(1.6s + (var(--tier) - 1)*1.8s) forwards}
.intro-fallback-tier:before{content:'';position:absolute;left:0;right:0;top:0;height:23%;border-radius:50%;background:linear-gradient(140deg,#faf9f1,#dce8ee);box-shadow:0 3px 8px #9ec6db30}
.intro-fallback-tier:after{content:'';position:absolute;left:0;right:0;bottom:8%;height:1px;background:#d8ba7e;border-radius:50%}
.intro-fallback-sugar-beads{position:absolute;left:9%;right:9%;top:67%;display:flex;justify-content:space-between}
.intro-fallback-sugar-beads i{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#edfaff,#8fc9da);box-shadow:0 1px 3px #33557544}
.intro-fallback-sugar-beads i:nth-child(2){background:radial-gradient(circle at 30% 25%,#fff0f6,#d5aac5)}
.intro-fallback-sugar-beads i:nth-child(3){background:radial-gradient(circle at 30% 25%,#fff6dc,#dbb675)}
.intro-fallback-sugar-beads i:nth-child(4){background:radial-gradient(circle at 30% 25%,#f0ebff,#b4a9d6)}
.intro-fallback-candies{position:absolute;left:15%;right:15%;top:41%;display:flex;align-items:center;justify-content:space-between;color:#efd3a2;text-shadow:0 1px 4px #07152888}
.intro-fallback-candies b{font-size:clamp(10px,3vw,19px);font-weight:400}
.intro-fallback-ribbon{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 4px #7de8ff) drop-shadow(0 0 14px #3685f0)}
.intro-fallback-ribbon path{stroke:#dcfbff;stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:fallbackRibbon 10.8s 1.2s ease-in-out forwards}
.intro-fallback-star{position:absolute;top:3%;left:50%;transform:translateX(-50%);color:#f4ffff;font-size:66px;line-height:1;text-shadow:0 0 14px #fff,0 0 35px #a4e8ff,0 0 80px #4c9dff;opacity:0;animation:fallbackStar 1.7s 11.2s forwards}
.intro-fallback-plate{position:absolute;left:0;right:0;bottom:5%;height:5%;z-index:-1;border-radius:50%;background:linear-gradient(#a0c8df,#223e61);box-shadow:0 20px 45px #63b6fa33}
@keyframes fallbackPullback{0%{transform:translateY(-20%) scale(3.4);transform-origin:50% 93%}100%{transform:translateY(2%) scale(1);transform-origin:50% 93%}}
@keyframes fallbackTierLight{to{filter:brightness(1)}}
@keyframes fallbackRibbon{to{stroke-dashoffset:0}}
@keyframes fallbackStar{to{opacity:1}}
@keyframes introStarsTwinkle{0%{opacity:.48}55%{opacity:.85}100%{opacity:1}}
@media(min-aspect-ratio:1/1){.cake-intro-heading{top:14%;left:6%;right:auto;width:28%;text-align:left}.cake-intro-caption{bottom:6%}}
@media(max-height:600px){.cake-intro-heading{top:6%}.cake-intro-heading h1{font-size:23px;margin-top:5px}.cake-intro-caption{bottom:5%;gap:8px}.cake-intro-caption-line{height:20px}.intro-fallback-cake{width:min(60vh,45vw)}}
@media(max-height:600px) and (min-aspect-ratio:1/1){.cake-intro-heading{top:14%}.cake-intro-caption{bottom:3%}}
:global(.page-hidden) .cake-intro-fallback *{animation-play-state:paused!important}
:global(.page-hidden) .cake-intro-starfield i{animation-play-state:paused!important}
@media(prefers-reduced-motion:reduce){.cake-intro-canvas,.cake-intro-heading,.cake-intro-halo{transition:none}.intro-fallback-cake{animation:none;transform:translateY(2%)}.intro-fallback-tier{animation:none;filter:brightness(1)}.intro-fallback-ribbon path{animation:none;stroke-dashoffset:0}.intro-fallback-star{animation:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.cake-intro-starfield i{animation:none;opacity:.85}}
</style>
