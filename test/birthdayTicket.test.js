import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createTicketSvg, loadTicketPhoto, normalizeTicketWish, renderTicketPng, ticketWishError, ticketWishLines, TICKET_WIDTH, TICKET_HEIGHT } from '../src/birthdayTicket.js';

test('a ticket requires a wish that fits, including Chinese, wide Latin letters, emoji, and line breaks', () => {
  assert.match(ticketWishError('  \n '), /先写/);
  assert.match(ticketWishError('愿'.repeat(81)), /80/);
  assert.match(ticketWishError('一\n二\n三\n四\n五'), /4 行/);
  assert.equal(ticketWishError('愿'.repeat(80)), '');
  assert.equal(ticketWishError('平安快乐🎂✨'), '');
  assert.equal(normalizeTicketWish('  新的一岁\r\n平安快乐  '), '新的一岁\n平安快乐');
  assert.ok(ticketWishLines('愿'.repeat(80)).every(line => line.length <= 21));
  assert.ok(ticketWishLines('W'.repeat(80)).every(line => line.length <= 21));
  assert.deepEqual(ticketWishLines('平安快乐\n勇敢自由'), ['平安快乐', '勇敢自由']);
});

test('the printed ticket escapes input and embeds the selected photo without external resources', () => {
  const svg = createTicketSvg({ name: '陈照敬', date: '1月10日', wish: '<script>&"生日快乐"', photoDataUrl: 'data:image/jpeg;base64,cGhvdG8=' });
  assert.ok(svg.includes('陈照敬'));
  assert.ok(svg.includes('1月10日'));
  assert.ok(svg.includes('NO. 0110'));
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;生日快乐&quot;'));
  assert.equal(svg.includes('<script>'), false);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.equal(/href="https?:/.test(svg), false);
});

test('the final SVG rasterizes with the real time1 photo and all four wish lines', async () => {
  const photo = await sharp(await readFile(new URL('../public/time1.webp', import.meta.url))).jpeg({ quality: 92 }).toBuffer();
  const svg = createTicketSvg({ name: '陈照敬', date: '1月10日', wish: '愿'.repeat(80), photoDataUrl: `data:image/jpeg;base64,${photo.toString('base64')}` });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, TICKET_WIDTH);
  assert.equal(meta.height, TICKET_HEIGHT);
  const actual = await sharp(png).extract({ left: 150, top: 242, width: 600, height: 800 }).removeAlpha().raw().toBuffer();
  const expected = await sharp(photo).resize(600, 800).removeAlpha().raw().toBuffer();
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference += Math.abs(actual[i] - expected[i]);
  assert.ok(difference / actual.length < 8, 'the exported photo must be present and keep its full composition');
  assert.ok(svg.includes('y="1313"'), 'the last wish line stays above the ticket perforation');
});

test('browser export embeds a decoded photo, creates PNG, and releases temporary surfaces', async t => {
  const keys = ['document', 'Image', 'fetch'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const canvases = [];
  const urls = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { const url = originalCreate(blob); urls.push({ url, released: false }); return url; };
  URL.revokeObjectURL = url => { urls.find(item => item.url === url).released = true; originalRevoke(url); };
  globalThis.Image = class {
    naturalWidth = 1080; naturalHeight = 1440;
    set src(value) { this.source = value; queueMicrotask(() => this.onload()); }
  };
  globalThis.fetch = async () => ({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/webp' }) });
  globalThis.document = { createElement() {
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toDataURL: type => `data:${type};base64,cGhvdG8=`,
      toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })),
    };
    canvases.push(canvas); return canvas;
  } };
  t.after(() => {
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const photo = await loadTicketPhoto('/time1.webp');
  assert.match(photo, /^data:image\/jpeg;/);
  const png = await renderTicketPng(createTicketSvg({ name: '陈照敬', date: '1月10日', wish: '平安快乐', photoDataUrl: photo }));
  assert.equal(png.type, 'image/png');
  assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.ok(urls.every(item => item.released));
});
