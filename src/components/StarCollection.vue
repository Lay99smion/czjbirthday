<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
const emit = defineEmits(["complete", "sound"]);
const messages = ["小陈少爷", "不要再为琐事烦恼", "我们一定要成为很好很好的朋友"];
const positions = [{ left: '25%', top: '35%' }, { left: '73%', top: '43%' }, { left: '46%', top: '67%' }];
const lit = ref([]);
const read = ref([]);
const constellationVisible = ref(false);
const constellation = [
  { letter: 'C', points: [[110, 50], [90, 35], [60, 35], [40, 55], [35, 100], [45, 135], [65, 150], [95, 150], [110, 137]] },
  { letter: 'Z', points: [[145, 40], [210, 40], [145, 150], [210, 150]] },
  { letter: 'J', points: [[255, 40], [315, 40], [315, 125], [305, 145], [285, 153], [263, 145], [250, 126]] },
];
const constellationPositions = [{ left: '9.7222%', top: '50%' }, { left: '58.3333%', top: '20%' }, { left: '87.5%', top: '62.5%' }];
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
  if (selected.value === null) return;
  if (!read.value.includes(selected.value)) read.value.push(selected.value);
  selected.value = null;
  if (read.value.length === messages.length) constellationVisible.value = true;
  nextTick(() => returnFocus?.focus());
}
function trapFocus(event) {
  if (event.key === 'Escape') close();
  if (event.key === 'Tab') { event.preventDefault(); dialog.value?.querySelector('button')?.focus(); }
}
onBeforeUnmount(() => { returnFocus = null; });
</script>

<template>
  <section class="star-collection" :class="{ 'constellation-revealed': constellationVisible }" aria-label="寻找三颗藏着心里话的星星">
    <div class="collect-dust" aria-hidden="true"><i v-for="(style, i) in stardust" :key="i" :style="style"></i></div>
    <div class="collect-heading"><span class="section-kicker">THREE LITTLE SECRETS</span><h2>烟花散了，<br /><em>星光还为你留着。</em></h2><p v-if="constellationVisible">三句心里话，<br />连成只属于你的 CZJ 星座。</p><p v-else>找找三颗稍亮的星星，<br />每一颗，都藏着一句想对你说的话。</p></div>
    <div class="constellation-field">
      <svg v-if="constellationVisible" class="czj-constellation" viewBox="0 0 360 200" role="img" aria-label="三颗心愿星与细碎星光，用细线勾勒成 CZJ 字母星座">
        <g v-for="(letter, i) in constellation" :key="letter.letter" :style="{ '--letter-delay': `${i * .3}s` }">
          <polyline class="constellation-line" :points="letter.points.map(point => point.join(',')).join(' ')" pathLength="1" />
          <circle v-for="(point, j) in letter.points" :key="j" class="constellation-point" :cx="point[0]" :cy="point[1]" :r="j % 3 === 0 ? 2 : 1.3" />
        </g>
      </svg>
      <button v-for="(message, i) in messages" :key="i" class="collect-star" :class="{ lit: lit.includes(i) }" :style="constellationVisible ? constellationPositions[i] : positions[i]" type="button" :aria-label="`第 ${i + 1} 颗心愿星${lit.includes(i) ? '，已点亮，可重读' : '，点击收集心里话'}`" :aria-pressed="lit.includes(i)" @click="collect(i, $event)"><span aria-hidden="true">✦</span></button>
      <span v-if="constellationVisible" class="constellation-sign" aria-hidden="true">CZJ · ONLY FOR YOU</span>
    </div>
    <div class="collect-progress" aria-live="polite"><span>已收集 {{ collected }} / 3 颗星光</span><div><i v-for="n in 3" :key="n" :class="{ lit: n <= collected }">✦</i></div>
      <button v-if="constellationVisible && selected === null" class="pill-button unlock-blessing" type="button" @click="emit('complete')">打开完整祝福 <span>↗</span></button>
      <small v-else>慢慢来，惊喜一直都在。</small>
    </div>
    <Transition name="whisper"><div v-if="selected !== null" class="whisper-backdrop" @click.self="close"><div ref="dialog" class="star-whisper" role="dialog" aria-modal="true" aria-labelledby="whisper-message" @keydown="trapFocus"><span class="whisper-mark">✦</span><small>一小句心里话 · {{ selected + 1 }} / 3</small><p id="whisper-message">{{ messages[selected] }}</p><button type="button" @click="close">收好这句悄悄话 <span>♡</span></button></div></div></Transition>
  </section>
</template>

<style scoped>
.constellation-field{position:absolute;left:50%;top:54%;width:min(86vw,520px,64.8dvh);aspect-ratio:9/5;transform:translate(-50%,-50%)}
.constellation-field .collect-star{transition:left 1.1s ease-in-out,top 1.1s ease-in-out,color .5s,filter .5s}
.czj-constellation{position:absolute;inset:0;width:100%;height:100%;overflow:visible;color:#f0d6a2;pointer-events:none}
.constellation-line{fill:none;stroke:currentColor;stroke-width:1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:0;opacity:.75;animation:constellationDraw 1.6s calc(.6s + var(--letter-delay)) ease both}
.constellation-point{fill:#fff0c9;filter:drop-shadow(0 0 3px #e4c38a);animation:constellationGlow .9s calc(1.2s + var(--letter-delay)) ease both}
.constellation-sign{position:absolute;left:0;right:0;bottom:-20px;color:#ccb78e;font:9px/1.8 Georgia,serif;letter-spacing:.3em;animation:constellationGlow .8s 1.8s both}
.constellation-revealed .collect-star>span{animation:none}
@keyframes constellationDraw{from{stroke-dashoffset:1;opacity:0}to{stroke-dashoffset:0;opacity:.75}}
@keyframes constellationGlow{from{opacity:0}to{opacity:1}}
@media(max-height:480px){.constellation-field{top:57%;width:min(70vw,44dvh)}.constellation-sign{bottom:-12px;font-size:8px}}
@media(prefers-reduced-motion:reduce){.constellation-field .collect-star{transition:none}.constellation-line,.constellation-point,.constellation-sign{animation:none}}
</style>
