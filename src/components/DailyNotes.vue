<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { dailyNotesApiConfigured, fetchDailyNotes } from "../dailyNotesApi";

const entries = ref([]);
const selectedId = ref("");
const loading = ref(false);
const loadError = ref("");
const hasMore = ref(false);
const heading = ref(null);
const currentIndex = computed(() => entries.value.findIndex((entry) => String(entry.id) === selectedId.value));
const current = computed(() => entries.value[currentIndex.value] ?? null);
let controller = null;
let disposed = false;

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function optionLabel(entry) {
  const date = formatDate(entry.date);
  if (entries.value.filter((note) => note.date === entry.date).length < 2) return date;
  const preview = entry.content.trim().replace(/\s+/g, " ");
  return `${date} · ${Array.from(preview).slice(0, 14).join("")}${Array.from(preview).length > 14 ? '…' : ''}`;
}

async function load(append = false) {
  if (loading.value || disposed) return;
  loading.value = true;
  loadError.value = "";
  controller = new AbortController();
  try {
    if (!dailyNotesApiConfigured) throw new Error("尚未连接");
    const before = append ? entries.value[entries.value.length - 1] : undefined;
    const rows = await fetchDailyNotes({ before, signal: controller.signal });
    if (disposed) return;
    const selected = selectedId.value;
    const combined = append ? [...entries.value, ...rows] : rows;
    entries.value = [...new Map(combined.map((row) => [String(row.id), row])).values()];
    hasMore.value = rows.length === 20;
    selectedId.value = entries.value.some((row) => String(row.id) === selected)
      ? selected : String(entries.value[0]?.id ?? "");
  } catch (error) {
    if (!disposed && error.name !== "AbortError") loadError.value = "暂时没能翻开这些日常，请稍后再试。";
  } finally {
    if (!disposed) loading.value = false;
  }
}

async function turnTo(index) {
  const entry = entries.value[index];
  if (!entry) return;
  selectedId.value = String(entry.id);
  await nextTick();
  heading.value?.focus({ preventScroll: true });
  heading.value?.scrollIntoView({ block: "nearest" });
}

async function loadEarlier() {
  const previousCount = entries.value.length;
  await load(true);
  if (entries.value.length > previousCount) turnTo(previousCount);
}

onMounted(() => load());
onBeforeUnmount(() => { disposed = true; controller?.abort(); });
</script>

<template>
  <div class="daily-notes" :aria-busy="loading">
    <div class="daily-notes-toolbar">
      <p>很小的事，也想说给你听。</p>
      <button type="button" :disabled="loading" @click="load()">{{ loading ? '正在翻开…' : '看看新日常' }}</button>
    </div>

    <div v-if="entries.length" class="daily-notes-picker">
      <label for="daily-note-date">翻到这一天</label>
      <select id="daily-note-date" v-model="selectedId" @change="turnTo(currentIndex)">
        <option v-for="entry in entries" :key="entry.id" :value="String(entry.id)">{{ optionLabel(entry) }}</option>
      </select>
    </div>

    <p v-if="loadError" class="daily-notes-message daily-notes-error" role="alert">{{ loadError }}<button type="button" :disabled="loading" @click="load()">重试</button></p>
    <p v-else-if="loading && !entries.length" class="daily-notes-message" role="status">正在翻开我的日常…</p>
    <div v-else-if="!entries.length" class="daily-notes-empty">
      <span aria-hidden="true">✧</span>
      <p>第一篇碎碎念，还在路上。</p>
      <small>等我把今天的小事，慢慢写给你。</small>
    </div>

    <article v-if="current" class="daily-note-entry" :key="current.id" aria-labelledby="daily-note-heading">
      <header>
        <span class="daily-note-mark" aria-hidden="true">✦</span>
        <h3 ref="heading" id="daily-note-heading" tabindex="-1"><time :datetime="current.date">{{ formatDate(current.date) }}</time></h3>
      </header>
      <div class="daily-note-content">{{ current.content }}</div>
      <p class="daily-note-signature">今天就先写到这里。</p>
    </article>

    <nav v-if="entries.length" class="daily-notes-navigation" aria-label="翻阅我的碎碎念">
      <button type="button" :disabled="currentIndex <= 0" @click="turnTo(currentIndex - 1)">晚一点的日常</button>
      <span>{{ currentIndex + 1 }} / {{ entries.length }}</span>
      <button v-if="currentIndex < entries.length - 1" type="button" @click="turnTo(currentIndex + 1)">早一点的日常</button>
      <button v-else-if="hasMore" type="button" :disabled="loading" @click="loadEarlier">{{ loading ? '正在翻找…' : '更早的日常' }}</button>
      <button v-else type="button" disabled>已经是第一篇</button>
    </nav>
  </div>
