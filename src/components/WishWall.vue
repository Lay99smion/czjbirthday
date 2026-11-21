<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchWishes, submitWish, wishesApiConfigured } from "../wishesApi";
import { createMemoryFilmMusic } from "../memoryFilmMusic";
import WishBottle from "./WishBottle.vue";
import { addSavedWish } from "../wishesCollection";

defineProps({ homeHref: { type: String, required: true } });

const message = ref("");
const wishes = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const submitError = ref("");
const status = ref("");
const bottle = ref(null);
const remaining = computed(() => 120 - Array.from(message.value).length);
const music = createMemoryFilmMusic();
const musicOn = ref(false);
const musicHint = ref(false);
let musicRequest = 0;
let wishesRevision = 0;
let disposed = false;

async function startMusic() {
  const request = ++musicRequest;
  try {
    const playing = await music.start();
    if (request !== musicRequest) return;
    musicOn.value = playing;
    musicHint.value = !playing;
  } catch {
    if (request !== musicRequest) return;
    musicOn.value = false;
    musicHint.value = true;
  }
}

function toggleMusic() {
  if (musicOn.value) {
    musicRequest++;
    music.pause();
    musicOn.value = false;
    musicHint.value = false;
  } else startMusic();
}

function presentError(error) {
  const text = String(error?.message || error || "");
  if (/permission denied|42501|row-level security|row level security/i.test(text)) {
    return "祝福瓶暂时无法打开，请稍后再来看看。";
  }
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return "暂时连接不到祝福瓶，请检查网络后重试。";
  }
  return "这次没有连接成功，请稍后重试。";
}

async function refreshWishes() {
  if (!wishesApiConfigured) return;
  const revision = wishesRevision;
  loading.value = true;
  loadError.value = "";
  try {
    const rows = await fetchWishes();
    if (!disposed && revision === wishesRevision) wishes.value = rows;
  } catch (error) {
    loadError.value = presentError(error);
  } finally {
    loading.value = false;
  }
}

