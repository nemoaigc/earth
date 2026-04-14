#!/usr/bin/env node
/**
 * Pre-generate (or fetch) an audio file for each extinct animal and
 * save it to public/animal-sounds/{id}.mp3. The runtime just plays
 * these static files; nothing is generated in the browser.
 *
 * This script defines the *interface* for sound generation. It
 * dispatches to one of several backends based on env vars:
 *
 *   LOST_PLANET_SOUND_PROVIDER=elevenlabs   ELEVENLABS_API_KEY=...
 *   LOST_PLANET_SOUND_PROVIDER=suno          SUNO_API_KEY=...
 *   LOST_PLANET_SOUND_PROVIDER=wikimedia     (no key — searches Commons)
 *
 * When none of these env vars are set we still run, but emit a stub
 * JSON manifest listing the target filenames so the rest of the app
 * can surface an "资产尚未生成" state gracefully. As soon as an API
 * key is available, rerun this script to populate the mp3 files.
 *
 * Usage: node scripts/generate-animal-sounds.mjs
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/animal-sounds');
const MANIFEST_PATH = resolve(OUT_DIR, 'manifest.json');

const ANIMALS = [
  { id: 'dodo',              name: 'Dodo',                        prompt: 'Large flightless pigeon call, deep throaty coo' },
  { id: 'thylacine',         name: 'Thylacine',                   prompt: 'Canine-like bark and hissing growl' },
  { id: 'moa',               name: 'Moa',                         prompt: 'Deep ratite vocalisation, low resonant honk' },
  { id: 'passengerpigeon',   name: 'Passenger Pigeon',            prompt: 'Flock of pigeons cooing and wings clapping' },
  { id: 'greatauk',          name: 'Great Auk',                   prompt: 'Auk squawk, gull-like seabird call' },
  { id: 'stellerseacow',     name: "Steller's Sea Cow",           prompt: 'Sirenian low moaning underwater vocal' },
  { id: 'quagga',            name: 'Quagga',                      prompt: 'Zebra-like whinny, higher than a horse' },
  { id: 'caspiantiger',      name: 'Caspian Tiger',               prompt: 'Large tiger roar, deep chuff' },
  { id: 'barbarylion',       name: 'Barbary Lion',                prompt: 'Lion roar with dense desert reverb' },
  { id: 'formosanleopard',   name: 'Formosan Clouded Leopard',    prompt: 'Leopard growl and chuff, forest ambience' },
  { id: 'japanesewolf',      name: 'Japanese Wolf',               prompt: 'Small wolf howl, melancholy and high-pitched' },
  { id: 'goldentoad',        name: 'Golden Toad',                 prompt: 'Toad trill, cloud-forest background' },
  { id: 'caribbeanmonkseal', name: 'Caribbean Monk Seal',         prompt: 'Monk seal bark, shallow-water splash' },
  { id: 'westernblackrhino', name: 'Western Black Rhinoceros',    prompt: 'Rhino huff and trumpet, savanna ambience' },
  { id: 'chinesepaddlefish', name: 'Chinese Paddlefish',          prompt: 'Large river fish splash, underwater rumble' },
  { id: 'baijidolphin',      name: 'Baiji',                       prompt: 'Freshwater dolphin click and whistle' },
  { id: 'pyreneanibex',      name: 'Pyrenean Ibex',               prompt: 'Ibex bleat with alpine echo' },
  { id: 'bluebuck',          name: 'Bluebuck',                    prompt: 'Antelope snort and grunt' },
  { id: 'carolinaparakeet',  name: 'Carolina Parakeet',           prompt: 'Parakeet flock chatter, sharp bright calls' },
  { id: 'ivorybill',         name: 'Ivory-billed Woodpecker',     prompt: 'Woodpecker double rap and nasal trumpet' },
];

const PROVIDER = process.env.LOST_PLANET_SOUND_PROVIDER ?? '';

// --- Provider adapters --------------------------------------------------
// Each adapter gets the full animal row and must return a Buffer of
// mp3/ogg bytes, or null if it cannot fulfil the request. Add new
// adapters here; the script will pick based on PROVIDER.

async function viaElevenLabs(animal) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  const body = {
    text: animal.prompt,
    model_id: 'eleven_sound_effect_v1',
    duration_seconds: 5,
    prompt_influence: 0.7,
  };
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function viaSuno(_animal) {
  // Stub — Suno's public API is still gated. Once we have access,
  // implement "generate" + poll for completion + download mp3.
  throw new Error('Suno provider not implemented yet');
}

async function viaWikimedia(_animal) {
  // Stub — fall back to searching Commons for a recording. Not all
  // animals will have usable audio, so this one often returns null.
  return null;
}

const ADAPTERS = {
  elevenlabs: viaElevenLabs,
  suno: viaSuno,
  wikimedia: viaWikimedia,
};

// --- Main --------------------------------------------------------------

await mkdir(OUT_DIR, { recursive: true });

const adapter = ADAPTERS[PROVIDER];
const manifest = {
  provider: PROVIDER || 'none',
  generatedAt: new Date().toISOString(),
  files: {},
};

for (const animal of ANIMALS) {
  const outPath = resolve(OUT_DIR, `${animal.id}.mp3`);
  if (existsSync(outPath)) {
    console.log(`— ${animal.id}  already present, keeping`);
    manifest.files[animal.id] = `${animal.id}.mp3`;
    continue;
  }
  if (!adapter) {
    console.warn(`! ${animal.id}: no provider configured; skipping`);
    manifest.files[animal.id] = null;
    continue;
  }
  try {
    const buf = await adapter(animal);
    if (!buf) {
      console.warn(`! ${animal.id}: provider returned null`);
      manifest.files[animal.id] = null;
      continue;
    }
    await writeFile(outPath, buf);
    manifest.files[animal.id] = `${animal.id}.mp3`;
    console.log(`✓ ${animal.id}.mp3  (${(buf.byteLength / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`✗ ${animal.id}: ${err.message}`);
    manifest.files[animal.id] = null;
  }
}

// Merge with any existing manifest so we don't wipe pre-populated entries.
if (existsSync(MANIFEST_PATH)) {
  try {
    const prev = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
    for (const [id, file] of Object.entries(prev.files ?? {})) {
      if (file && manifest.files[id] == null) manifest.files[id] = file;
    }
  } catch {}
}

await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`\nManifest → ${MANIFEST_PATH}`);
