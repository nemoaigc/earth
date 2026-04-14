#!/usr/bin/env node
// Pre-download each extinct animal's Wikipedia summary image to
// public/animal-photos/{id}.jpg so the panel doesn't hit wiki at runtime.
//
// Usage: node scripts/fetch-animal-photos.mjs

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/animal-photos');

// Keep in sync with src/data/animals.ts — (id, wikiTitle) pairs only.
const ANIMALS = [
  ['dodo', 'Dodo'],
  ['thylacine', 'Thylacine'],
  ['moa', 'Moa'],
  ['passengerpigeon', 'Passenger_pigeon'],
  ['greatauk', 'Great_auk'],
  ['stellerseacow', "Steller's_sea_cow"],
  ['quagga', 'Quagga'],
  ['caspiantiger', 'Caspian_tiger'],
  ['barbarylion', 'Barbary_lion'],
  ['formosanleopard', 'Formosan_clouded_leopard'],
  ['japanesewolf', 'Japanese_wolf'],
  ['goldentoad', 'Golden_toad'],
  ['caribbeanmonkseal', 'Caribbean_monk_seal'],
  ['westernblackrhino', 'Western_black_rhinoceros'],
  ['chinesepaddlefish', 'Chinese_paddlefish'],
  ['baijidolphin', 'Baiji'],
  ['pyreneanibex', 'Pyrenean_ibex'],
  ['bluebuck', 'Bluebuck'],
  ['carolinaparakeet', 'Carolina_parakeet'],
  ['ivorybill', 'Ivory-billed_woodpecker'],
];

async function fetchWikiImage(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'lost-planet/1.0 (contact: nemo)' } });
  if (!res.ok) throw new Error(`Wiki summary ${res.status} for ${title}`);
  const data = await res.json();
  // Prefer thumbnail (cached CDN path, less likely to 429 than originalimage).
  return data.thumbnail?.source || data.originalimage?.source || null;
}

async function download(url, outPath, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'lost-planet/1.0 (contact: nemo)' } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(outPath, buf);
      return buf.byteLength;
    }
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
      continue;
    }
    throw new Error(`Image ${res.status} for ${url}`);
  }
  throw new Error(`Image fetch gave up for ${url}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

await mkdir(OUT_DIR, { recursive: true });
const existing = new Set((await readdir(OUT_DIR)).map(f => f.split('.')[0]));

for (const [id, wikiTitle] of ANIMALS) {
  if (existing.has(id)) {
    console.log(`— ${id}  already downloaded, skipping`);
    continue;
  }
  try {
    const imgUrl = await fetchWikiImage(wikiTitle);
    if (!imgUrl) {
      console.warn(`! ${id}: no image on wiki for "${wikiTitle}"`);
      continue;
    }
    // Always save as .jpg; browsers sniff content-type from magic bytes,
    // so PNG/WebP content with a .jpg extension still renders correctly.
    const outPath = resolve(OUT_DIR, `${id}.jpg`);
    const size = await download(imgUrl, outPath);
    console.log(`✓ ${id}.jpg  (${(size / 1024).toFixed(0)} KB)  ${wikiTitle}`);
  } catch (err) {
    console.error(`✗ ${id}: ${err.message}`);
  }
  await sleep(2500);
}

console.log(`\nDone → ${OUT_DIR}`);