async function sendWish() {
  const content = message.value.trim();
  if (!content || saving.value || !wishesApiConfigured) return;
  if (Array.from(content).length > 120) {
    submitError.value = "祝福请控制在 120 字以内。";
    return;
  }

  saving.value = true;
  submitError.value = "";
  status.value = "正在保存这份心意…";
  let savedWish;
  try {
    savedWish = await submitWish(content);
  } catch (error) {
    submitError.value = presentError(error);
    status.value = "";
    saving.value = false;
    return;
  }
  if (disposed) return;
  wishesRevision++;
  const id = savedWish.id;
  wishes.value = addSavedWish(wishes.value, savedWish);
  if (!wishes.value.some((wish) => wish.is_pinned)) refreshWishes();
  message.value = "";
  status.value = "祝福已保存，正在放进星光瓶…";
  await nextTick();
  try { await bottle.value?.collect(id); } catch { /* The saved wish remains readable if animation is unavailable. */ }
  if (disposed) return;
  status.value = "已珍藏在瓶中，愿这份心意一直发光。";
  saving.value = false;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

onMounted(() => {
  refreshWishes();
  startMusic();
});
onBeforeUnmount(() => {
  disposed = true;
  musicRequest++;
  music.dispose();
});
</script>

<template>
  <main class="wish-wall-page">
    <div class="wish-wall-glow wish-wall-glow-one" aria-hidden="true"></div>
    <div class="wish-wall-glow wish-wall-glow-two" aria-hidden="true"></div>

    <div class="wish-wall-inner">
      <header class="wish-wall-toolbar">
        <a :href="homeHref" class="wish-wall-back">返回生日星空</a>
        <div class="wish-wall-toolbar-actions">
          <span v-if="musicHint && !musicOn" class="wish-wall-music-hint">点音符播放生日歌</span>
          <span class="wish-wall-mark">A LITTLE WISH FOR YOU</span>
          <button
            type="button"
            class="wish-wall-music"
            :aria-label="musicOn ? '关闭音乐' : '开启音乐'"
            :aria-pressed="musicOn"
            :title="musicOn ? '关闭音乐' : '开启音乐'"
            @click="toggleMusic"
          >♫<i v-if="!musicOn" aria-hidden="true"></i></button>
        </div>
      </header>

      <section class="wish-wall-hero">
        <span class="wish-wall-kicker">WISHES IN A BOTTLE</span>
        <h1>把祝福，藏进<em>一瓶星光</em></h1>
        <p>那些温柔的话，值得被好好珍藏。</p>
      </section>

      <div class="wish-wall-experience">
        <WishBottle ref="bottle" :wishes="wishes" :loading="loading" />

        <section class="wish-wall-compose" aria-labelledby="wish-wall-form-title">
          <span class="wish-compose-star" aria-hidden="true">✧</span>
          <span class="wish-wall-section-label">A NOTE FROM THE HEART</span>
          <h2 id="wish-wall-form-title">留一句祝福，<br />点亮一颗小小的星。</h2>
          <p class="wish-wall-compose-intro">写下想对他说的话，<br />让这只瓶子，装满来自你的温柔。</p>

          <form @submit.prevent="sendWish">
            <div class="wish-wall-field-heading">
              <label for="wish-wall-message">你的祝福</label>
              <span class="wish-wall-count" :class="{ 'is-limit': remaining < 0 }">{{ Array.from(message).length }} / 120</span>
            </div>
            <textarea
              id="wish-wall-message"
              v-model="message"
              maxlength="240"
              rows="4"
              placeholder="愿你被爱包围，每一天都有小小的快乐……"
              :disabled="!wishesApiConfigured || saving"
              :aria-invalid="remaining < 0 || Boolean(submitError)"
              aria-describedby="wish-wall-form-note wish-wall-form-status"
            ></textarea>
            <button class="wish-wall-send" type="submit" :disabled="!message.trim() || remaining < 0 || saving || !wishesApiConfigured">
              <span aria-hidden="true">✦</span> {{ saving ? "正在珍藏这份心意…" : "把祝福放进瓶里" }}
            </button>
            <p id="wish-wall-form-note" class="wish-wall-form-note">每份祝福都会公开珍藏，请勿填写个人隐私信息。</p>
          </form>

          <p v-if="!wishesApiConfigured" id="wish-wall-form-status" class="wish-wall-alert" role="status">祝福瓶正在准备中，稍后就能留下心意。</p>
          <p v-else-if="submitError" id="wish-wall-form-status" class="wish-wall-alert" role="alert">{{ submitError }}</p>
          <p v-else id="wish-wall-form-status" class="wish-wall-status" role="status" aria-live="polite">{{ status || '一字一句，都会变成瓶中的光。' }}</p>
        </section>
      </div>

      <section class="wish-wall-feed" aria-label="瓶中的全部祝福">
        <div class="wish-wall-feed-toolbar">
          <span>每一束光，都有一句想说的话</span>
          <button type="button" class="wish-wall-refresh" :disabled="loading || saving || !wishesApiConfigured" @click="refreshWishes">{{ loading ? "收集中…" : "刷新祝福" }}</button>
        </div>
        <p v-if="loadError" class="wish-wall-alert" role="alert">{{ loadError }}</p>
        <details class="wish-wall-archive">
          <summary>
            <span>瓶中的祝福 <small>{{ wishes.length }} / 100 份</small></span>
            <span class="wish-wall-archive-toggle">展开阅读 <i aria-hidden="true"></i></span>
          </summary>
          <p v-if="loading && !wishes.length" class="wish-wall-empty">正在收集远道而来的心意…</p>
          <p v-else-if="!wishes.length" class="wish-wall-empty">第一束星光，正在等你点亮。</p>
          <div v-else class="wish-wall-grid">
            <article v-for="wish in wishes" :key="wish.id" class="wish-card">
              <span class="wish-card-star" aria-hidden="true">✦</span>
              <span v-if="wish.is_pinned" class="wish-card-pinned">第一份祝福 · 永久置顶</span>
              <p>{{ wish.content }}</p>
              <time :datetime="wish.created_at">{{ formatDate(wish.created_at) }}</time>
            </article>
          </div>
        </details>
      </section>
      <footer class="wish-wall-footer"><span aria-hidden="true">✧</span> 愿每一份真心，都有安放的地方。</footer>
    </div>
  </main>
</template>

<style scoped>
.wish-wall-page{position:relative;width:100%;height:100%;min-height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;padding:max(22px,env(safe-area-inset-top)) 32px max(24px,env(safe-area-inset-bottom));color:#f6f0e5;background:radial-gradient(ellipse at 34% 37%,#1c2b44 0%,#101c32 38%,#090f21 78%)}
.wish-wall-page:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.25;background-image:radial-gradient(1px 1px at 12% 18%,#fff 98%,transparent),radial-gradient(1px 1px at 81% 27%,#f1d8a7 98%,transparent),radial-gradient(1px 1px at 66% 72%,#cedfff 98%,transparent),radial-gradient(1px 1px at 28% 83%,#fff 98%,transparent);background-size:280px 310px}
.wish-wall-inner{position:relative;z-index:1;width:min(100%,1060px);margin:0 auto}.wish-wall-glow{position:fixed;z-index:0;width:42vw;height:42vw;max-width:470px;max-height:470px;border-radius:50%;filter:blur(100px);pointer-events:none;opacity:.12}.wish-wall-glow-one{top:15%;left:-17%;background:#89a8c8}.wish-wall-glow-two{right:-12%;bottom:4%;background:#b98563}
.wish-wall-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px}.wish-wall-back{display:inline-flex;align-items:center;min-height:44px;color:#cfbea0;text-decoration:none;font-size:14px;letter-spacing:.04em}.wish-wall-back:hover{color:#fff1ca}.wish-wall-mark{color:#8e9db3;font-size:11px;letter-spacing:.18em}.wish-wall-toolbar-actions{display:flex;align-items:center;gap:18px}.wish-wall-music{position:relative;display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:1px solid #e5d7b53d;border-radius:50%;background:#111a3373;color:#efd99e;font-size:20px}.wish-wall-music i{position:absolute;width:27px;height:1.5px;border-radius:2px;background:#ffe6ae;transform:rotate(-45deg);pointer-events:none}.wish-wall-music-hint{color:#a8b8cf;font-size:14px}
.wish-wall-hero{padding:45px 0 16px;text-align:center}.wish-wall-kicker,.wish-wall-section-label{color:#c9b486;font-size:11px;font-weight:500;letter-spacing:.22em}.wish-wall-hero h1{margin:18px 0 14px;font:500 clamp(29px,4.2vw,43px)/1.5 'Songti SC','Noto Serif SC',serif;letter-spacing:.075em}.wish-wall-hero h1 em{color:#f1d9a8;font-style:normal;text-shadow:0 0 28px #e5c47a45}.wish-wall-hero>p{margin:0;color:#b1bfd0;font-size:16px;line-height:1.9;letter-spacing:.1em}
.wish-wall-experience{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:58px;padding:10px 0 46px}.wish-wall-compose{position:relative;margin-top:20px;padding:34px 30px 22px;border:1px solid #d4bb853d;border-radius:5px 26px 26px 26px;background:linear-gradient(145deg,#263249b3,#172138b8);box-shadow:0 24px 65px #03091a33,inset 0 1px #fff6de08;backdrop-filter:blur(12px)}.wish-compose-star{position:absolute;top:25px;right:27px;color:#d8bd88;font-size:25px;text-shadow:0 0 18px #f0cc8055}.wish-wall-compose h2{margin:18px 0 13px;font:500 clamp(23px,2.5vw,28px)/1.65 'Songti SC','Noto Serif SC',serif;letter-spacing:.045em}.wish-wall-compose-intro{margin:0 0 26px;color:#b4c0d1;font-size:16px;line-height:1.9;letter-spacing:.025em}
.wish-wall-field-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}.wish-wall-field-heading label{color:#d7d8dc;font-size:14px}.wish-wall-count{color:#94a4bc;font-size:12px;font-variant-numeric:tabular-nums}.wish-wall-count.is-limit{color:#efb6a6}.wish-wall-compose textarea{display:block;width:100%;min-height:137px;resize:vertical;border:1px solid #c7bd9c40;border-radius:12px;padding:15px 17px;background:#090f2199;color:#f8eedb;font-family:inherit;font-size:16px;line-height:1.9;letter-spacing:.025em;outline:none;transition:border-color .2s,box-shadow .2s}.wish-wall-compose textarea::placeholder{color:#8493ab}.wish-wall-compose textarea:focus{border-color:#e4cb91a8;box-shadow:0 0 0 3px #e4cb9112}.wish-wall-compose textarea:disabled{opacity:.55}
.wish-wall-send{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;min-height:49px;margin-top:16px;padding:10px 14px;border:1px solid #f2dba8;border-radius:30px;background:linear-gradient(110deg,#ddc291,#f1dcb4);color:#303044;font-size:16px;font-weight:500;letter-spacing:.04em;box-shadow:0 5px 22px #dfb87317;transition:filter .2s,box-shadow .2s}.wish-wall-send:hover:not(:disabled){filter:brightness(1.08);box-shadow:0 5px 25px #dfb87330}.wish-wall-send:disabled{opacity:.4;cursor:default}.wish-wall-send span{font-size:18px}.wish-wall-form-note{margin:14px 0 0;color:#8fa0b8;font-size:12px;line-height:1.8}.wish-wall-status,.wish-wall-alert{margin:14px 0 0;font-size:14px;line-height:1.7;overflow-wrap:anywhere}.wish-wall-status{min-height:2.4em;color:#bccaaf}.wish-wall-alert{color:#f1bcb1}.wish-wall-status:before{content:'✧';padding-right:7px;color:#d3bf91}
.wish-wall-feed{padding:25px 0 0;border-top:1px solid #d1bf9121}.wish-wall-feed-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;color:#91a1b8;font-size:14px;line-height:1.7}.wish-wall-refresh{flex-shrink:0;min-height:40px;padding:6px 13px;border:1px solid #d8c3923b;border-radius:24px;background:#e3d1a006;color:#c5b994;font-size:14px}.wish-wall-refresh:disabled{opacity:.45;cursor:default}
.wish-wall-archive{border:1px solid #d4bb8530;border-radius:14px;background:#18233955}.wish-wall-archive summary{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:72px;padding:18px 22px;list-style:none;cursor:pointer;color:#e4d1ab;font:500 18px/1.6 'Songti SC','Noto Serif SC',serif}.wish-wall-archive summary::-webkit-details-marker{display:none}.wish-wall-archive summary small{margin-left:12px;color:#90a1b9;font:12px/1.5 'DM Sans',sans-serif}.wish-wall-archive-toggle{display:flex;align-items:center;gap:12px;color:#acb9cb;font:14px/1.5 'DM Sans',sans-serif;white-space:nowrap}.wish-wall-archive-toggle i{width:7px;height:7px;margin-top:-4px;border-right:1px solid #c6b58e;border-bottom:1px solid #c6b58e;transform:rotate(45deg);transition:transform .2s}.wish-wall-archive[open] .wish-wall-archive-toggle i{transform:rotate(225deg);margin-top:4px}.wish-wall-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 18px 18px}.wish-card{position:relative;min-height:150px;padding:20px 21px 17px;border:1px solid #d8c18b26;border-radius:12px;background:linear-gradient(145deg,#24314991,#141e33a1)}.wish-card-star{color:#e7ca90;font-size:14px;text-shadow:0 0 12px #f3d79a6b}.wish-card p{margin:13px 0 23px;color:#f0e5d1;font:16px/1.9 'Songti SC','Noto Serif SC',serif;letter-spacing:.025em;white-space:pre-wrap;overflow-wrap:anywhere}.wish-card time{display:block;text-align:right;color:#8e9eb6;font-size:12px;letter-spacing:.03em}.wish-wall-empty{padding:12px 22px 25px;margin:0;color:#a8b6ca;text-align:center;font-size:16px;line-height:1.8}.wish-wall-footer{display:flex;justify-content:center;align-items:center;gap:9px;padding:38px 0 12px;color:#8c9bb1;text-align:center;font-size:14px;line-height:1.8;letter-spacing:.06em}.wish-wall-footer span{color:#c7b286;font-size:18px}
.wish-wall-page button:focus-visible,.wish-wall-page a:focus-visible,.wish-wall-archive summary:focus-visible{outline:2px solid #edcf91;outline-offset:4px}
.wish-card-pinned{display:inline-block;margin-left:9px;color:#e8d1a0;font-size:12px;letter-spacing:.02em}
@media(min-width:1100px){.wish-wall-experience{padding-inline:15px;gap:72px}.wish-wall-compose{margin-right:10px}}
@media(max-width:900px){.wish-wall-experience{gap:26px}.wish-wall-compose{padding:28px 23px 19px}.wish-wall-music-hint{display:none}}
@media(max-width:700px){.wish-wall-page{padding-right:20px;padding-left:20px}.wish-wall-toolbar-actions{gap:12px}.wish-wall-mark{font-size:9px;letter-spacing:.12em}.wish-wall-hero{padding:30px 0 0}.wish-wall-hero h1{font-size:clamp(26px,6.4vw,34px);letter-spacing:.035em;margin-top:16px}.wish-wall-hero>p{font-size:15px;letter-spacing:.05em}.wish-wall-experience{grid-template-columns:1fr;gap:8px;padding-top:0;padding-bottom:34px}.wish-wall-compose{width:100%;max-width:480px;margin:28px auto 0;padding:28px 24px 20px}.wish-wall-compose h2{font-size:26px}.wish-wall-compose-intro{font-size:16px;margin-bottom:24px}.wish-wall-feed-toolbar{font-size:13px;gap:10px}.wish-wall-refresh{font-size:13px}.wish-wall-archive summary{padding:16px;font-size:17px}.wish-wall-archive summary small{margin-left:6px;font-size:11px}.wish-wall-archive-toggle{font-size:13px;gap:9px}.wish-wall-grid{grid-template-columns:1fr;padding:0 12px 12px}.wish-wall-footer{font-size:13px;letter-spacing:.02em}.wish-compose-star{right:24px}}
@media(max-width:360px){.wish-wall-page{padding-inline:16px}.wish-wall-mark{display:none}.wish-wall-compose{padding-inline:20px}.wish-wall-hero h1{font-size:25px}.wish-wall-feed-toolbar>span{max-width:170px}.wish-wall-archive summary small{display:block;margin:3px 0 0}}
@media(prefers-reduced-motion:reduce){.wish-wall-page *{scroll-behavior:auto!important;transition:none!important}}
</style>