</template>

<style scoped>
.daily-notes{min-width:0;text-align:left}
.daily-notes-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid #ac8c6533}
.daily-notes-toolbar p{margin:0;color:#8a7058;font-size:14px;line-height:1.8}
.daily-notes button{min-height:44px;padding:9px 12px;border:1px solid #aa8b6340;border-radius:8px;background:#fff8eb88;color:#795b40;font:inherit;font-size:14px;cursor:pointer}
.daily-notes button:disabled{opacity:.4;cursor:default}.daily-notes button:hover:not(:disabled){background:#fffaf1}.daily-notes button:focus-visible,.daily-notes select:focus-visible{outline:2px solid #9e7950;outline-offset:3px}
.daily-notes-picker{display:flex;align-items:center;gap:12px;margin:20px 0 0}.daily-notes-picker label{flex-shrink:0;color:#8d7357;font-size:14px}
.daily-notes-picker select{min-width:0;width:100%;min-height:44px;padding:9px 12px;border:1px solid #b795653b;border-radius:8px;background:#fff8ed;color:#694f3b;font:inherit;font-size:15px}
.daily-note-entry{padding:27px 0 14px;min-width:0}.daily-note-entry header{display:flex;align-items:baseline;gap:12px;margin-bottom:24px}
.daily-note-mark{color:#ac8557;font-size:17px}.daily-note-entry h3{margin:0;color:#6b4c35;font:400 clamp(17px,3.8vw,21px)/1.8 'Songti SC','Noto Serif SC',serif;letter-spacing:.035em}
.daily-note-content{white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;color:#624e3e;font:400 17px/2.15 'Songti SC','Noto Serif SC',serif;letter-spacing:.025em;tab-size:2}
.daily-note-signature{margin:32px 0 5px;color:#9c8268;font-size:14px;line-height:1.8;text-align:right}
.daily-notes-navigation{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding-top:20px;border-top:1px solid #ac8c6533}.daily-notes-navigation span{color:#9a8065;font-size:14px;font-variant-numeric:tabular-nums}
.daily-notes-message{padding:25px 0;color:#8a7058;font-size:15px;line-height:1.9}.daily-notes-error button{display:block;margin-top:12px}
.daily-notes-empty{padding:38px 0 42px;text-align:center;color:#8a7058}.daily-notes-empty>span{font-size:32px;color:#b59568}.daily-notes-empty p{margin:18px 0 9px;font:20px/1.9 'Songti SC',serif}.daily-notes-empty small{font-size:14px;line-height:1.9}
@media(max-width:420px){.daily-notes-toolbar{gap:8px}.daily-notes-toolbar p{max-width:10em}.daily-notes-toolbar button{flex-shrink:0;padding-inline:9px}.daily-notes-picker{flex-direction:column;align-items:stretch;gap:8px}.daily-notes-navigation{gap:7px}.daily-notes-navigation button{padding-inline:7px;font-size:13px}.daily-note-content{font-size:16px;line-height:2.1}}
</style>
