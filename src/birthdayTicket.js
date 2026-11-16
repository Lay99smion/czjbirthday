export const TICKET_WIDTH = 900;
export const TICKET_HEIGHT = 1560;
export const TICKET_WISH_LIMIT = 80;

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const segments = value => typeof Intl.Segmenter === 'function'
  ? [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)].map(item => item.segment)
  : Array.from(value);

export function normalizeTicketWish(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

// Conservative character widths keep Chinese, emoji and unbroken Latin words
// inside the printed area. Preserve intentional line breaks.
export function ticketWishLines(value) {
  const lines = [];
  for (const paragraph of normalizeTicketWish(value).split('\n')) {
    let line = '', width = 0;
    for (const char of segments(paragraph)) {
      const advance = /^[MW@#%&]$/.test(char) ? 1 : /^[mw]$/.test(char) ? .9 : /^[A-Z]$/.test(char) ? .8 : /^[\x20-\x7e]+$/.test(char) ? .65 : 1;
      if (width + advance > 21 && line) {
        lines.push(line.trimEnd());
        line = ''; width = 0;
      }
      line += char;
      width += advance;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function ticketWishError(value) {
  const text = normalizeTicketWish(value);
  if (!text) return '先写一句生日心愿，再生成纪念票。';
  if (segments(text).length > TICKET_WISH_LIMIT) return '心愿最多写 80 个字，请稍微缩短一点。';
  if (ticketWishLines(text).length > 4) return '心愿最多放 4 行，合并一些换行再试试。';
  return '';
}

export function createTicketSvg({ name, date, wish, photoDataUrl = '' }) {
  const text = normalizeTicketWish(wish);
  const lines = (text ? ticketWishLines(text) : ['把今年的心愿，写在这里。']).slice(0, 4);
  const dateCode = String(date).match(/\d+/g)?.map(number => number.padStart(2, '0')).join('') || '0110';
  const barcode = Array.from({ length: 58 }, (_, i) => `<rect x="${96 + i * 6}" y="1402" width="${i % 4 === 0 ? 4 : i % 3 === 0 ? 3 : 1.5}" height="42"/>`).join('');
  const photo = photoDataUrl
    ? `<image href="${escapeXml(photoDataUrl)}" x="150" y="242" width="600" height="800" preserveAspectRatio="xMidYMid meet"/>`
    : '<rect x="150" y="242" width="600" height="800" fill="#ece2d0"/><text x="450" y="650" text-anchor="middle" font-size="26" fill="#9c8c75">正在准备这一帧回忆</text>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TICKET_WIDTH}" height="${TICKET_HEIGHT}" viewBox="0 0 ${TICKET_WIDTH} ${TICKET_HEIGHT}">
  <defs><linearGradient id="paper" x2=".7" y2="1"><stop stop-color="#fcf5e7"/><stop offset="1" stop-color="#ead9bc"/></linearGradient></defs>
  <rect width="900" height="1560" fill="#10192b"/>
  <rect x="32" y="28" width="836" height="1504" rx="22" fill="url(#paper)"/>
  <rect x="48" y="44" width="804" height="1472" rx="14" fill="none" stroke="#ba9a6560"/>
  <g font-family="'PingFang SC','Microsoft YaHei',sans-serif">
    <text x="94" y="99" font-size="18" letter-spacing="3" fill="#9b7a49">THE BIRTHDAY ARCHIVE</text>
    <text x="806" y="99" text-anchor="end" font-size="17" letter-spacing="2" fill="#9b7a49">NO. ${escapeXml(dateCode)}</text>
    <text x="94" y="178" font-family="'Songti SC','Noto Serif SC',serif" font-size="64" fill="#302d35">${escapeXml(name)}</text>
    <text x="804" y="137" text-anchor="end" font-size="15" letter-spacing="3" fill="#9b7a49">BIRTHDAY</text>
    <text x="804" y="180" text-anchor="end" font-family="'Songti SC',serif" font-size="39" fill="#684d32">${escapeXml(date)}</text>
    <path d="M94 207H806" stroke="#bca071" stroke-opacity=".6"/>
    <rect x="138" y="230" width="624" height="824" rx="3" fill="#fffaf0" stroke="#b9a587"/>
    ${photo}
    <text x="150" y="1082" font-size="14" letter-spacing="2.7" fill="#997c55">LITTLE MOMENTS, FOREVER</text>
    <path d="M94 1120H127M110.5 1103.5V1136.5" stroke="#a47d49" stroke-width="1.5"/>
    <text x="145" y="1128" font-size="18" letter-spacing="2" fill="#8c6a42">生日心愿 / MY WISH</text>
    <g font-family="'Songti SC','PingFang SC',serif" font-size="31" fill="${text ? '#493b32' : '#ab9678'}">
      ${lines.map((line, i) => `<text x="96" y="${1184 + i * 43}">${escapeXml(line)}</text>`).join('')}
    </g>
    <path d="M64 1356H836" stroke="#b4956b" stroke-dasharray="8 10"/>
    <circle cx="32" cy="1356" r="19" fill="#10192b"/><circle cx="868" cy="1356" r="19" fill="#10192b"/>
    <g fill="#7d6041">${barcode}</g>
    <text x="804" y="1420" text-anchor="end" font-family="'Songti SC',serif" font-size="30" fill="#62482e">生日快乐，${escapeXml(name)}</text>
    <text x="804" y="1453" text-anchor="end" font-size="16" letter-spacing="1" fill="#997c55">愿每一岁，都有值得收藏的瞬间。</text>
    <text x="450" y="1498" text-anchor="middle" font-size="14" letter-spacing="3" fill="#a18969">KEEP THIS LITTLE MOMENT</text>
  </g></svg>`;
}

export async function loadTicketPhoto(src, signal) {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error('Photo request failed');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Photo response is not an image');
  const source = URL.createObjectURL(blob);
  const canvas = document.createElement('canvas');
  try {
    const image = await loadImage(source);
    if (signal?.aborted) throw new DOMException('Photo loading was cancelled', 'AbortError');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#fffaf0';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Embed JPEG rather than an external WebP reference: the preview and export
    // are self-contained, including SVG renderers with limited WebP support.
    return canvas.toDataURL('image/jpeg', .92);
  } finally {
    URL.revokeObjectURL(source);
    canvas.width = canvas.height = 0;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Ticket image could not be loaded'));
    image.src = src;
  });
}

export async function renderTicketPng(svg) {
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  try {
    const image = await loadImage(source);
    canvas.width = TICKET_WIDTH;
    canvas.height = TICKET_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Ticket image could not be exported')), 'image/png'));
  } finally {
    URL.revokeObjectURL(source);
    canvas.width = canvas.height = 0;
  }
}
