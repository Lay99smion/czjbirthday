<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
const emit = defineEmits(["complete", "sound"]);
const messages = ["小陈少爷", "不要再为琐事烦恼", "我们一定要成为很好很好的朋友"];
const positions = [{ left: '25%', top: '35%' }, { left: '73%', top: '43%' }, { left: '46%', top: '67%' }];
const lit = ref([]);
const selected = ref(null);
const dialog = ref(null);
const collected = computed(() => lit.value.length);
const stardust = Array.from({ length: 65 }, () => ({ left: `${Math.random() * 96 + 2}%`, top: `${Math.random() * 88 + 6}%`, '--size': `${1 + Math.random() * 2}px`, '--delay': `${Math.random() * -5}s` }));
let returnFocus;
async function collect(index, event) {
  if (selected.value !== null) return;
  returnFocus = event.currentTarget;
  selected.value = index;
  if (!lit.value.includes(index)) lit.value.push(index);
  emit("sound", "star");
  await nextTick();
  dialog.value?.querySelector('button')?.focus();
}
function close() {
  selected.value = null;
  nextTick(() => returnFocus?.focus());
}
function trapFocus(event) {
  if (event.key === 'Escape') close();
  if (event.key === 'Tab') { event.preventDefault(); dialog.value?.querySelector('button')?.focus(); }
}
onBeforeUnmount(() => { returnFocus = null; });
</script>

<template>
  <section class="star-collection" aria-label="寻找三颗藏着心里话的星星">
    <div class="collect-dust" aria-hidden="true"><i v-for="(style, i) in stardust" :key="i" :style="style"></i></div>
    <div class="collect-heading"><span class="section-kicker">THREE LITTLE SECRETS</span><h2>烟花散了，<br /><em>星光还为你留着。</em></h2><p>找找三颗稍亮的星星，<br />每一颗，都藏着一句想对你说的话。</p></div>
    <button v-for="(message, i) in messages" :key="i" class="collect-star" :class="{ lit: lit.includes(i) }" :style="positions[i]" type="button" :aria-label="`第 ${i + 1} 颗心愿星${lit.includes(i) ? '，已点亮，可重读' : '，点击收集心里话'}`" :aria-pressed="lit.includes(i)" @click="collect(i, $event)"><span aria-hidden="true">✦</span></button>
    <div class="collect-progress" aria-live="polite"><span>已收集 {{ collected }} / 3 颗星光</span><div><i v-for="n in 3" :key="n" :class="{ lit: n <= collected }">✦</i></div>
      <button v-if="collected === 3 && selected === null" class="pill-button unlock-blessing" type="button" @click="emit('complete')">打开完整祝福 <span>↗</span></button>
      <small v-else>慢慢来，惊喜一直都在。</small>
    </div>
    <Transition name="whisper"><div v-if="selected !== null" class="whisper-backdrop" @click.self="close"><div ref="dialog" class="star-whisper" role="dialog" aria-modal="true" aria-labelledby="whisper-message" @keydown="trapFocus"><span class="whisper-mark">✦</span><small>一小句心里话 · {{ selected + 1 }} / 3</small><p id="whisper-message">{{ messages[selected] }}</p><button type="button" @click="close">收好这句悄悄话 <span>♡</span></button></div></div></Transition>
  </section>
</template>
