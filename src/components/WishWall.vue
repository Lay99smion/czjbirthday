<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchWishes, submitWish, wishesApiConfigured } from "../wishesApi";
import { createMemoryFilmMusic } from "../memoryFilmMusic";

defineProps({ homeHref: { type: String, required: true } });

const message = ref("");
const wishes = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const submitError = ref("");
const status = ref("");
const remaining = computed(() => 120 - Array.from(message.value).length);
const music = createMemoryFilmMusic();
const musicOn = ref(false);
const musicHint = ref(false);
let musicRequest = 0;

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
    return "数据库还没有开放祝福墙的读取或提交权限。请先在 Supabase SQL Editor 运行项目中的 supabase/wishes.sql。";
  }
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return "暂时连接不到祝福墙，请检查网络和 Supabase 项目地址。";
  }
  return `操作失败：${text || "请稍后重试。"}`;
}

async function refreshWishes() {
  if (!wishesApiConfigured) return;
  loading.value = true;
  loadError.value = "";
  try {
    wishes.value = await fetchWishes();
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
  status.value = "正在把祝福送往星河…";
  try {
    const wish = await submitWish(content);
    if (wish) wishes.value = [wish, ...wishes.value.filter(item => item.id !== wish.id)].slice(0, 100);
    else await refreshWishes();
    message.value = "";
    status.value = "祝福已送达，所有来访者都能看见。";
  } catch (error) {
    submitError.value = presentError(error);
    status.value = "祝福没有送达，请检查后重试。";
  } finally {
    saving.value = false;
  }
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
        <a :href="homeHref" class="wish-wall-back">← <span>生日星空</span></a>
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
          >
            ♫<i v-if="!musicOn" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <section class="wish-wall-hero">
        <span class="wish-wall-kicker">✦ &nbsp; WISHES IN THE SKY &nbsp; ✦</span>
        <h1>把祝福，<em>留在星河里。</em></h1>
        <p>写下想说的话，让每一份心意都在这里相遇。</p>
      </section>

      <section class="wish-wall-compose" aria-labelledby="wish-wall-form-title">
        <div class="wish-wall-compose-heading">
          <div>
            <span class="wish-wall-section-label">SEND A BLESSING</span>
            <h2 id="wish-wall-form-title">写下一句祝福</h2>
          </div>
          <span class="wish-wall-count">{{ remaining }} 字</span>
        </div>

        <form @submit.prevent="sendWish">
          <label class="sr-only" for="wish-wall-message">你的祝福</label>
          <textarea
            id="wish-wall-message"
            v-model="message"
            maxlength="120"
            rows="3"
            placeholder="愿你每天都有好心情……"
            :disabled="!wishesApiConfigured || saving"
          ></textarea>
          <div class="wish-wall-submit-row">
            <p>提交后会公开展示，请勿填写个人隐私信息。</p>
            <button type="submit" :disabled="!message.trim() || saving || !wishesApiConfigured">
              {{ saving ? "正在送达…" : "送出祝福" }} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>

        <p v-if="!wishesApiConfigured" class="wish-wall-alert" role="status">
          尚未配置 Supabase。复制项目根目录的 <code>.env.example</code> 为 <code>.env.local</code>，填入项目 URL 和 Publishable Key 后重新启动或构建。
        </p>
        <p v-else-if="submitError" class="wish-wall-alert" role="alert">{{ submitError }}</p>
        <p v-else class="wish-wall-status" role="status" aria-live="polite">{{ status }}</p>
      </section>

      <section class="wish-wall-feed" aria-labelledby="wish-wall-feed-title">
        <div class="wish-wall-feed-heading">
          <div>
            <span class="wish-wall-section-label">FROM HEART TO HEART</span>
            <h2 id="wish-wall-feed-title">星河里的祝福 <span>{{ wishes.length }}</span></h2>
          </div>
          <button type="button" class="wish-wall-refresh" :disabled="loading || !wishesApiConfigured" @click="refreshWishes">
            {{ loading ? "加载中…" : "刷新 ↻" }}
          </button>
        </div>

        <p v-if="loadError" class="wish-wall-alert" role="alert">{{ loadError }}</p>
        <p v-else-if="loading && !wishes.length" class="wish-wall-empty">正在收集星河里的祝福…</p>
        <p v-else-if="!wishes.length && wishesApiConfigured" class="wish-wall-empty">还没有祝福，写下第一句，让星河亮起来。</p>
        <div v-else class="wish-wall-grid">
          <article v-for="wish in wishes" :key="wish.id" class="wish-card">
            <span class="wish-card-star" aria-hidden="true">✦</span>
            <p>{{ wish.content }}</p>
            <time :datetime="wish.created_at">{{ formatDate(wish.created_at) }}</time>
          </article>
        </div>
      </section>

      <footer class="wish-wall-footer">每一份祝福，都是夜空里温柔的光。</footer>
    </div>
  </main>
</template>

<style scoped>
.wish-wall-page{position:relative;width:100%;height:100%;min-height:100%;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:max(20px,env(safe-area-inset-top)) 22px max(24px,env(safe-area-inset-bottom));color:#f6f0e5;background:radial-gradient(ellipse at 50% 12%,#202846 0%,#11182d 40%,#090e20 100%)}
.wish-wall-page:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;background-image:radial-gradient(1px 1px at 12% 18%,#fff 98%,transparent),radial-gradient(1px 1px at 81% 27%,#f1d8a7 98%,transparent),radial-gradient(2px 2px at 66% 72%,#fff 98%,transparent),radial-gradient(1px 1px at 28% 83%,#fff 98%,transparent);background-size:240px 260px}
.wish-wall-inner{position:relative;z-index:1;width:min(100%,900px);margin:0 auto}
.wish-wall-glow{position:fixed;z-index:0;width:44vw;height:44vw;max-width:390px;max-height:390px;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:.17}
.wish-wall-glow-one{top:8%;left:-15%;background:#9c80d8}.wish-wall-glow-two{right:-16%;bottom:2%;background:#d1a36f}
.wish-wall-toolbar{display:flex;align-items:center;justify-content:space-between;min-height:44px}
.wish-wall-back{display:inline-flex;align-items:center;gap:8px;color:#e4d4b6;text-decoration:none;font-size:12px;letter-spacing:.04em}.wish-wall-back:hover{color:#fff1ca}
.wish-wall-mark{color:#929bb1;font-size:9px;letter-spacing:.2em}
.wish-wall-toolbar-actions{display:flex;align-items:center;gap:12px}.wish-wall-music{position:relative;display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border:1px solid #e5d7b54a;border-radius:50%;background:#111a33ae;color:#efd99e;font-size:19px;backdrop-filter:blur(8px)}.wish-wall-music i{position:absolute;width:28px;height:2px;border-radius:2px;background:#ffe6ae;box-shadow:0 0 4px #ffe6ae;transform:rotate(-45deg);pointer-events:none}.wish-wall-music-hint{color:#b6c1d4;font-size:9px}
.wish-wall-hero{padding:62px 0 36px;text-align:center}.wish-wall-kicker,.wish-wall-section-label{color:#ddc58f;font-size:9px;font-weight:600;letter-spacing:.2em}
.wish-wall-hero h1{margin:16px 0 9px;font:500 clamp(28px,7vw,44px)/1.45 'Songti SC','Noto Serif SC',serif;letter-spacing:.05em}.wish-wall-hero h1 em{color:#f0d6a4;font-style:normal;text-shadow:0 0 25px #e5c47a4d}.wish-wall-hero>p{margin:0;color:#aeb7c9;font-size:12px;line-height:1.8;letter-spacing:.05em}
.wish-wall-compose{padding:22px;border:1px solid #e3c99238;border-radius:18px;background:linear-gradient(135deg,#1a2440db,#11192ee8);box-shadow:0 18px 55px #0003;backdrop-filter:blur(12px)}
.wish-wall-compose-heading,.wish-wall-feed-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.wish-wall-compose h2,.wish-wall-feed h2{margin:7px 0 14px;font:500 18px/1.5 'Songti SC','Noto Serif SC',serif;letter-spacing:.04em}.wish-wall-count{color:#9ca7bc;font-size:10px;font-variant-numeric:tabular-nums}
.wish-wall-compose textarea{display:block;width:100%;min-height:98px;resize:vertical;border:1px solid #d7c18a3d;border-radius:11px;padding:14px 15px;background:#080f22ad;color:#f8eedb;font-family:inherit;font-size:14px;line-height:1.8;letter-spacing:.02em;outline:none}.wish-wall-compose textarea::placeholder{color:#8b96ac}.wish-wall-compose textarea:focus{border-color:#e4cb91a8;box-shadow:0 0 0 3px #e4cb9112}.wish-wall-compose textarea:disabled{opacity:.55}
.wish-wall-submit-row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px}.wish-wall-submit-row p{margin:0;color:#98a3b8;font-size:10px;line-height:1.7}.wish-wall-submit-row button{flex-shrink:0;min-height:40px;padding:0 17px;border:1px solid #f2dba8;border-radius:30px;background:linear-gradient(110deg,#ecd6a8,#f5e4c1);color:#29283a;font-size:11px;font-weight:600;letter-spacing:.05em}.wish-wall-submit-row button:disabled{opacity:.45;cursor:default}.wish-wall-submit-row button span{margin-left:8px;font-size:16px}
.wish-wall-status,.wish-wall-alert{min-height:1.5em;margin:12px 0 0;font-size:11px;line-height:1.7}.wish-wall-status{color:#b9c7d8}.wish-wall-alert{color:#f1bcb1}.wish-wall-alert code{color:#f7dfb2;font-size:10px}
.wish-wall-feed{padding-top:40px}.wish-wall-feed-heading{margin-bottom:17px}.wish-wall-feed h2{margin-bottom:0}.wish-wall-feed h2 span{display:inline-grid;place-items:center;min-width:23px;height:23px;margin-left:6px;border:1px solid #e1c78c55;border-radius:50%;color:#e6d1a8;font-size:10px;line-height:1;vertical-align:2px}
.wish-wall-refresh{min-height:34px;padding:0 12px;border:1px solid #d8c3924a;border-radius:20px;background:#e3d1a00c;color:#d8c89f;font-size:10px}.wish-wall-refresh:disabled{opacity:.5}
.wish-wall-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wish-card{position:relative;min-height:136px;padding:20px 18px 15px;border:1px solid #d8c18b38;border-radius:14px;background:linear-gradient(145deg,#1b2540c9,#10172bd9);box-shadow:0 9px 26px #0002}.wish-card-star{color:#f2d69c;font-size:13px;text-shadow:0 0 12px #f3d79a8a}.wish-card p{margin:12px 0 18px;color:#f4e9d5;font:14px/1.8 'Songti SC','Noto Serif SC',serif;letter-spacing:.025em;white-space:pre-wrap;overflow-wrap:anywhere}.wish-card time{position:absolute;right:16px;bottom:12px;color:#8994aa;font-size:9px;letter-spacing:.03em}
.wish-wall-empty{padding:24px 16px;border:1px dashed #d8c18b3d;border-radius:14px;color:#a8b2c5;text-align:center;font-size:11px;line-height:1.8}
.wish-wall-footer{padding:40px 0 12px;color:#79849b;text-align:center;font-size:10px;letter-spacing:.08em}
@media(max-width:580px){.wish-wall-page{padding-right:16px;padding-left:16px}.wish-wall-hero{padding:48px 0 27px}.wish-wall-compose{padding:17px}.wish-wall-grid{grid-template-columns:1fr;gap:10px}.wish-card{min-height:115px}.wish-wall-mark{font-size:8px;letter-spacing:.12em}.wish-wall-toolbar-actions{gap:8px}.wish-wall-music-hint{display:none}}
@media(prefers-reduced-motion:reduce){.wish-wall-page *{scroll-behavior:auto!important}}
</style>
