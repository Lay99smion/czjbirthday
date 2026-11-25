<script setup>
import { ref, useId } from "vue";
import { assetUrl } from "../assets";

defineProps({ disabled: Boolean });

const id = useId();
const dialog = ref(null);
const entry = ref(null);
const answerInput = ref(null);
const answer = ref("");
const feedback = ref("");
let composing = false;

function open() {
  dialog.value.showModal();
  answerInput.value?.focus({ preventScroll: true });
}

function reset() {
  answer.value = "";
  feedback.value = "";
  composing = false;
  entry.value?.focus({ preventScroll: true });
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
  <div class="secret-room-entry" @touchstart.stop @touchend.stop>
    <button
      ref="entry"
      class="room-entry-button"
      type="button"
      aria-haspopup="dialog"
      :disabled="disabled"
      @click="open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 21V7a7 7 0 0 1 14 0v14M3 21h18M12 11v4" />
        <circle cx="12" cy="10" r="1.2" />
      </svg>
      <span>小弟留了个彩蛋</span>
      <span class="room-entry-star" aria-hidden="true">✦</span>
    </button>

    <dialog
      ref="dialog"
      class="room-entry-dialog"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-intro`"
      @close="reset"
      @click.self="dialog.close()"
      @pointermove.stop
    >
      <button
        class="room-entry-close"
        type="button"
        aria-label="关闭彩蛋暗号框"
        @click="dialog.close()"
      >
        ×
      </button>
      <span class="room-entry-mark" aria-hidden="true">✦</span>
      <p class="room-entry-eyebrow">给大哥的专属暗号</p>
      <h2 :id="`${id}-title`">有个小房间，<br />一直为你亮着灯。</h2>
      <p :id="`${id}-intro`" class="room-entry-intro">
        答对这道只有你知道的小问题，就能进来坐坐。
      </p>
      <form @submit.prevent="unlock">
        <label :for="`${id}-answer`">你小弟的名字首字母缩写是？</label>
        <input
          :id="`${id}-answer`"
          ref="answerInput"
          v-model="answer"
          type="text"
          maxlength="12"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          :spellcheck="false"
          enterkeyhint="go"
          placeholder="输入你的答案"
          :aria-invalid="!!feedback"
          :aria-describedby="`${id}-feedback`"
          @input="feedback = ''"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @keydown.enter="
            ($event.isComposing || $event.keyCode === 229) &&
            $event.preventDefault()
          "
        />
        <p :id="`${id}-feedback`" class="room-entry-feedback" role="status">
          {{ feedback }}
        </p>
        <button
          class="room-entry-submit"
          type="submit"
          :disabled="!answer.trim()"
        >
          打开小房间
        </button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.secret-room-entry {
  width: fit-content;
  max-width: 100%;
  margin: 14px auto 0;
}
.room-entry-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid #dcc38e66;
  border-radius: 99px;
  background: linear-gradient(120deg, #e9cd941a, #e9cd9408);
  color: #efdab0;
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: 0.03em;
  white-space: nowrap;
  box-shadow: 0 0 22px #e6bf7010;
  transition:
    background 0.2s,
    border-color 0.2s;
}
.room-entry-button:hover {
  border-color: #edcf99;
  background: #e9cd9424;
}
.room-entry-button:disabled {
  opacity: 0.45;
  cursor: default;
}
.room-entry-button svg {
  width: 19px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.room-entry-star {
  color: #d8b77a;
  font-size: 12px;
}
.room-entry-dialog {
  position: fixed;
  inset: 0;
  width: min(390px, calc(100% - 36px));
  max-height: calc(100dvh - 36px);
  margin: auto;
  padding: 34px 26px 26px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid #dbc18a66;
  border-radius: 22px;
  background:
    radial-gradient(ellipse at 50% 0, #45415388, transparent 65%),
    linear-gradient(155deg, #222b44, #10182d);
  color: #f4e7ce;
  box-shadow: 0 24px 100px #0008;
  text-align: center;
  touch-action: pan-y;
}
.room-entry-dialog::backdrop {
  background: #040817c9;
  backdrop-filter: blur(9px);
}
.room-entry-dialog[open] {
  animation: roomEntryAppear 0.25s ease-out;
}
.room-entry-close {
  position: absolute;
  right: 8px;
  top: 8px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #b9c2d5;
  font-size: 26px;
}
.room-entry-mark {
  display: block;
  margin: 0 0 15px;
  color: #f4d697;
  font-size: 30px;
  text-shadow: 0 0 25px #efc67966;
}
.room-entry-dialog .room-entry-eyebrow {
  margin: 0;
  color: #d9be8c;
  font-size: 14px;
  line-height: 1.7;
  letter-spacing: 0.14em;
}
.secret-room-entry .room-entry-dialog h2 {
  margin: 14px 0;
  font:
    500 clamp(25px, 6.8vw, 30px)/1.6 "Noto Serif SC",
    "Songti SC",
    serif;
  letter-spacing: 0.03em;
}
.room-entry-dialog .room-entry-intro {
  margin: 0 0 25px;
  color: #b9c3d6;
  font-size: 14px;
  line-height: 1.9;
}
.room-entry-dialog form {
  text-align: left;
}
.room-entry-dialog label {
  display: block;
  font-size: 16px;
  line-height: 1.8;
  color: #f2e2c3;
}
.room-entry-hint {
  margin: 5px 0 14px;
  color: #aab6ce;
  font-size: 14px;
  line-height: 1.7;
}
.room-entry-dialog input {
  display: block;
  width: 100%;
  min-height: 50px;
  padding: 12px 15px;
  border: 1px solid #ddc99e66;
  border-radius: 10px;
  outline: none;
  background: #080e20a6;
  color: #fff0cf;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: 0.08em;
}
.room-entry-dialog input::placeholder {
  color: #8e9bb4;
  letter-spacing: 0.03em;
}
.room-entry-dialog input:focus {
  border-color: #f1d6a1;
  box-shadow: 0 0 0 3px #ead1a019;
}
.room-entry-dialog input[aria-invalid="true"] {
  border-color: #e3acaa;
}
.room-entry-dialog .room-entry-feedback {
  min-height: 24px;
  margin: 7px 0 13px;
  color: #e9bdb5;
  font-size: 14px;
  line-height: 1.7;
}
.room-entry-submit {
  width: 100%;
  min-height: 48px;
  padding: 10px 18px;
  border: 1px solid #f5e2b8;
  border-radius: 10px;
  background: linear-gradient(110deg, #e4c48c, #f1dbad);
  color: #27263a;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.room-entry-submit:disabled {
  opacity: 0.4;
  cursor: default;
}
.room-entry-button:focus-visible,
.room-entry-close:focus-visible,
.room-entry-submit:focus-visible {
  outline: 2px solid #f2d49b;
  outline-offset: 4px;
}
@keyframes roomEntryAppear {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-height: 650px) {
  .room-entry-dialog {
    padding-top: 23px;
  }
  .room-entry-mark {
    margin-bottom: 8px;
    font-size: 24px;
  }
  .secret-room-entry .room-entry-dialog h2 {
    margin: 8px 0;
    font-size: 25px;
  }
  .room-entry-dialog .room-entry-intro {
    margin-bottom: 18px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .room-entry-dialog[open] {
    animation: none;
  }
  .room-entry-button {
    transition: none;
  }
}
</style>
