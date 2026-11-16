<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { createTicketSvg, loadTicketPhoto, normalizeTicketWish, renderTicketPng, ticketWishError, TICKET_WISH_LIMIT } from '../birthdayTicket';

const props = defineProps({ name: String, date: String, photo: String, initialWish: { type: String, default: '' } });
const emit = defineEmits(['back', 'wish']);
const draftWish = ref(props.initialWish);
const photoData = ref('');
const imageUrl = ref('');
const generated = ref(false);
const generating = ref(false);
const photoLoading = ref(true);
const photoError = ref('');
const error = ref('');
const status = ref('');
const wishInput = ref(null);
const heading = ref(null);
const savedFile = shallowRef(null);
const filename = computed(() => `${props.name}-生日纪念票.png`.replace(/[<>:"/\\|?*\x00-\x1f]/g, ''));
const canShare = computed(() => {
  try { return !!savedFile.value && typeof navigator.canShare === 'function' && navigator.canShare({ files: [savedFile.value] }); }
  catch { return false; }
});
const controller = new AbortController();
let disposed = false;

function replaceImage(blob) {
  const old = imageUrl.value;
  imageUrl.value = URL.createObjectURL(blob);
  if (old) URL.revokeObjectURL(old);
}
function ticketSvg() {
  return createTicketSvg({ name: props.name, date: props.date, wish: draftWish.value, photoDataUrl: photoData.value });
}
function updatePreview() {
  if (disposed) return;
  const hadImage = generated.value;
  generated.value = false;
  savedFile.value = null;
  error.value = '';
  status.value = hadImage ? '心愿已修改，请重新生成纪念票。' : '';
  replaceImage(new Blob([ticketSvg()], { type: 'image/svg+xml;charset=utf-8' }));
}
async function preparePhoto() {
  photoLoading.value = true;
  photoError.value = '';
  try {
    const data = await loadTicketPhoto(props.photo, controller.signal);
    if (!disposed) photoData.value = data;
  } catch (cause) {
    if (!disposed && cause.name !== 'AbortError') photoError.value = '照片暂时没能加载，点一下重新准备。';
  } finally {
    if (!disposed) photoLoading.value = false;
  }
}
async function generate() {
  if (generating.value || disposed) return;
  error.value = ticketWishError(draftWish.value);
  if (error.value) { wishInput.value?.focus(); return; }
  if (!photoData.value) { error.value = '请等照片准备好，再生成纪念票。'; return; }
  generating.value = true;
  status.value = '正在把这一刻装进纪念票…';
  try {
    await document.fonts?.ready;
    const blob = await renderTicketPng(ticketSvg());
    if (disposed) return;
    savedFile.value = new File([blob], filename.value, { type: 'image/png' });
    replaceImage(blob);
    generated.value = true;
    status.value = '纪念票已生成，可以保存图片，也可以长按下方图片保存。';
    emit('wish', normalizeTicketWish(draftWish.value));
  } catch {
    if (!disposed) { error.value = '这次没能生成图片，请再试一次。'; status.value = ''; }
  } finally {
    if (!disposed) generating.value = false;
  }
}
async function shareImage() {
  if (!canShare.value) return;
  try {
    await navigator.share({ files: [savedFile.value], title: `${props.name}的生日纪念票` });
  } catch (cause) {
    if (!disposed) status.value = cause.name === 'AbortError' ? '已取消操作，纪念票仍在这里。' : '可以使用保存图片按钮，或长按下方图片保存。';
  }
}
watch(draftWish, value => { updatePreview(); emit('wish', value); });
watch(photoData, updatePreview);
onMounted(async () => {
  updatePreview();
  preparePhoto();
  await nextTick();
  if (!disposed) heading.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => {
  disposed = true;
  controller.abort();
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
});
</script>

<template>
  <section class="scene-page ticket-page" aria-labelledby="ticket-heading" @touchstart.stop @touchend.stop>
    <nav class="ticket-toolbar" aria-label="纪念票页面导航">
      <button class="ticket-back" type="button" @click="emit('back')"><span aria-hidden="true">←</span> 返回生日页面</button>
      <span class="ticket-toolbar-title">生日纪念票</span>
    </nav>
    <div class="ticket-layout">
      <header class="ticket-heading">
        <span class="section-kicker">KEEP THIS LITTLE MOMENT</span>
        <h2 id="ticket-heading" ref="heading" tabindex="-1">把这一岁，<em>好好收藏。</em></h2>
        <p>给{{ name }}的一张生日纪念票。</p>
      </header>
      <form class="ticket-form" @submit.prevent="generate">
        <div class="ticket-details"><span>寿星 <b>{{ name }}</b></span><span>生日 <b>{{ date }}</b></span></div>
        <label for="ticket-wish">写下你的生日心愿</label>
        <textarea id="ticket-wish" ref="wishInput" v-model="draftWish" rows="3" :maxlength="TICKET_WISH_LIMIT" :disabled="generating" placeholder="希望新的一岁……" :aria-invalid="!!error" :aria-describedby="error ? 'ticket-wish-help ticket-error' : 'ticket-wish-help'" required></textarea>
        <p id="ticket-wish-help" class="ticket-input-hint"><span>最多 80 字、4 行，会写进纪念票里</span><span>{{ draftWish.length }}/80</span></p>
        <p v-if="photoError" class="ticket-error" role="status">{{ photoError }} <button type="button" class="ticket-photo-retry" @click="preparePhoto">重新加载照片</button></p>
        <p v-if="error" id="ticket-error" class="ticket-error" role="alert">{{ error }}</p>
        <button class="pill-button ticket-generate" type="submit" :disabled="generating || photoLoading || !!photoError">{{ photoLoading ? '正在准备照片…' : generating ? '正在生成纪念票…' : generated ? '重新生成纪念票' : '生成生日纪念票' }} <span aria-hidden="true">✦</span></button>
        <div v-if="generated" class="ticket-save-actions">
          <a class="ticket-download" :href="imageUrl" :download="filename">保存 PNG 图片 <span aria-hidden="true">↓</span></a>
          <button v-if="canShare" class="ticket-share" type="button" @click="shareImage">保存 / 分享图片</button>
          <p>手机上也可以长按下方图片，选择保存。</p>
        </div>
        <p class="ticket-status" role="status">{{ status }}</p>
      </form>
      <figure class="ticket-preview">
        <figcaption>{{ generated ? '你的生日纪念票 · 长按图片可保存' : '纪念票预览' }}</figcaption>
        <img v-if="imageUrl" :src="imageUrl" :alt="`${name}的生日纪念票，生日${date}，心愿：${draftWish || '待填写'}`" width="900" height="1560" class="birthday-ticket-image" />
      </figure>
    </div>
  </section>
</template>
