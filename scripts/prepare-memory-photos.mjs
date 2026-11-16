import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { memories } from '../src/memories.js';

const publicDir = new URL('../public/', import.meta.url);
await mkdir(new URL('memories/', publicDir), { recursive: true });
let totalBytes = 0;
for (const photo of memories) {
  const output = await sharp(fileURLToPath(new URL(photo.originalSrc.slice(1), publicDir)))
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 })
    .toFile(fileURLToPath(new URL(photo.src.slice(1), publicDir)));
  totalBytes += output.size;
}
console.log(`Prepared ${memories.length} slideshow photos (${Math.round(totalBytes / 1024)} KiB).`);
