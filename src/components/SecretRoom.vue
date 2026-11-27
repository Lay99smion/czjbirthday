<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { createBackgroundMusic } from '../backgroundMusic';
import DailyNotes from './DailyNotes.vue';

defineProps({ name: String, homeHref: String, characterSrc: String });

// 小新的悄悄话和「下次一起」提议；每日碎碎念从独立数据表读取。
const whispers = [
  '大哥，居然被你找到这里了！',
  '今天你最大，蛋糕可以多吃一口。',
  '累了就来这里坐坐，小弟一直都在。',
  '下次见面，还要听你讲好多好多事。',
  '生日快乐这句话，说多少次都不嫌多。',
];
const promises = [
  { mark: '🏸', title: '打场羽毛球', note: '输赢先放一边，痛痛快快出一身汗。', ending: '球场见，大哥。' },
  { mark: '🌄', title: '看一次落日', note: '找个不用赶时间的傍晚，一起等太阳慢慢落下。', ending: '那天，我们慢慢走。' },
  { mark: '🍜', title: '好好吃顿饭', note: '找一家想吃的店，边吃边聊，把最近的故事补上。', ending: '见面的事，慢慢安排。' },
];
const active = ref(null);
const whisperIndex = ref(0);
const promiseIndex = ref(0);
const closeButton = ref(null);
const inspector = ref(null);
const currentPromise = computed(() => promises[promiseIndex.value]);
const music = createBackgroundMusic('/flowers.mp3');
const musicEnabled = ref(true);
const musicPlaying = ref(false);
const musicGestures = ['pointerdown', 'touchend', 'keydown'];
let musicRequest = 0;
let disposed = false;
let leaving = false;
let returnFocus = null;

async function startMusic() {
  if (!musicEnabled.value || disposed || leaving || document.hidden) return;
  const request = ++musicRequest;
  try {
    const playing = await music.start();
    if (request === musicRequest && !disposed) musicPlaying.value = playing;
  } catch {
    if (request === musicRequest && !disposed) musicPlaying.value = false;
  }
}

function pauseMusic() {
  musicRequest++;
  music.pause();
  musicPlaying.value = false;
}

function toggleMusic() {
  if (musicPlaying.value) {
    musicEnabled.value = false;
    pauseMusic();
  } else {
    musicEnabled.value = true;
    startMusic();
  }
}

function unlockMusic(event) {
  if (!musicPlaying.value && !event.target.closest?.('.room-music')) startMusic();
}

function onMusicVisibility() {
  if (document.hidden) pauseMusic();
  else startMusic();
}

function onPageHide() { leaving = true; pauseMusic(); }
function onPageShow() { leaving = false; startMusic(); }

onMounted(() => {
  startMusic();
  for (const event of musicGestures)
    document.addEventListener(event, unlockMusic, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onMusicVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
});
onBeforeUnmount(() => {
  disposed = true;
  pauseMusic();
  music.dispose();
  for (const event of musicGestures) document.removeEventListener(event, unlockMusic, true);
  document.removeEventListener('visibilitychange', onMusicVisibility);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
});

async function inspect(object, event) {
  returnFocus = event.currentTarget;
  active.value = object;
  await nextTick();
  closeButton.value?.focus({ preventScroll: true });
}

async function close() {
  active.value = null;
  await nextTick();
  returnFocus?.focus({ preventScroll: true });
}

function nextWhisper() {
  whisperIndex.value = (whisperIndex.value + 1) % whispers.length;
}

function turnPage(direction) {
  promiseIndex.value = Math.max(0, Math.min(promises.length - 1, promiseIndex.value + direction));
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const stops = [...inspector.value.querySelectorAll('button:not([disabled]), a[href], select:not([disabled])')];
  const index = stops.indexOf(document.activeElement);
  if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === stops.length - 1)) {
    event.preventDefault();
    stops[event.shiftKey ? stops.length - 1 : 0]?.focus();
  }
}
</script>

