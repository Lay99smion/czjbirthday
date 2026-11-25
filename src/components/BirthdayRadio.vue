<script setup>
import { computed, ref } from "vue";
import { assetUrl } from "../assets";
import { radioBlessings } from "../radioBlessings";

defineProps({ homeHref: String });

const stationIndex = ref(0);
const station = computed(() => radioBlessings[stationIndex.value]);
const dialPosition = computed(
  () =>
    `${(stationIndex.value / Math.max(1, radioBlessings.length - 1)) * 100}%`,
);
const answer = ref("");
const feedback = ref("");
let composing = false;

function tuneNext() {
  stationIndex.value = (stationIndex.value + 1) % radioBlessings.length;
}

function unlock(event) {
  if (composing || event?.isComposing || !answer.value.trim()) return;
  if (answer.value.trim().toLowerCase() !== "yl") {
    feedback.value = "好像不太对，再想想小弟的名字？";
    return;
  }
  const url = new URL(assetUrl(""), window.location.href);
  url.searchParams.set("secret", "yl");
  window.location.assign(url.href);
}
</script>

<template>
  <main class="birthday-radio">
    <div class="radio-page-inner">
      <nav class="radio-page-nav" aria-label="生日电台导航">
        <a :href="homeHref"><span aria-hidden="true">☾</span> 返回生日夜空</a>
        <span class="radio-edition">01 · 10 生日特别节目</span>
      </nav>

      <header class="radio-heading">
        <span class="radio-eyebrow">A FREQUENCY JUST FOR YOU</span>
        <h1>小弟频道，<br /><em>为大哥开播。</em></h1>
      </header>

      <section class="radio-machine" aria-labelledby="radio-machine-title">
        <div class="radio-machine-top">
          <h2 id="radio-machine-title">小弟的生日电台</h2>
          <span class="radio-on-air"
            ><i aria-hidden="true"></i> 正在为你播送</span
          >
        </div>
        <div class="radio-console">
          <div class="radio-speaker" aria-hidden="true"><span>✦</span></div>
          <div class="radio-display">
            <span class="radio-display-label">当前频率</span>
            <div class="radio-frequency">
              <b>{{ station.frequency }}</b
              ><span>FM</span>
            </div>
            <div class="radio-signal" aria-hidden="true">
              <i
                v-for="n in 16"
                :key="n"
                :style="{
                  '--bar-height': `${10 + ((n * 7 + stationIndex * 11) % 29)}px`,
                }"
              ></i>
            </div>
          </div>
        </div>

        <div class="radio-tuner">
          <div class="radio-tuner-heading">
            <label for="birthday-radio-tuning">调一调，听听下一句</label>
            <span>{{ stationIndex + 1 }} / {{ radioBlessings.length }}</span>
          </div>
          <input
            id="birthday-radio-tuning"
            v-model.number="stationIndex"
            class="radio-range"
            type="range"
            min="0"
            :max="radioBlessings.length - 1"
            step="1"
            :aria-valuetext="`${station.frequency} FM，第 ${stationIndex + 1} 段祝福`"
            :style="{ '--dial-position': dialPosition }"
          />
          <div class="radio-ticks" aria-hidden="true">
            <span v-for="item in radioBlessings" :key="item.frequency">{{
              item.frequency
            }}</span>
          </div>
        </div>

        <div
          class="radio-message"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Transition name="radio-message" mode="out-in">
            <div :key="station.frequency">
              <span class="radio-message-label"
                >来自 {{ station.frequency }} FM 的祝福</span
              >
              <p v-if="station.content" class="radio-message-content">
                {{ station.content }}
              </p>
              <div v-else class="radio-message-pending">
                <span class="radio-pending-lines" aria-hidden="true"
                  ><i></i><i></i><i></i
                ></span>
                <p>第 {{ stationIndex + 1 }} 段祝福，稍后补上。</p>
              </div>
            </div>
          </Transition>
        </div>

        <div class="radio-machine-bottom">
          <span>每一个频率，都留了一句话给你。</span>
          <button
            type="button"
            :disabled="radioBlessings.length < 2"
            @click="tuneNext"
          >
            换个频率 <span aria-hidden="true">↻</span>
          </button>
        </div>
      </section>

      <section class="radio-secret" aria-labelledby="radio-secret-title">
        <div class="radio-secret-mark" aria-hidden="true">
          <svg viewBox="0 0 32 40">
            <path d="M7 37V12a9 9 0 0 1 18 0v25M4 37h24M16 19v6" />
            <circle cx="16" cy="18" r="1.5" />
          </svg>
        </div>
        <div class="radio-secret-copy">
          <span class="radio-eyebrow">还有一个专属彩蛋</span>
          <h2 id="radio-secret-title">最后一段信号，<br />需要你的暗号。</h2>
          <p>有个小房间，一直为你亮着灯。</p>
        </div>
        <form class="radio-secret-form" @submit.prevent="unlock">
          <label for="radio-secret-answer">你小弟的名字首字母缩写是？</label>
          <div class="radio-answer-row">
            <input
              id="radio-secret-answer"
              v-model="answer"
              type="text"
              maxlength="12"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              :spellcheck="false"
              enterkeyhint="go"
              placeholder="输入两个英文字母"
              :aria-invalid="!!feedback"
              aria-describedby="radio-secret-feedback"
              @input="feedback = ''"
              @compositionstart="composing = true"
              @compositionend="composing = false"
              @keydown.enter="
                ($event.isComposing || $event.keyCode === 229) &&
                $event.preventDefault()
              "
            />
            <button type="submit" :disabled="!answer.trim()">打开小房间</button>
          </div>
          <p
            id="radio-secret-feedback"
            class="radio-secret-feedback"
            role="status"
          >
            {{ feedback }}
          </p>
        </form>
      </section>

      <footer class="radio-page-footer">
        这条专线，小弟一直在线。<span aria-hidden="true">✦</span>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.birthday-radio {
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 24px max(28px, env(safe-area-inset-bottom));
  background:
    radial-gradient(ellipse at 15% 20%, #28345666, transparent 52%),
    radial-gradient(ellipse at 90% 65%, #6d4b4520, transparent 48%), #0c1325;
  color: #f2e8d4;
  touch-action: pan-y;
}
.radio-page-inner {
  width: min(100%, 820px);
  margin: 0 auto;
}
.radio-page-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: calc(25px + env(safe-area-inset-top)) 0 20px;
  border-bottom: 1px solid #dbbd8426;
  font-size: 14px;
}
.radio-page-nav a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: #e4cea4;
  text-decoration: none;
}
.radio-page-nav a span {
  font-size: 24px;
}
.radio-edition {
  color: #8f9eb5;
  text-align: right;
  font-size: 13px;
  letter-spacing: 0.06em;
}
.radio-heading {
  padding: 55px 0 38px;
  text-align: center;
}
.radio-eyebrow {
  color: #d0b584;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.18em;
}
.radio-heading h1 {
  margin: 18px 0;
  font:
    500 clamp(34px, 6vw, 52px)/1.5 "Noto Serif SC",
    "Songti SC",
    serif;
  letter-spacing: 0.06em;
}
.radio-heading h1 em {
  color: #efd39a;
  font-style: normal;
  text-shadow: 0 0 35px #ddbb6d26;
}
.radio-heading > p {
  margin: 0;
  color: #acb9ce;
  font-size: 16px;
  line-height: 2;
  letter-spacing: 0.04em;
}
.radio-machine {
  position: relative;
  padding: 25px 28px 22px;
  border: 1px solid #d6ba8466;
  border-radius: 24px;
  background: linear-gradient(145deg, #343c4a, #202a3b 55%, #192335);
  box-shadow:
    0 24px 60px #0004,
    inset 0 1px #ffe8b926;
}
.radio-machine-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.radio-machine-top h2 {
  margin: 0;
  color: #ecdbba;
  font:
    500 17px/1.5 "Songti SC",
    serif;
  letter-spacing: 0.12em;
}
.radio-on-air {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #abbbae;
  font-size: 12px;
  white-space: nowrap;
}
.radio-on-air i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c2d4ac;
  box-shadow: 0 0 9px #c5e2a860;
}
.radio-console {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 22px;
}
.radio-speaker {
  display: grid;
  place-items: center;
  border: 1px solid #0a101ccc;
  border-radius: 14px;
  background:
    radial-gradient(circle, #586171 1px, transparent 1.5px) 0 0/6px 6px,
    #141d2c;
  box-shadow: inset 0 2px 12px #0006;
}
.radio-speaker span {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid #bda3724d;
  border-radius: 50%;
  background: #1c2638;
  color: #cfb47e;
  font-size: 21px;
}
.radio-display {
  position: relative;
  overflow: hidden;
  min-height: 151px;
  padding: 20px 25px;
  border: 1px solid #aebcbe26;
  border-radius: 12px;
  background: linear-gradient(155deg, #0d1929, #172c35);
  box-shadow: inset 0 3px 20px #0006;
}
.radio-display:after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(transparent 0 3px, #9cb9b704 3px 4px);
}
.radio-display-label {
  display: block;
  color: #8ea6ab;
  font-size: 12px;
  letter-spacing: 0.15em;
}
.radio-frequency {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 8px;
  color: #e7d6a9;
}
.radio-frequency b {
  font:
    400 clamp(46px, 8vw, 64px)/1.1 "Courier New",
    monospace;
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 22px #d9dba329;
}
.radio-frequency > span {
  font:
    14px Georgia,
    serif;
  letter-spacing: 0.12em;
}
.radio-signal {
  position: absolute;
  right: 24px;
  bottom: 25px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
  opacity: 0.45;
}
.radio-signal i {
  width: 3px;
  height: var(--bar-height);
  border-radius: 2px;
  background: #c3d3aa;
  transition: height 0.3s;
}
.radio-tuner {
  margin: 27px 0 24px;
}
.radio-tuner-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: #e3d2b0;
}
.radio-tuner-heading > span {
  color: #9ba9bf;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.radio-range {
  display: block;
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 44px;
  margin: 10px 0 0;
  cursor: pointer;
  background: transparent;
  accent-color: #e8cb92;
}
.radio-range::-webkit-slider-runnable-track {
  height: 4px;
  border: 1px solid #a58b5e55;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    #d2b276 var(--dial-position),
    #0e1729 var(--dial-position)
  );
}
.radio-range::-moz-range-track {
  height: 4px;
  border: 1px solid #a58b5e55;
  border-radius: 4px;
  background: #0e1729;
}
.radio-range::-moz-range-progress {
  height: 4px;
  background: #d2b276;
}
.radio-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  margin-top: -11px;
  border: 2px solid #f4e1b9;
  border-radius: 50%;
  background: linear-gradient(135deg, #f0d9ab, #b99a65);
  box-shadow: 0 2px 8px #0005;
}
.radio-range::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border: 2px solid #f4e1b9;
  border-radius: 50%;
  background: #e3c58c;
  box-shadow: 0 2px 8px #0005;
}
.radio-ticks {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  color: #98a7bd;
  font:
    12px/1.6 "Courier New",
    monospace;
  font-variant-numeric: tabular-nums;
}
.radio-ticks span {
  text-align: center;
}
.radio-message {
  min-height: 190px;
  padding: 24px 26px;
  border: 1px solid #d5bd882e;
  border-radius: 12px;
  background: #0c1528a8;
  text-align: center;
}
.radio-message-label {
  color: #c9b387;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.radio-message-content {
  margin: 20px 0 0;
  color: #f3e5c9;
  font:
    18px/2 "Noto Serif SC",
    "Songti SC",
    serif;
  letter-spacing: 0.04em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.radio-message-pending p {
  margin: 15px 0 0;
  color: #94a4bd;
  font-size: 14px;
  line-height: 1.8;
}
.radio-pending-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  margin-top: 23px;
}
.radio-pending-lines i {
  display: block;
  width: min(75%, 260px);
  height: 1px;
  background: #d8c19624;
}
.radio-pending-lines i:nth-child(2) {
  width: min(88%, 320px);
}
.radio-pending-lines i:nth-child(3) {
  width: min(60%, 200px);
}
.radio-machine-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
}
.radio-machine-bottom > span {
  color: #99a8be;
  font-size: 13px;
  line-height: 1.8;
}
.radio-machine-bottom button {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 9px 16px;
  border: 1px solid #ccb17c6b;
  border-radius: 99px;
  background: #e7cc9212;
  color: #ecd5a8;
  font-size: 14px;
}
.radio-machine-bottom button:disabled {
  opacity: 0.4;
  cursor: default;
}
.radio-machine-bottom button span {
  font-size: 20px;
}
.radio-secret {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  column-gap: 20px;
  margin-top: 36px;
  padding: 32px;
  border: 1px solid #d7ba7e40;
  border-radius: 18px;
  background:
    radial-gradient(ellipse at 0 0, #e0b6650b, transparent 65%), #111c2e;
}
.radio-secret-mark {
  display: grid;
  place-items: center;
  align-self: start;
  width: 54px;
  height: 65px;
  border: 1px solid #d2b37a30;
  border-radius: 30px 30px 8px 8px;
  background: #e0c48c09;
}
.radio-secret-mark svg {
  width: 28px;
  height: 36px;
  fill: none;
  stroke: #d9be87;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.radio-secret-copy h2 {
  margin: 11px 0;
  color: #f1dfb9;
  font:
    500 clamp(24px, 4vw, 29px)/1.6 "Songti SC",
    "Noto Serif SC",
    serif;
  letter-spacing: 0.035em;
}
.radio-secret-copy > p {
  margin: 0;
  color: #a9b6cb;
  font-size: 14px;
  line-height: 1.8;
}
.radio-secret-form {
  grid-column: 2;
  margin-top: 27px;
}
.radio-secret-form label {
  display: block;
  margin-bottom: 12px;
  color: #e4d4b5;
  font-size: 16px;
  line-height: 1.8;
}
.radio-answer-row {
  display: flex;
  gap: 10px;
}
.radio-answer-row input {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 50px;
  padding: 12px 14px;
  border: 1px solid #d4bd8d66;
  border-radius: 9px;
  outline: none;
  background: #080e20a6;
  color: #fff0cf;
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: 0.06em;
}
.radio-answer-row input::placeholder {
  color: #8899b5;
  font-size: 14px;
}
.radio-answer-row input:focus {
  border-color: #edcf98;
  box-shadow: 0 0 0 3px #e9ca8c15;
}
.radio-answer-row input[aria-invalid="true"] {
  border-color: #ddaaa1;
}
.radio-answer-row button {
  flex-shrink: 0;
  min-height: 50px;
  padding: 12px 20px;
  border: 1px solid #f0d9aa;
  border-radius: 9px;
  background: linear-gradient(110deg, #dfbd82, #f0dbb1);
  color: #25263a;
  font-size: 14px;
  font-weight: 600;
}
.radio-answer-row button:disabled {
  opacity: 0.4;
  cursor: default;
}
.radio-secret-feedback {
  min-height: 24px;
  margin: 8px 0 0;
  color: #e7b7ae;
  font-size: 14px;
  line-height: 1.7;
}
.radio-page-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 0 8px;
  color: #8c9db8;
  font-size: 14px;
  line-height: 1.8;
  text-align: center;
}
.radio-page-footer span {
  color: #cfb176;
}
.radio-message-enter-active,
.radio-message-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.radio-message-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.radio-message-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.birthday-radio a:focus-visible,
.birthday-radio button:focus-visible,
.radio-range:focus-visible {
  outline: 2px solid #efcf94;
  outline-offset: 4px;
  border-radius: 5px;
}
@media (max-width: 600px) {
  .birthday-radio {
    padding-inline: 18px;
  }
  .radio-page-nav {
    gap: 10px;
    padding-top: calc(16px + env(safe-area-inset-top));
  }
  .radio-edition {
    font-size: 12px;
    max-width: 105px;
    line-height: 1.8;
  }
  .radio-heading {
    padding: 35px 0 30px;
  }
  .radio-heading h1 {
    font-size: 34px;
  }
  .radio-heading > p {
    font-size: 14px;
  }
  .radio-machine {
    padding: 20px 18px 17px;
    border-radius: 20px;
  }
  .radio-machine-top {
    gap: 8px;
    margin-bottom: 18px;
  }
  .radio-machine-top h2 {
    font-size: 16px;
    letter-spacing: 0.04em;
  }
  .radio-on-air {
    font-size: 11px;
    gap: 5px;
  }
  .radio-console {
    grid-template-columns: 55px minmax(0, 1fr);
    gap: 12px;
  }
  .radio-speaker {
    border-radius: 10px;
  }
  .radio-speaker span {
    width: 31px;
    height: 31px;
    font-size: 17px;
  }
  .radio-display {
    min-height: 131px;
    padding: 17px 16px;
  }
  .radio-frequency b {
    font-size: 49px;
  }
  .radio-frequency {
    gap: 9px;
  }
  .radio-signal {
    right: 14px;
    bottom: 17px;
    gap: 2px;
  }
  .radio-signal i {
    width: 2px;
  }
  .radio-message {
    min-height: 185px;
    padding: 23px 15px;
  }
  .radio-message-content {
    font-size: 16px;
  }
  .radio-machine-bottom {
    gap: 10px;
  }
  .radio-machine-bottom > span {
    max-width: 145px;
    font-size: 12px;
  }
  .radio-machine-bottom button {
    padding-inline: 13px;
    gap: 8px;
  }
  .radio-secret {
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 14px;
    margin-top: 24px;
    padding: 24px 20px 18px;
  }
  .radio-secret-mark {
    width: 40px;
    height: 54px;
  }
  .radio-secret-mark svg {
    width: 24px;
    height: 32px;
  }
  .radio-secret-copy h2 {
    font-size: 24px;
  }
  .radio-secret-form {
    grid-column: 1/-1;
    margin-top: 12px;
  }
  .radio-answer-row {
    flex-direction: column;
  }
  .radio-answer-row button {
    width: 100%;
    font-size: 16px;
  }
  .radio-page-footer {
    font-size: 13px;
  }
}
@media (max-width: 360px) {
  .radio-signal {
    display: none;
  }
  .radio-machine-top {
    align-items: flex-start;
    flex-direction: column;
  }
  .radio-frequency b {
    font-size: 44px;
  }
  .radio-frequency > span {
    font-size: 12px;
  }
  .radio-ticks {
    font-size: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .radio-message-enter-active,
  .radio-message-leave-active,
  .radio-signal i {
    transition: none;
  }
}
</style>
