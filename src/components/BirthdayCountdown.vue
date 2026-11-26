<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  birthdayCountdownConfig,
  countdownSnapshot,
  resolveCountdownDeadline,
} from "../birthdayCountdown";
import { createNightSkyLayers } from "../nightSky";

const props = defineProps({ name: String, deadline: Number });
const emit = defineEmits(["complete"]);
const deadline =
  props.deadline ?? resolveCountdownDeadline(birthdayCountdownConfig);
const now = ref(Date.now());
const remaining = computed(() => countdownSnapshot(deadline, now.value));
const starLayers = createNightSkyLayers();
const pad = (value) => String(value).padStart(2, "0");
const clockParts = computed(() => [
  { value: remaining.value.hours, label: "时" },
  { value: remaining.value.minutes, label: "分" },
  { value: remaining.value.secondPart, label: "秒" },
]);
const targetLabel = birthdayCountdownConfig.targetAt
  ? new Intl.DateTimeFormat("zh-CN", {
      timeZone: birthdayCountdownConfig.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(deadline)
  : "星光已就位，只等这一秒";
const announcement = computed(() =>
  remaining.value.complete
    ? "生日时刻已到，即将点亮生日蛋糕。"
    : remaining.value.finalSeconds
      ? "最后十秒，生日即将开始。"
      : "正在等待生日时刻。",
);
let timer = null;
let zeroTimer = null;
let finished = false;
let disposed = false;

function tick() {
  clearTimeout(timer);
  timer = null;
  if (disposed || finished || document.hidden) return;
  now.value = Date.now();
  const state = countdownSnapshot(deadline, now.value);
  if (state.complete) {
    if (zeroTimer === null)
      zeroTimer = setTimeout(() => {
        zeroTimer = null;
        if (disposed || finished || document.hidden) return;
        // Recheck the system clock in case it changed while zero was displayed.
        if (Date.now() < deadline) {
          tick();
          return;
        }
        finished = true;
        emit("complete");
      }, 600);
    return;
  }
  clearTimeout(zeroTimer);
  zeroTimer = null;
  timer = setTimeout(
    tick,
    Math.min(200, Math.max(20, (state.remainingMs % 1000) + 4)),
  );
}

function visibility() {
  clearTimeout(timer);
  clearTimeout(zeroTimer);
  timer = zeroTimer = null;
  if (!document.hidden) tick();
}

onMounted(() => {
  document.addEventListener("visibilitychange", visibility);
  tick();
});
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
  clearTimeout(zeroTimer);
  document.removeEventListener("visibilitychange", visibility);
});
</script>