<template>
  <section class="secret-room" aria-labelledby="room-title" @touchstart.stop @touchend.stop>
    <div class="room-layout" :inert="!!active">
      <nav class="room-toolbar" aria-label="隐藏房间导航">
        <a class="room-back" :href="homeHref">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 4.5A8.5 8.5 0 1 0 19.5 18 8.8 8.8 0 0 1 17.5 4.5Z" /></svg>
          返回生日夜空
        </a>
        <div class="room-toolbar-actions">
          <span>给{{ name }}的隐藏后记</span>
          <button class="room-music" type="button" :aria-label="musicPlaying ? '暂停背景音乐' : '播放背景音乐'" :aria-pressed="musicPlaying" :title="musicPlaying ? '暂停背景音乐' : '播放背景音乐'" @click="toggleMusic">
            <span aria-hidden="true">♫</span><i v-if="!musicPlaying" aria-hidden="true"></i>
          </button>
        </div>
      </nav>

      <header class="room-heading">
        <span class="room-eyebrow">留一盏灯，等你来</span>
        <h1 id="room-title">你找到这里啦。</h1>
        <p>灯还亮着，进来坐一会儿。</p>
      </header>

      <div class="room-scene" role="group" aria-label="星空下的小房间，桌上有小新、约定册和日记本，可以逐个打开">
        <div class="room-wall-light" aria-hidden="true"></div>
        <div class="room-window" aria-hidden="true">
          <div class="room-moon"></div>
          <i v-for="star in 22" :key="star" class="room-window-star" :style="{ left: `${7 + (star * 37) % 87}%`, top: `${8 + (star * 23) % 78}%`, '--delay': `${star * -.43}s`, '--size': star % 5 === 0 ? '3px' : '2px' }"></i>
          <div class="room-shooting-star"></div>
          <div class="room-hills room-hills-far"></div>
          <div class="room-hills"></div>
          <div class="room-window-bars"></div>
        </div>
        <div class="room-window-sill" aria-hidden="true"></div>
        <span class="room-wall-note" aria-hidden="true">窗外是宇宙<br />这里有个位置，留给你。</span>

        <div class="room-light-cone" aria-hidden="true"></div>
        <svg class="room-lamp" viewBox="0 0 180 240" aria-hidden="true">
          <ellipse cx="90" cy="225" rx="52" ry="9" fill="#090d1b" opacity=".45" />
          <path d="M90 92V205" stroke="#b69668" stroke-width="7" />
          <path d="M54 213Q90 195 126 213L130 221H50Z" fill="#b7925e" />
          <ellipse cx="90" cy="95" rx="22" ry="13" fill="#fff0b7" />
          <path d="M54 23H126L149 91Q90 115 31 91Z" fill="#d4b887" stroke="#efd6a2" stroke-width="2" />
          <path d="M66 25L54 94M90 25V100M114 25L126 94" stroke="#ae8b58" opacity=".55" />
          <path d="M136 96V126" stroke="#c5a26c" stroke-width="2" /><circle cx="136" cy="130" r="3" fill="#f0d4a0" />
        </svg>

        <div class="room-floor" aria-hidden="true"></div>
        <div class="room-desk-leg room-desk-leg-left" aria-hidden="true"></div>
        <div class="room-desk-leg room-desk-leg-right" aria-hidden="true"></div>
        <div class="room-desk" aria-hidden="true"></div>

        <div class="room-objects">
          <button class="room-object room-object-toy" type="button" aria-label="点开小新，听听他的悄悄话" aria-haspopup="dialog" @click="inspect('toy', $event)">
            <span class="room-object-art room-toy-art" aria-hidden="true">
              <span class="room-toy-stand"></span>
              <img :src="characterSrc" alt="" draggable="false" />
              <i class="room-object-spark"></i>
              <i class="room-object-spark room-object-spark-secondary"></i>
            </span>
            <span class="room-object-label">小新悄悄说</span>
          </button>

          <button class="room-object room-object-book" type="button" aria-label="打开约定册，翻翻下次一起的提议" aria-haspopup="dialog" @click="inspect('book', $event)">
            <span class="room-object-art" aria-hidden="true">
              <svg class="room-book-art" viewBox="0 0 150 170">
                <path d="M29 15L126 23V150L27 143Z" fill="#cfc0a3" stroke="#46313c" stroke-width="2" />
                <path d="M24 11L121 19V145L24 137Q17 135 17 127V19Q17 11 24 11Z" fill="#945d6b" stroke="#bb8b89" stroke-width="2" />
                <path d="M29 12V137M35 29L106 35V124L35 118Z" fill="none" stroke="#d3ac82" stroke-width="1" />
                <path d="M72 43L75 52L84 55L75 58L72 67L69 58L60 55L69 52Z" fill="#f3d7a6" />
                <text x="72" y="91" text-anchor="middle" fill="#ffe7c1" font-family="'Songti SC',serif" font-size="17">下次一起</text>
                <path d="M61 143V160L67 155L73 161V144" fill="#deb976" />
              </svg>
              <i class="room-object-spark"></i>
              <i class="room-object-spark room-object-spark-secondary"></i>
            </span>
            <span class="room-object-label">约定册</span>
          </button>

          <button class="room-object room-object-journal" type="button" aria-label="翻开我的碎碎念，看看每天的日常" aria-haspopup="dialog" @click="inspect('diary', $event)">
            <span class="room-object-art" aria-hidden="true">
              <svg class="room-journal-art" viewBox="0 0 150 170">
                <path d="M31 23L130 29L125 157L26 150Z" fill="#8197a5" stroke="#b6c9cb" stroke-width="2" />
                <path d="M22 14L119 20L115 147L18 141Z" fill="#d5e1df" stroke="#b6cece" stroke-width="2" />
                <path d="M30 23L111 28L107 135L26 130Z" fill="#f4edda" />
                <path d="M41 17L39 34M62 18L60 35M83 19L81 36M104 21L102 38" stroke="#a17f57" stroke-width="3" stroke-linecap="round" />
                <path d="M46 51H92M42 107H92M42 117H81" stroke="#b5b3a3" stroke-width="2" stroke-linecap="round" />
                <text x="70" y="77" text-anchor="middle" fill="#647d81" font-family="'Songti SC',serif" font-size="14">我的</text>
                <text x="69" y="96" text-anchor="middle" fill="#647d81" font-family="'Songti SC',serif" font-size="16">碎碎念</text>
                <path d="M108 111L111 120L120 123L111 126L108 135L105 126L96 123L105 120Z" fill="#b9955f" />
              </svg>
              <i class="room-object-spark"></i>
              <i class="room-object-spark room-object-spark-secondary"></i>
            </span>
            <span class="room-object-label">我的碎碎念</span>
          </button>
        </div>
        <p class="room-scene-caption">三件小东西，藏着一点心意。</p>
      </div>

      <footer class="room-footer">
        <span aria-hidden="true">✦</span>
        <p>生日这一天会结束，<br /><em>我们的故事还长。</em></p>
        <small>下次见，我们慢慢续。</small>
      </footer>
    </div>

    <Transition name="room-inspect">
      <div v-if="active" class="room-inspector" @click.self="close" @keydown="onKeydown" @touchstart.stop @touchend.stop>
        <section ref="inspector" class="room-note" :class="`room-note-${active}`" role="dialog" aria-modal="true" aria-labelledby="room-note-title">
          <button ref="closeButton" class="room-note-close" type="button" aria-label="收起，放回桌上" @click="close">×</button>

          <template v-if="active === 'toy'">
            <span class="room-note-eyebrow">一位小小的秘密守门员</span>
            <h2 id="room-note-title">小新有话说。</h2>
            <img class="room-toy-portrait" :src="characterSrc" alt="动感超人装扮的小新" />
            <p class="room-whisper" aria-live="polite">{{ whispers[whisperIndex] }}</p>
            <button class="room-action" type="button" @click="nextWhisper">再说一句</button>
          </template>

          <template v-else-if="active === 'book'">
            <span class="room-note-eyebrow">留给下次见面</span>
            <h2 id="room-note-title">下次一起……</h2>
            <div class="room-promise-page" aria-live="polite" aria-atomic="true">
              <span class="room-promise-mark" aria-hidden="true">{{ currentPromise.mark }}</span>
              <h3>{{ currentPromise.title }}</h3>
              <p>{{ currentPromise.note }}</p>
              <span class="room-promise-ending">{{ currentPromise.ending }}</span>
            </div>
            <nav class="room-page-controls" aria-label="翻阅约定册">
              <button type="button" :disabled="promiseIndex === 0" @click="turnPage(-1)">上一页</button>
              <span>{{ promiseIndex + 1 }} / {{ promises.length }}</span>
              <button type="button" :disabled="promiseIndex === promises.length - 1" @click="turnPage(1)">下一页</button>
            </nav>
            <p class="room-promise-hint">先写下几个提议，等见面时慢慢选。</p>
          </template>

          <template v-else-if="active === 'diary'">
            <header class="room-diary-heading">
              <h2 id="room-note-title">我的碎碎念</h2>
            </header>
            <div class="room-diary-reading"><DailyNotes /></div>
          </template>

          <button class="room-put-back" type="button" @click="close">放回桌上</button>
        </section>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.secret-room{position:absolute;inset:0;z-index:2;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:24px 24px max(30px,calc(env(safe-area-inset-bottom) + 20px));background:radial-gradient(ellipse at 50% 40%,#27304980,transparent 65%),linear-gradient(160deg,#131c32,#090f21 76%);color:#f3e7d1;touch-action:pan-y}
.room-layout{width:min(100%,940px);margin:0 auto}
.room-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;color:#aab3c4;font-size:13px}
.room-toolbar-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-width:0}.room-toolbar-actions>span{text-align:right;line-height:1.6}
.room-music{position:relative;display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;padding:0;border:1px solid #d6b78440;border-radius:50%;background:#172137aa;color:#e6d3ae;font:inherit;font-size:20px;line-height:1;touch-action:manipulation}.room-music:hover{background:#263047;color:#fff1d1}.room-music:focus-visible{outline:2px solid #f5d79c;outline-offset:3px}.room-music i{position:absolute;width:25px;height:1.5px;border-radius:2px;background:currentColor;transform:rotate(-45deg);pointer-events:none}
.room-back{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:#e6d3ae;font-size:14px;text-decoration:none;white-space:nowrap}
.room-back svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.2}
.room-back:hover{color:#fff1d1}
.room-heading{margin:26px 0 28px;text-align:center;animation:roomArrive .9s both}
.room-eyebrow{color:#d0b589;font-size:13px;letter-spacing:.2em}
.room-heading h1{margin:14px 0 12px;font:400 clamp(30px,5.8vw,42px)/1.5 'Songti SC','Noto Serif SC',serif;letter-spacing:.08em;color:#fff0d3}
.room-heading p{margin:0;color:#b5bfd1;font-size:16px;line-height:1.8;letter-spacing:.04em}
.room-scene{position:relative;height:490px;isolation:isolate;border:1px solid #d6b78426;border-radius:28px;overflow:hidden;background:linear-gradient(110deg,#202a3d,#252b3c 50%,#31303c);box-shadow:0 24px 70px #03081766,inset 0 1px #fff1;animation:roomArrive 1.2s .12s both}
.room-scene:after{content:'';position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(ellipse at 50% 40%,transparent 40%,#060b1e55);border-radius:inherit}
.room-wall-light{position:absolute;inset:0;background:radial-gradient(ellipse at 82% 58%,#c79b5d35,transparent 58%);animation:roomLampOn 1.8s .25s both}
.room-window{position:absolute;left:11%;top:9%;width:43%;height:48%;overflow:hidden;border:8px solid #3a4354;border-radius:140px 140px 7px 7px;background:linear-gradient(#0b122b,#243150);box-shadow:0 0 0 1px #b0b6c53d,0 0 0 9px #10172c40,inset 0 0 32px #0005}
.room-window:before{content:'';position:absolute;inset:0;background:linear-gradient(125deg,#f8eac805,transparent 40%,#91b5d70b 60%,transparent);z-index:2}
.room-moon{position:absolute;top:19%;right:19%;width:34px;height:34px;border-radius:50%;background:#f2ddb0;box-shadow:0 0 25px #e8d2a92b}
.room-moon:after{content:'';position:absolute;left:11px;top:-6px;width:32px;height:32px;border-radius:50%;background:#131d36}
.room-window-star{position:absolute;width:var(--size);height:var(--size);border-radius:50%;background:#eee6ce;box-shadow:0 0 5px #e1e5ed66;animation:roomTwinkle 4.8s var(--delay) ease-in-out infinite}
.room-shooting-star{position:absolute;top:24%;left:-25%;width:55px;height:1px;background:linear-gradient(90deg,transparent,#fff0ca);opacity:0;rotate:24deg;animation:roomShootingStar 12s 3s linear infinite}
.room-hills{position:absolute;bottom:-16%;left:-20%;width:145%;height:42%;border-radius:50% 55% 0 0;rotate:-8deg;background:#182b39}
.room-hills-far{bottom:-6%;left:-30%;background:#2b3d51;rotate:13deg;opacity:.7}
.room-window-bars{position:absolute;inset:0;z-index:3;background:linear-gradient(90deg,transparent calc(50% - 2px),#3a4354 calc(50% - 2px),#3a4354 calc(50% + 2px),transparent calc(50% + 2px)),linear-gradient(transparent 68%,#3a4354 68%,#3a4354 calc(68% + 4px),transparent calc(68% + 4px))}
.room-window-sill{position:absolute;left:9.5%;top:57%;width:46%;height:10px;border-radius:2px;background:linear-gradient(#85818a,#4d5263);box-shadow:0 9px 14px #0c122b55}
.room-wall-note{position:absolute;top:13%;right:7%;width:26%;color:#c9baaa;font:13px/1.9 'Songti SC',serif;letter-spacing:.08em;text-align:center;rotate:3deg}
.room-lamp{position:absolute;z-index:2;right:7%;bottom:29%;width:min(28%,180px);height:auto;max-height:45%;filter:drop-shadow(8px 10px 9px #0a0e1d55)}
.room-light-cone{position:absolute;right:1%;bottom:24%;width:43%;height:39%;background:linear-gradient(#f4d79c40,#e0b16d08);clip-path:polygon(37% 0,63% 0,100% 100%,0 100%);filter:blur(9px);animation:roomLampOn 1.8s .25s both}
.room-floor{position:absolute;inset:76% 0 0;border-top:1px solid #bda2831a;background:linear-gradient(#191e2c,#111927)}
.room-desk{position:absolute;z-index:2;left:5%;right:5%;bottom:20%;height:9%;border-top:2px solid #c09b75;border-bottom:9px solid #513b37;border-radius:5px;background:linear-gradient(95deg,#745344,#9b7859 53%,#73513f);box-shadow:0 18px 32px #080d1e66;transform:perspective(650px) rotateX(25deg);transform-origin:center bottom}
.room-desk:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(3deg,transparent 0 12px,#e8c08a0d 13px,transparent 14px 25px)}
.room-desk-leg{position:absolute;z-index:1;bottom:0;width:12px;height:22%;background:linear-gradient(90deg,#624436,#382c2b);rotate:3deg}
.room-desk-leg-left{left:14%}.room-desk-leg-right{right:14%;rotate:-3deg}
.room-objects{position:absolute;z-index:4;left:7%;right:7%;bottom:20%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:clamp(8px,4vw,48px)}
.room-object{--object-delay:0s;--spark-top:9%;--spark-right:20%;display:flex;flex-direction:column;align-items:center;min-width:0;min-height:44px;padding:0;border:0;border-radius:12px;background:transparent;color:#f8e3ba;touch-action:manipulation}
.room-object-book{--object-delay:-2s;--spark-top:2%;--spark-right:12%}.room-object-journal{--object-delay:-4s;--spark-top:16%;--spark-right:4%}
.room-object-art{position:relative;isolation:isolate;display:block;width:100%;height:156px;transition:translate .25s;filter:drop-shadow(0 7px 6px #080c1b66);pointer-events:none;animation:roomObjectGlow 6s var(--object-delay) ease-in-out infinite}
.room-object-art:before{content:'';position:absolute;z-index:-1;inset:10% 5% -4%;border-radius:50%;background:radial-gradient(ellipse,#ffe3a15c,transparent 68%);filter:blur(7px);opacity:.12;animation:roomObjectAura 6s var(--object-delay) ease-in-out infinite}
.room-object:hover .room-object-art,.room-object:focus-visible .room-object-art{animation:none;translate:0 -7px;filter:drop-shadow(0 0 4px #fff0bd99) drop-shadow(0 0 13px #f2c37199)}
.room-object:active .room-object-art{translate:0 -2px}
.room-object:focus-visible{outline:2px solid #f5d79c;outline-offset:7px}
.room-object-label{position:relative;display:block;margin-top:9px;padding:5px 0;color:#f1ddbd;font-size:14px;line-height:1.6;letter-spacing:.04em;text-shadow:0 2px 5px #1a1421;white-space:nowrap}
.room-toy-art img{position:absolute;left:50%;bottom:2px;width:240px;max-width:none;height:165px;object-fit:contain;transform:translateX(-50%);filter:drop-shadow(0 8px 5px #07102366)}
.room-toy-stand{position:absolute;bottom:-1px;left:50%;width:78px;height:11px;border-radius:50%;background:linear-gradient(#b99364,#64503e);transform:translateX(-50%);box-shadow:0 5px 7px #07102366}
.room-book-art{display:block;width:135px;height:156px;max-width:100%;margin:0 auto;rotate:-8deg;translate:0 10px}
.room-journal-art{display:block;width:138px;height:156px;max-width:100%;margin:0 auto;rotate:6deg;translate:0 10px}
.room-object-spark{position:absolute;z-index:2;top:var(--spark-top);right:var(--spark-right);width:17px;height:24px;background:#fff8da;clip-path:polygon(50% 0,62% 39%,100% 50%,62% 61%,50% 100%,38% 61%,0 50%,38% 39%);filter:drop-shadow(0 0 7px #ffdb92);animation:roomObjectSpark 6s var(--object-delay) ease-in-out infinite}
.room-object-spark-secondary{top:52%;right:auto;left:8%;width:11px;height:16px;animation-delay:calc(var(--object-delay) + .25s)}
.room-scene-caption{position:absolute;z-index:6;left:12px;right:12px;bottom:16px;margin:0;color:#c4b9b3;font-size:13px;line-height:1.8;text-align:center;letter-spacing:.08em}
.room-footer{padding:30px 12px 0;text-align:center;animation:roomArrive 1s .3s both}
.room-footer>span{color:#cbb185;font-size:17px}
.room-footer p{margin:15px 0 13px;color:#e7dfd4;font:400 clamp(19px,3.7vw,24px)/1.9 'Songti SC','Noto Serif SC',serif;letter-spacing:.07em}
.room-footer em{color:#f1d4a0;font-style:normal}
.room-footer small{color:#99a7bc;font-size:13px;letter-spacing:.08em}

.room-inspector{position:fixed;inset:0;z-index:45;display:grid;place-items:center;padding:22px;background:#050a1b9c;backdrop-filter:blur(7px)}
.room-note{position:relative;width:min(100%,410px);max-height:calc(100dvh - 44px);overflow-y:auto;overscroll-behavior:contain;padding:34px 25px 22px;border:1px solid #f5e6c98c;border-radius:5px 22px 22px 22px;background:linear-gradient(135deg,#fff5e2,#ecdec4);box-shadow:0 24px 90px #01061266,inset 0 0 30px #baa48212;color:#594539;text-align:center}
.room-note-close{position:absolute;z-index:2;right:5px;top:5px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:#8e725c;font-size:26px}
.room-note-close:hover{background:#a7855d12;color:#473327}
.room-note-eyebrow{display:block;margin-right:10px;color:#8d7351;font-size:13px;line-height:1.8;letter-spacing:.08em}
.room-note h2{margin:12px 0 18px;font:400 28px/1.5 'Songti SC','Noto Serif SC',serif;letter-spacing:.04em;color:#513e35}
.room-note button:focus-visible{outline:2px solid #977046;outline-offset:4px}
.room-toy-portrait{display:block;width:240px;max-width:100%;height:145px;object-fit:contain;margin:3px auto 0;filter:drop-shadow(0 9px 5px #6c4b332b)}
.room-whisper{position:relative;margin:12px 0 22px;padding:20px 18px;border:1px solid #b7956438;border-radius:16px 16px 16px 3px;background:#fffbf0;color:#664b39;font:400 20px/1.8 'Songti SC','Noto Serif SC',serif;letter-spacing:.025em}
.room-action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;min-width:146px;padding:10px 25px;border:1px solid #9a7452;border-radius:24px;background:#846247;color:#fff1d9;font-size:15px;letter-spacing:.05em}
.room-action:hover{background:#715039}
.room-put-back{display:block;min-height:44px;margin:13px auto 0;padding:10px 14px;border:0;background:transparent;color:#8b7058;font-size:14px;letter-spacing:.06em}
.room-put-back:hover{color:#473327}
.room-note-book{border-left:7px solid #93616a;border-radius:5px 14px 14px 5px;background:linear-gradient(90deg,#c4ab8633,transparent 25px),linear-gradient(135deg,#fff6e5,#eddfc6)}
.room-promise-page{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;padding:12px 5px 23px;border-top:1px solid #b7976938;border-bottom:1px solid #b7976938}
.room-promise-mark{display:block;font-size:42px;line-height:1.4}
.room-promise-page h3{margin:15px 0 12px;font:400 29px/1.6 'Songti SC','Noto Serif SC',serif;color:#624937}
.room-promise-page p{max-width:22ch;margin:0;color:#79604c;font-size:16px;line-height:1.9}
.room-promise-ending{display:block;margin-top:21px;color:#9a7a57;font:italic 15px/1.8 'Songti SC',serif}
.room-page-controls{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;margin-top:20px}
.room-page-controls button{min-height:44px;padding:8px 10px;border:1px solid #ae8e693d;border-radius:7px;background:#ae896111;color:#775739;font-size:14px}
.room-page-controls button:hover:not(:disabled){background:#ae896122}
.room-page-controls button:disabled{opacity:.35;cursor:default}
.room-page-controls>span{color:#9b7e61;font-size:13px;font-variant-numeric:tabular-nums}
.room-promise-hint{margin:15px 0 0;color:#9a8067;font-size:13px;line-height:1.8}
.room-note-diary{display:flex;flex-direction:column;width:min(100%,680px);overflow:hidden;padding:30px 26px 10px;text-align:left}
.room-diary-heading{flex-shrink:0;padding-right:20px}.room-note-diary .room-diary-heading h2{margin:0 0 16px;font-size:22px;line-height:1.5;letter-spacing:.05em}
.room-diary-reading{min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:0 5px 10px;scrollbar-width:thin}
.room-note-diary>.room-put-back{flex-shrink:0;margin-top:3px}
.room-inspect-enter-active,.room-inspect-leave-active{transition:opacity .25s}
.room-inspect-enter-active .room-note,.room-inspect-leave-active .room-note{transition:transform .3s}
.room-inspect-enter-from,.room-inspect-leave-to{opacity:0}
.room-inspect-enter-from .room-note,.room-inspect-leave-to .room-note{transform:translateY(16px) scale(.97)}

@keyframes roomArrive{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@keyframes roomLampOn{from{opacity:0}to{opacity:1}}
@keyframes roomTwinkle{0%,100%{opacity:.25}50%{opacity:.8}}
@keyframes roomObjectGlow{0%,4%,34%,100%{filter:drop-shadow(0 7px 6px #080c1b66) drop-shadow(0 0 1px #f4ce8a00) brightness(1)}17%{filter:drop-shadow(0 0 4px #fff0bdcc) drop-shadow(0 0 16px #f2c371b3) brightness(1.25)}24%{filter:drop-shadow(0 0 2px #fff0bd80) drop-shadow(0 0 10px #f2c37166) brightness(1.1)}}
@keyframes roomObjectAura{0%,4%,34%,100%{opacity:.12;transform:scale(.9)}17%{opacity:.85;transform:scale(1.12)}24%{opacity:.5;transform:scale(1)}}
@keyframes roomObjectSpark{0%,4%,34%,100%{opacity:.3;transform:scale(.6) rotate(0)}17%{opacity:1;transform:scale(1.3) rotate(12deg)}24%{opacity:.7;transform:scale(.9) rotate(0)}}
@keyframes roomShootingStar{0%,80%,100%{opacity:0;transform:translate(0,0)}82%{opacity:.7}92%{opacity:0;transform:translate(280px,110px)}}
@media(max-width:600px){
  .secret-room{padding:16px 18px max(28px,calc(env(safe-area-inset-bottom) + 18px))}
  .room-toolbar{gap:10px}.room-toolbar-actions{gap:8px}.room-toolbar-actions>span{max-width:12em;font-size:12px}
  .room-heading{margin:25px 0 24px}.room-heading h1{font-size:32px}
  .room-scene{height:410px;border-radius:80px 80px 20px 20px}
  .room-window{left:9%;width:47%;border-width:6px}.room-window-sill{left:7%;width:51%}
  .room-wall-note{top:14%;right:5%;width:30%;font-size:12px;letter-spacing:.02em}
  .room-objects{left:5%;right:5%;gap:7px}
  .room-object-art{height:126px}.room-book-art,.room-journal-art{height:126px}
  .room-toy-art img{width:190px;height:134px}.room-toy-stand{width:65px}
  .room-object-label{font-size:14px;letter-spacing:0;margin-top:7px}
  .room-lamp{right:5%;width:28%}.room-desk{left:3%;right:3%}
  .room-object{--spark-right:6%}.room-object-book{--spark-right:1%}
  .room-footer{padding-top:24px}.room-footer p{font-size:21px}
}
@media(max-width:360px){.secret-room{padding-inline:12px}.room-scene{height:385px}.room-object-art{height:117px}.room-book-art,.room-journal-art{height:117px}.room-toy-art img{height:125px;width:178px}.room-note{padding-inline:20px}.room-note h2{font-size:25px}}
@media(prefers-reduced-motion:reduce){
  .room-heading,.room-scene,.room-footer,.room-wall-light,.room-light-cone,.room-window-star,.room-object-art,.room-object-art:before,.room-object-spark{animation:none}
  .room-object-art{filter:drop-shadow(0 0 5px #f4ce8a80)}.room-object-art:before{opacity:.3}.room-object-spark{opacity:.9}
  .room-shooting-star{display:none}.room-object-art,.room-inspect-enter-active,.room-inspect-leave-active,.room-inspect-enter-active .room-note,.room-inspect-leave-active .room-note{transition:none}
  .room-object:hover .room-object-art,.room-object:focus-visible .room-object-art{translate:none}

}
</style>
