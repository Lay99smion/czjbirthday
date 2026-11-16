<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { assetUrl } from "../assets";

const emit = defineEmits(["active"]);
const audio = ref(null);
const state = ref("idle");
const elapsed = ref(0);
const duration = ref(15);
const active = computed(
  () => state.value === "loading" || state.value === "playing",
);
const progress = computed(() => Math.min(1, elapsed.value / duration.value));
let request = 0;
let reserved = false;
let disposed = false;

function reserveMusic(value) {
  if (reserved === value) return;
  reserved = value;
  emit("active", value);
}
function stop(reset = true) {
  request++;
  audio.value?.pause();
  if (reset) {
    if (audio.value) audio.value.currentTime = 0;
    elapsed.value = 0;
  }
  state.value = "idle";
  reserveMusic(false);
}
function fail() {
  stop();
  state.value = "error";
}
async function toggle() {
  if (active.value) return stop();
  if (!audio.value || disposed) return;
  const current = ++request;
  if (state.value === "error") audio.value.load();
  state.value = "loading";
  // Release the background music before play(), without waiting for a network
  // request and without losing the tap gesture required on mobile browsers.
  reserveMusic(true);
  try {
    await audio.value.play();
    if (disposed || current !== request) return;
    state.value = "playing";
  } catch {
    if (!disposed && current === request) fail();
  }
}
function onPlaying() {
  if (!reserved || disposed) {
    audio.value?.pause();
    return;
  }
  state.value = "playing";
}
function onPause() {
  if (audio.value?.paused && reserved) stop(false);
}
function updateTime() {
  const media = audio.value;
  if (!media) return;
  elapsed.value = Number.isFinite(media.currentTime) ? media.currentTime : 0;
  if (Number.isFinite(media.duration) && media.duration > 0)
    duration.value = media.duration;
}
function formatTime(value) {
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function onVisibility() {
  if (document.hidden && reserved) stop();
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() => {
  disposed = true;
  stop();
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div
    class="letter-audio"
    :class="{ playing: state === 'playing' }"
    @touchstart.stop
    @touchend.stop
  >
    <audio
      ref="audio"
      class="letter-audio-media"
      :src="assetUrl('/蜡笔小新.m4a')"
      preload="none"
      @playing="onPlaying"
      @pause="onPause"
      @ended="stop()"
      @error="fail"
      @timeupdate="updateTime"
      @loadedmetadata="updateTime"
    ></audio>
    <button
      class="letter-audio-button"
      type="button"
      :aria-label="active ? '停止播放小新的祝福' : '播放小新的祝福'"
      :aria-pressed="active"
      @click.stop="toggle"
    >
      <span class="letter-audio-icon" aria-hidden="true">{{
        active ? "■" : "▶"
      }}</span>
      <span class="letter-audio-copy">
        <strong>{{
          active ? "小新的祝福，正在送达" : "听听小新的生日祝福"
        }}</strong>
        <small>{{
          state === "loading"
            ? "正在准备声音… · 点击可停止"
            : active
              ? "点击停止播放"
              : "它也想给你说生日快乐呢！"
        }}</small>
      </span>
      <span class="letter-audio-time" aria-hidden="true"
        >{{ formatTime(elapsed) }} / {{ formatTime(Math.ceil(duration)) }}</span
      >
    </button>
    <span class="letter-audio-progress" aria-hidden="true"
      ><i :style="{ transform: `scaleX(${progress})` }"></i
    ></span>
    <p v-if="state === 'error'" class="letter-audio-error" role="status">
      声音暂时没能送达，点一下再试试。
    </p>
  </div>
</template>