<template>
  <section
    class="birthday-countdown"
    :class="{
      'is-final': remaining.finalSeconds,
      'has-arrived': remaining.complete,
    }"
    aria-label="生日倒计时"
    @touchstart.stop
    @touchend.stop
    @pointermove.stop
  >
    <div class="countdown-stars" aria-hidden="true">
      <i v-for="(layer, index) in starLayers" :key="index" :style="layer"></i>
    </div>
    <div class="countdown-nebula" aria-hidden="true"></div>

    <header class="countdown-heading">
      <span class="countdown-eyebrow">A MOMENT RESERVED FOR YOU</span>
      <p>生日倒计时</p>
    </header>

    <Transition name="countdown-phase" mode="out-in">
      <div
        v-if="!remaining.finalSeconds"
        key="waiting"
        class="countdown-waiting"
      >
        <h1>有一场惊喜，<br /><em>正在向你靠近。</em></h1>
        <div class="countdown-observatory">
          <svg class="countdown-dial" viewBox="0 0 400 400" aria-hidden="true">
            <circle cx="200" cy="200" r="189" class="dial-outer" />
            <circle cx="200" cy="200" r="172" class="dial-dashed" />
            <g
              v-for="n in 60"
              :key="n"
              :transform="`rotate(${n * 6} 200 200)`"
              :class="{ 'tick-major': n % 5 === 0 }"
            >
              <line x1="200" y1="34" x2="200" :y2="n % 5 === 0 ? 47 : 40" />
            </g>
            <circle
              cx="200"
              cy="200"
              r="151"
              class="dial-progress"
              pathLength="1"
              :style="{
                strokeDashoffset: 1 - (remaining.seconds % 60 || 60) / 60,
              }"
            />
            <ellipse
              cx="200"
              cy="200"
              rx="198"
              ry="75"
              class="dial-orbit"
              transform="rotate(-30 200 200)"
            />
            <circle cx="28.5" cy="299" r="3" class="dial-beacon" />
          </svg>
          <div class="countdown-readout" role="timer" aria-live="off">
            <span class="countdown-receiving">正在校准生日的坐标</span>
            <div v-if="remaining.days > 0" class="countdown-days">
              <b>{{ remaining.days }}</b
              ><span>天</span>
            </div>
            <div class="countdown-clock">
              <div
                v-for="part in clockParts"
                :key="part.label"
                class="countdown-clock-part"
              >
                <b>{{ pad(part.value) }}</b
                ><span>{{ part.label }}</span>
              </div>
            </div>
            <span class="countdown-readout-star" aria-hidden="true">✦</span>
          </div>
        </div>
        <p class="countdown-waiting-note">把最好的惊喜，留到这一秒。</p>
      </div>

      <div v-else key="final" class="countdown-finale">
        <p class="countdown-final-label">
          {{
            remaining.complete ? "这一刻，为你而来" : "最后十秒，生日即将亮起"
          }}
        </p>
        <div
          class="countdown-number-stage"
          role="timer"
          aria-live="off"
          :aria-label="`倒计时 ${remaining.seconds} 秒`"
        >
          <div class="countdown-final-ring" aria-hidden="true"></div>
          <div
            class="countdown-final-ring second-ring"
            aria-hidden="true"
          ></div>
          <Transition name="countdown-number" mode="out-in">
            <span
              :key="remaining.seconds"
              class="countdown-number"
              :data-number="remaining.seconds"
              aria-hidden="true"
              >{{ remaining.seconds }}</span
            >
          </Transition>
        </div>
        <div class="countdown-final-trail" aria-hidden="true">
          <i
            v-for="n in 10"
            :key="n"
            :class="{ lit: n > remaining.seconds }"
          ></i>
        </div>
        <p class="countdown-final-note">
          {{
            remaining.complete
              ? "愿所有美好，准时为你亮起。"
              : "整个夜空，正在等待你。"
          }}
        </p>
      </div>
    </Transition>

    <footer class="countdown-footer">
      <span aria-hidden="true">✦</span> {{ targetLabel }}
    </footer>
    <p class="countdown-sr" role="status">{{ announcement }}</p>
  </section>
</template>

