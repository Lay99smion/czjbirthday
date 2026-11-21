<script setup>
import { nextTick, ref } from "vue";
import { secretLetter } from "../secretLetter";

const emit = defineEmits(["secret"]);
const expanded = ref(false);
const passphrase = ref("");
const feedback = ref("");
const signature = ref(null);
const phraseInput = ref(null);
let composing = false;

async function toggle() {
  if (expanded.value) {
    close();
    return;
  }
  expanded.value = true;
  await nextTick();
  phraseInput.value?.focus();
}

function close() {
  expanded.value = false;
  passphrase.value = "";
  feedback.value = "";
  composing = false;
  signature.value?.focus({ preventScroll: true });
}

function unlock(event) {
  if (composing || event?.isComposing) return;
  const text = passphrase.value.trim();
  if (!text) return;
  if (text !== secretLetter.keyword) {
    feedback.value = "这封信，还在等它的暗号。";
    return;
  }
  phraseInput.value?.blur();
  expanded.value = false;
  passphrase.value = "";
  feedback.value = "";
  emit("secret", signature.value);
}
</script>

<template>
  <div class="secret-note" @touchstart.stop @touchend.stop>
    <button
      ref="signature"
      class="secret-signature"
      type="button"
      :aria-expanded="expanded"
      aria-controls="secret-note-form"
      :aria-label="expanded ? '收起来信暗号框' : '展开来信暗号框'"
      @click="toggle"
    >
      <svg class="secret-envelope" viewBox="0 0 96 80" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="secret-envelope-paper" x2=".8" y2="1">
            <stop stop-color="#fff4d4" />
            <stop offset="1" stop-color="#d9b875" />
          </linearGradient>
        </defs>
        <circle class="secret-envelope-aura" cx="48" cy="40" r="25" fill="currentColor" />
        <g class="secret-envelope-rays" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path
            v-for="ray in 8"
            :key="ray"
            d="M48 13V5"
            pathLength="1"
            :transform="`rotate(${(ray - 1) * 45} 48 40)`"
            :style="{ animationDelay: `${(ray - 1) * -.18}s` }"
          />
        </g>
        <g class="secret-envelope-paper">
          <rect x="25" y="25" width="46" height="31" rx="3" fill="url(#secret-envelope-paper)" stroke="#fff0c4" stroke-width="1.2" />
          <path d="M26 55L42 40M70 55L54 40M26 26L48 43L70 26" fill="none" stroke="#a88045" stroke-width="1.2" stroke-linejoin="round" />
          <path class="secret-envelope-seal" d="M48 38L53 43L48 48L43 43Z" fill="#fff8e4" stroke="#caa15d" stroke-width=".8" />
        </g>
        <g class="secret-envelope-sparkles" fill="#fff5d4">
          <path d="M18 12L20 18L26 20L20 22L18 28L16 22L10 20L16 18Z" />
          <path d="M78 50L79.5 54.5L84 56L79.5 57.5L78 62L76.5 57.5L72 56L76.5 54.5Z" />
          <path d="M76 13L77 16L80 17L77 18L76 21L75 18L72 17L75 16Z" />
        </g>
      </svg>
    </button>
    <Transition name="secret-unfold">
      <form
        v-if="expanded"
        id="secret-note-form"
        class="secret-note-form"
        @submit.prevent="unlock"
        @keydown.esc.stop.prevent="close"
      >
        <div class="secret-note-heading">
          <label for="secret-passphrase">有一个名字，能让这封信抵达。</label>
          <button class="secret-note-close" type="button" aria-label="收起来信暗号框" @click="close">×</button>
        </div>
        <div class="secret-note-input">
          <input
            id="secret-passphrase"
            ref="phraseInput"
            v-model="passphrase"
            maxlength="30"
            autocomplete="off"
            enterkeyhint="go"
            placeholder="轻声说出那个暗号…"
            :aria-invalid="!!feedback"
            aria-describedby="secret-note-feedback"
            @input="feedback = ''"
            @compositionstart="composing = true"
            @compositionend="composing = false"
            @keydown.enter="($event.isComposing || $event.keyCode === 229) && $event.preventDefault()"
          />
          <button type="submit" :disabled="!passphrase.trim()">确认</button>
        </div>
        <p id="secret-note-feedback" class="secret-note-feedback" role="status">{{ feedback }}</p>
      </form>
    </Transition>
  </div>
</template>

