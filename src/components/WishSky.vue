<script setup>
import { ref } from "vue";
import { secretLetter } from "../secretLetter";
const emit = defineEmits(["secret"]);
const wish = ref("");
const bubbles = ref([]);
const bursts = ref([]);
const sky = ref(null);
const wishInput = ref(null);
const status = ref("");
let serial = 0;
function release(event) {
  if (event?.isComposing) return;
  const text = wish.value.trim();
  if (!text) return;
  if (text === secretLetter.keyword) {
    wish.value = "";
    wishInput.value?.blur();
    status.value = "一只衔着信封的小鸟，正向你飞来。";
    emit("secret", wishInput.value);
    return;
  }
  const id = ++serial;
  bubbles.value.push({ id, text, left: 18 + Math.random() * 64, rise: Math.max(140, (sky.value?.clientHeight || innerHeight) - 230) });
  if (bubbles.value.length > 8) bubbles.value.shift();
  wish.value = "";
  status.value = "心愿正在缓缓飘向星空。";
}
function burst(bubble, event) {
  if (event.animationName !== 'wishRise' || !bubbles.value.some(item => item.id === bubble.id)) return;
  bubbles.value = bubbles.value.filter(item => item.id !== bubble.id);
  bursts.value.push({ id: bubble.id, left: bubble.left, sparks: Array.from({ length: 14 }, (_, i) => {
    const angle = Math.PI * 2 * i / 14;
    return { '--dx': `${Math.cos(angle) * (25 + Math.random() * 50)}px`, '--dy': `${Math.sin(angle) * (20 + Math.random() * 40) + 18}px`, '--spin': `${Math.random() * 300}deg` };
  }) });
  status.value = "心愿化成星光，留在这一刻。";
}
function clearBurst(id, event) {
  if (event.animationName === 'wishSpark') bursts.value = bursts.value.filter(item => item.id !== id);
}
</script>

<template>
  <div ref="sky" class="wish-sky" aria-hidden="true"><div v-for="bubble in bubbles" :key="bubble.id" class="wish-bubble" :style="{ left: `${bubble.left}%`, '--rise': `${bubble.rise}px` }" @animationend="burst(bubble, $event)"><span>{{ bubble.text }}</span></div><div v-for="explosion in bursts" :key="explosion.id" class="wish-burst" :style="{ left: `${explosion.left}%` }"><i v-for="(style, i) in explosion.sparks" :key="i" :style="style" @animationend="clearBurst(explosion.id, $event)"></i></div></div>
  <form class="wish-form" @submit.prevent="release" @touchstart.stop @touchend.stop>
    <label for="moment-wish">还有一句心愿，想留给此刻吗？</label>
    <div class="wish-input-wrap"><input id="moment-wish" ref="wishInput" v-model="wish" maxlength="60" autocomplete="off" enterkeyhint="send" placeholder="写一句心愿，让它慢慢升空…" @keydown.enter="($event.isComposing || $event.keyCode === 229) && $event.preventDefault()" /><button type="submit" :disabled="!wish.trim()" aria-label="让心愿升空">↑</button></div>
    <p>按回车，或轻触 ↑ · 只留在这一刻，刷新便消散</p><span class="sr-only" role="status">{{ status }}</span>
  </form>
</template>