<style scoped>
.birthday-countdown {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 85px 24px 75px;
  background: radial-gradient(
    ellipse at 50% 52%,
    #0d2036 0,
    #040b18 47%,
    #01040a 90%
  );
  color: #e4f3ff;
  text-align: center;
  isolation: isolate;
}
.countdown-stars {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.countdown-stars i {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: var(--star-size);
  height: var(--star-size);
  border-radius: 50%;
  background: transparent;
  box-shadow: var(--star-shadows);
  opacity: 0.85;
  animation: countdownStarTwinkle var(--star-duration) var(--star-delay)
    ease-in-out infinite alternate;
  will-change: opacity;
}
.countdown-nebula {
  position: absolute;
  z-index: -1;
  left: 50%;
  top: 48%;
  width: min(90vw, 600px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #4b8eae17, transparent 65%);
  filter: blur(20px);
  transition:
    opacity 1s,
    transform 1.2s;
}
.is-final .countdown-nebula {
  opacity: 0.65;
  transform: translate(-50%, -50%) scale(1.15);
}
.countdown-heading {
  position: absolute;
  top: max(7%, calc(env(safe-area-inset-top) + 24px));
  left: 18px;
  right: 18px;
  pointer-events: none;
}
.countdown-eyebrow {
  color: #8eaec7;
  font:
    11px/1.8 Georgia,
    serif;
  letter-spacing: 0.23em;
}
.countdown-heading > p {
  margin: 10px 0 0;
  color: #bbd0df;
  font-size: 14px;
  line-height: 1.8;
  letter-spacing: 0.12em;
}
.countdown-waiting {
  position: relative;
  width: 100%;
  max-width: 600px;
}
.countdown-waiting h1 {
  position: relative;
  z-index: 1;
  margin: 0 0 -7px;
  font:
    500 clamp(25px, 5.5vw, 35px)/1.65 "Noto Serif SC",
    "Songti SC",
    serif;
  letter-spacing: 0.08em;
}
.countdown-waiting h1 em {
  color: #c8e8fa;
  font-style: normal;
  text-shadow: 0 0 25px #89cafa26;
}
.countdown-observatory {
  position: relative;
  width: min(76vw, 350px);
  aspect-ratio: 1;
  margin: 0 auto;
}
.countdown-dial {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
}
.dial-outer {
  stroke: #8fb6cf24;
  stroke-width: 0.6;
}
.dial-dashed {
  stroke: #8fb6cf40;
  stroke-width: 0.7;
  stroke-dasharray: 1 8;
}
.countdown-dial g line {
  stroke: #8fb6cf5c;
  stroke-width: 1;
}
.countdown-dial .tick-major line {
  stroke: #b8d5e5a6;
  stroke-width: 1.3;
}
.dial-progress {
  stroke: #b8e6ff;
  stroke-width: 1.5;
  stroke-dasharray: 1;
  transform: rotate(-90deg);
  transform-origin: center;
  filter: drop-shadow(0 0 5px #72c6ed88);
  transition: stroke-dashoffset 0.35s linear;
}
.dial-orbit {
  stroke: #c8ad7c66;
  stroke-width: 0.8;
}
.dial-beacon {
  fill: #e3ca9b;
  filter: drop-shadow(0 0 5px #f0cf8db3);
}
.countdown-readout {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.countdown-receiving {
  color: #9fbacc;
  font-size: 12px;
  line-height: 1.8;
  letter-spacing: 0.08em;
}
.countdown-clock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}
.countdown-clock-part {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.countdown-clock-part:not(:last-child):after {
  content: ":";
  position: absolute;
  top: 0;
  right: -15px;
  color: #658298;
  font:
    300 34px/1.1 "DM Sans",
    sans-serif;
}
.countdown-clock-part b {
  font:
    300 clamp(31px, 8vw, 45px)/1.1 "DM Sans",
    sans-serif;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: #e2f4ff;
  text-shadow: 0 0 25px #b3e4ff24;
}
.countdown-clock-part > span {
  color: #8ca9bf;
  font-size: 12px;
  line-height: 1.5;
}
.countdown-readout-star {
  color: #ccb58b;
  font-size: 16px;
  line-height: 1;
  text-shadow: 0 0 15px #e6c69259;
}
.countdown-days {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-bottom: -8px;
  color: #e6d5b1;
}
.countdown-days b {
  font:
    300 33px/1.1 "DM Sans",
    sans-serif;
  font-variant-numeric: tabular-nums;
}
.countdown-days span {
  font-size: 13px;
}
.countdown-waiting-note {
  margin: 0;
  color: #91acc2;
  font-size: 14px;
  line-height: 1.9;
  letter-spacing: 0.08em;
}
.countdown-finale {
  position: relative;
  width: 100%;
  max-width: 700px;
}
.countdown-final-label {
  position: relative;
  z-index: 1;
  margin: 0 0 23px;
  color: #b7cfdf;
  font:
    16px/1.9 "Songti SC",
    serif;
  letter-spacing: 0.17em;
}
.countdown-number-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: clamp(230px, 42vh, 400px);
  isolation: isolate;
}
.countdown-number {
  position: relative;
  display: inline-block;
  grid-area: 1/1;
  min-width: 2ch;
  font:
    300 clamp(176px, 56vw, 420px)/0.95 "DM Sans",
    -apple-system,
    sans-serif;
  letter-spacing: -0.065em;
  font-variant-numeric: tabular-nums;
  color: #e7f7ff;
  text-shadow:
    0 0 28px #afdfff25,
    0 0 90px #4380b21a;
}
.countdown-number:before {
  content: attr(data-number);
  position: absolute;
  inset: 0;
  z-index: -1;
  color: transparent;
  -webkit-text-stroke: 1px #97c3df40;
  transform: translate(11px, 8px) scale(1.035);
  filter: blur(0.5px);
}
.countdown-final-ring {
  position: absolute;
  z-index: -1;
  width: min(83vw, 470px);
  aspect-ratio: 1;
  border: 1px solid #98c1d52b;
  border-radius: 50%;
  transform: rotate(-25deg) scaleY(0.7);
  box-shadow: 0 0 35px #5386ac08;
}
.countdown-final-ring:after {
  content: "";
  position: absolute;
  top: 14%;
  right: 14%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #e6d5b1;
  box-shadow: 0 0 12px #d8c49a80;
}
.countdown-final-ring.second-ring {
  width: min(94vw, 540px);
  transform: rotate(30deg) scaleY(0.7);
  border-color: #cdb58424;
}
.countdown-final-trail {
  display: flex;
  justify-content: center;
  gap: 11px;
  margin: 28px auto 22px;
}
.countdown-final-trail i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #56758c66;
  transition:
    background 0.4s,
    box-shadow 0.4s,
    transform 0.4s;
}
.countdown-final-trail i.lit {
  background: #e0eff6;
  box-shadow: 0 0 9px #b1e5ff;
  transform: scale(1.3);
}
.countdown-final-note {
  margin: 0;
  color: #8faec4;
  font-size: 14px;
  line-height: 1.9;
  letter-spacing: 0.12em;
}
.has-arrived .countdown-number {
  color: #fffaf0;
  text-shadow:
    0 0 30px #f8e2ae44,
    0 0 100px #b5dfff33;
}
.countdown-footer {
  position: absolute;
  bottom: max(6%, calc(env(safe-area-inset-bottom) + 20px));
  left: 18px;
  right: 18px;
  color: #748fa6;
  font-size: 12px;
  line-height: 1.8;
  letter-spacing: 0.06em;
}
.countdown-footer > span {
  color: #b29f80;
  margin-right: 7px;
}
.countdown-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.countdown-phase-enter-active,
.countdown-phase-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.countdown-phase-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.countdown-phase-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
.countdown-number-enter-active {
  transition:
    opacity 0.23s,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.3s;
}
.countdown-number-leave-active {
  transition:
    opacity 0.12s,
    transform 0.12s,
    filter 0.12s;
}
.countdown-number-enter-from {
  opacity: 0;
  transform: scale(0.85);
  filter: blur(5px);
}
.countdown-number-leave-to {
  opacity: 0;
  transform: scale(1.1);
  filter: blur(5px);
}
@keyframes countdownStarTwinkle {
  0% {
    opacity: 0.48;
  }
  55% {
    opacity: 0.85;
  }
  100% {
    opacity: 1;
  }
}
:global(.page-hidden) .countdown-stars i {
  animation-play-state: paused !important;
}
@media (max-width: 380px) {
  .countdown-clock {
    gap: 19px;
  }
  .countdown-clock-part:not(:last-child):after {
    right: -12px;
  }
  .countdown-receiving {
    font-size: 11px;
  }
  .countdown-readout {
    gap: 13px;
  }
  .countdown-final-label {
    font-size: 14px;
    letter-spacing: 0.1em;
  }
  .countdown-final-note {
    font-size: 13px;
  }
}
@media (max-height: 680px) {
  .birthday-countdown {
    padding-block: 72px 65px;
  }
  .countdown-heading {
    top: max(4%, calc(env(safe-area-inset-top) + 15px));
  }
  .countdown-waiting h1 {
    font-size: 24px;
    line-height: 1.6;
    margin-bottom: -4px;
  }
  .countdown-observatory {
    width: min(63vw, 260px);
  }
  .countdown-waiting-note {
    font-size: 13px;
  }
  .countdown-finale {
    transform: translateY(8px);
  }
  .countdown-final-label {
    margin-bottom: 12px;
  }
  .countdown-number-stage {
    height: clamp(205px, 39vh, 280px);
  }
  .countdown-number {
    font-size: clamp(160px, 48vw, 290px);
  }
  .countdown-final-trail {
    margin-top: 20px;
    margin-bottom: 15px;
  }
  .countdown-footer {
    bottom: max(4%, calc(env(safe-area-inset-bottom) + 15px));
  }
}
@media (max-height: 450px) {
  .countdown-heading {
    left: 5%;
    right: auto;
    top: 18%;
    max-width: 25%;
    text-align: left;
  }
  .countdown-eyebrow {
    font-size: 9px;
  }
  .countdown-heading > p {
    font-size: 12px;
  }
  .countdown-waiting h1 {
    font-size: 19px;
    line-height: 1.5;
  }
  .countdown-observatory {
    width: 190px;
  }
  .countdown-waiting-note {
    font-size: 11px;
  }
  .countdown-readout {
    gap: 10px;
  }
  .countdown-clock-part b {
    font-size: 25px;
  }
  .countdown-receiving {
    font-size: 10px;
  }
  .countdown-clock-part span {
    font-size: 10px;
  }
  .countdown-readout-star {
    font-size: 12px;
  }
  .countdown-final-label {
    font-size: 13px;
    margin-bottom: 0;
  }
  .countdown-number-stage {
    height: 175px;
  }
  .countdown-number {
    font-size: 180px;
  }
  .countdown-final-ring {
    width: 310px;
  }
  .countdown-final-ring.second-ring {
    width: 355px;
  }
  .countdown-final-trail {
    margin-block: 12px;
  }
  .countdown-final-note {
    font-size: 12px;
  }
  .countdown-footer {
    font-size: 10px;
    bottom: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .countdown-stars i {
    animation: none;
    opacity: 0.85;
  }
  .countdown-nebula,
  .dial-progress,
  .countdown-final-trail i,
  .countdown-phase-enter-active,
  .countdown-phase-leave-active,
  .countdown-number-enter-active,
  .countdown-number-leave-active {
    transition: none;
  }
  .countdown-number:before {
    filter: none;
  }
}
</style>