<style scoped>
.secret-note{width:min(100%,320px);margin:10px auto 0;text-align:center}
.secret-signature{display:inline-flex;align-items:center;justify-content:center;width:88px;min-height:72px;padding:0;border:0;border-radius:18px;background:transparent;color:#f7dba3;touch-action:manipulation}
.secret-envelope{display:block;width:88px;height:72px;overflow:visible;pointer-events:none;animation:secretEnvelopeLight 3.2s ease-in-out infinite}
.secret-envelope-aura{opacity:.14;filter:blur(10px);transform-box:fill-box;transform-origin:center;animation:secretEnvelopeAura 3.2s ease-in-out infinite}
.secret-envelope-rays path{stroke-dasharray:1 1;animation:secretEnvelopeRay 2.8s ease-out infinite}
.secret-envelope-sparkles path{transform-box:fill-box;transform-origin:center;animation:secretEnvelopeSparkle 3.2s ease-in-out infinite}
.secret-envelope-sparkles path:nth-child(2){animation-delay:-1.15s}.secret-envelope-sparkles path:nth-child(3){animation-delay:-2.1s}
.secret-signature:hover .secret-envelope,.secret-signature:focus-visible .secret-envelope,.secret-signature[aria-expanded="true"] .secret-envelope{animation:none;filter:drop-shadow(0 0 5px #fff1c6b3) drop-shadow(0 0 15px #edbd6e99)}
.secret-note-form{padding:10px 14px 0;border:1px solid #d9bf8d40;border-radius:16px;background:linear-gradient(135deg,#222b42e6,#10182de6);box-shadow:0 10px 32px #03071730,inset 0 1px #fff1;text-align:left}
.secret-note-heading{display:flex;align-items:center;justify-content:space-between;gap:4px}
.secret-note-heading label{color:#e5d4b5;font-size:14px;line-height:1.7;letter-spacing:.02em}
.secret-note-close{flex:0 0 44px;min-height:44px;margin-right:-10px;padding:0;border:0;border-radius:50%;background:transparent;color:#b4bdd0;font-size:22px}
.secret-note-close:hover{color:#f4dfb9}
.secret-note-input{display:flex;gap:8px;align-items:center;padding:5px 5px 5px 12px;border:1px solid #dfcda645;border-radius:12px;background:#080e20a8}
.secret-note-input:focus-within{border-color:#ead2a68c;box-shadow:0 0 16px #e5c8960d}
.secret-note-input input{width:100%;min-width:0;padding:7px 0;border:0;outline:0;background:transparent;color:#f6e9d0;font-family:inherit;font-size:16px;line-height:1.5}
.secret-note-input input::placeholder{color:#9ba6bc;font-size:14px}
.secret-note-input button{flex-shrink:0;min-width:58px;min-height:44px;padding:8px 12px;border:1px solid #ead5ad50;border-radius:9px;background:#e7d3ac;color:#27263b;font-size:14px;letter-spacing:.06em}
.secret-note-input button:disabled{opacity:.4;cursor:default}
.secret-note .secret-note-feedback{min-height:22px;margin:7px 0 5px;color:#e3c6b5;font-size:13px;line-height:1.7;letter-spacing:.02em}
.secret-unfold-enter-active,.secret-unfold-leave-active{transition:opacity .25s,transform .25s}
.secret-unfold-enter-from,.secret-unfold-leave-to{opacity:0;transform:translateY(-6px)}
@keyframes secretEnvelopeLight{0%,100%{filter:drop-shadow(0 0 3px #e6c5864d)}48%{filter:drop-shadow(0 0 5px #fff5d6cc) drop-shadow(0 0 14px #edbd6e80)}}
@keyframes secretEnvelopeAura{0%,100%{opacity:.1;transform:scale(.85)}48%{opacity:.28;transform:scale(1.15)}}
@keyframes secretEnvelopeRay{0%,18%{opacity:0;stroke-dashoffset:1}38%{opacity:.85;stroke-dashoffset:0}68%,100%{opacity:0;stroke-dashoffset:-1}}
@keyframes secretEnvelopeSparkle{0%,20%,85%,100%{opacity:.15;transform:scale(.5)}46%{opacity:1;transform:scale(1.05)}62%{opacity:.5;transform:scale(.75)}}
@media(prefers-reduced-motion:reduce){.secret-envelope,.secret-envelope-aura,.secret-envelope-rays path,.secret-envelope-sparkles path{animation:none}.secret-envelope{filter:drop-shadow(0 0 6px #edbd6e66)}.secret-envelope-rays path{opacity:.35;stroke-dashoffset:0}.secret-envelope-sparkles path{opacity:.7}.secret-unfold-enter-active,.secret-unfold-leave-active{transition:none}}
</style>
