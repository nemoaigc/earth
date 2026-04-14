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

// Prompts researched against:
//  - 2021 Natural History Museum dodo trachea reconstruction
//  - 1935 Cornell Lab ivory-billed woodpecker recordings
//  - Baiji acoustic literature (whistle/echolocation click ranges)
//  - Historical descriptions for thylacine, passenger pigeon, great auk
//  - Sirenian research on dugong/manatee (for Steller's sea cow)
//  - Rhino vocalisation research (no vocal cords — nasal only)
//  - Hawaiian monk seal repertoire (closest to Caribbean monk seal)
// Each prompt names the target vocalisation, closest living reference,
// and the environment. Explicitly excludes mis-synthesis traps
// (musical instruments for "trumpet", etc.).
const ANIMALS = [
  { id: 'dodo',              name: 'Dodo',                        prompt: 'Deep throaty two-syllable pigeon coo, low "oom-woom" around 180 Hz, resonant and slow, similar to a large Nicobar pigeon but deeper and louder; no music' },
  { id: 'thylacine',         name: 'Thylacine',                   prompt: 'Marsupial carnivore calls: a short terrier-like "yip yip" and a coarse dry cough-bark used as warning; eucalyptus forest night ambience; no music' },
  { id: 'moa',               name: 'Moa',                         prompt: 'Giant flightless bird deep resonant booming call through an elongated looped trachea, similar to a trumpeter swan or sandhill crane mixed with a cassowary\'s low moan; New Zealand forest ambience; no musical instruments' },
  { id: 'passengerpigeon',   name: 'Passenger Pigeon',            prompt: 'Huge pigeon flock overhead: a mix of low "keck keck" calls, rapid "kee-kee-kee-kee" scolding, soft "keeho" coos, and thousands of wings beating; deciduous forest; no music' },
  { id: 'greatauk',          name: 'Great Auk',                   prompt: 'Large flightless seabird low hoarse croaking and gurgling call, razorbill-like but deeper and louder, occasional bellowing cry; waves on rocky North Atlantic coast; no music' },
  { id: 'stellerseacow',     name: "Steller's Sea Cow",           prompt: 'Giant sirenian underwater sighs and snorting exhalations, slow and breathy, with faint distant chirps and low moans similar to a dugong; cold shallow Bering Sea ambience; no music' },
  { id: 'quagga',            name: 'Quagga',                      prompt: 'Plains-zebra whinny and bark-like "quahha" call repeating, with hoof stamps on dry grass; South African veld ambience; no music' },
  { id: 'caspiantiger',      name: 'Caspian Tiger',               prompt: 'Large tiger deep chuffing exhale and a rolling roar, reed bed and river ambience; no music' },
  { id: 'barbarylion',       name: 'Barbary Lion',                prompt: 'Big male lion full-throated roar sequence followed by grunts, Atlas mountain forest night ambience; no music' },
  { id: 'formosanleopard',   name: 'Formosan Clouded Leopard',    prompt: 'Clouded leopard low growl, soft chuff and purr, dripping broadleaf rainforest ambience; no music' },
  { id: 'japanesewolf',      name: 'Japanese Wolf',               prompt: 'Small wolf high-pitched mournful howl rising and falling, distant mountain wind, cedar forest; no music' },
  { id: 'goldentoad',        name: 'Golden Toad',                 prompt: 'Small toad sharp rapid chirrup trill, cloud-forest insect and drip background at night; no music' },
  { id: 'caribbeanmonkseal', name: 'Caribbean Monk Seal',         prompt: 'Monk seal deep guttural belch-like underwater call with occasional whine, similar to Hawaiian monk seal; shallow Caribbean reef ambience; no music' },
  { id: 'westernblackrhino', name: 'Western Black Rhinoceros',    prompt: 'African rhinoceros nasal grunts, snorts, snuffs and high-pitched squeaks (rhinos have no vocal cords — sound comes from the nasal passages, never a trumpet); heavy footsteps on dry savanna; no musical instruments' },
  { id: 'chinesepaddlefish', name: 'Chinese Paddlefish',          prompt: 'Large river fish surfacing, a wide body slapping muddy water and powerful tail thrash, gurgling underwater rumble, Yangtze river ambience; no music' },
  { id: 'baijidolphin',      name: 'Baiji',                       prompt: 'Yangtze river dolphin short upswept whistle around 5 kHz followed by a burst of echolocation clicks, muffled turbid river ambience with distant boat hum; no music' },
  { id: 'pyreneanibex',      name: 'Pyrenean Ibex',               prompt: 'Wild mountain goat sharp bleat and snort, hoofs on loose rock, alpine wind echo in the Pyrenees; no music' },
  { id: 'bluebuck',          name: 'Bluebuck',                    prompt: 'Large antelope short nasal snort and low grunt, hoof thud on dry grass, South African plains ambience; no music' },
  { id: 'carolinaparakeet',  name: 'Carolina Parakeet',           prompt: 'Small parakeet flock sharp bright rapid chatter and occasional harsh screech, eastern US riverine forest ambience; no music' },
  { id: 'ivorybill',         name: 'Ivory-billed Woodpecker',     prompt: 'Large woodpecker nasal single "kent" note repeated — described as like blowing on a clarinet mouthpiece — plus a sharp double-rap drum on a dead hardwood trunk; swamp forest ambience; no musical instruments' },
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
    model_id: 'eleven_text_to_sound_v2',
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
    manifest.files[animal.id] = {
      file: `${animal.id}.mp3`,
      version: 1,
      accepted: null,
      generated: true,
      prompt: animal.prompt,
      provider: PROVIDER,
    };
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
      manifest.files[animal.id] = { file: null, accepted: null, prompt: animal.prompt };
      continue;
    }
    await writeFile(outPath, buf);
    manifest.files[animal.id] = {
      file: `${animal.id}.mp3`,
      version: 1,
      accepted: null,
      generated: true,
      prompt: animal.prompt,
      provider: PROVIDER,
    };
    console.log(`✓ ${animal.id}.mp3  (${(buf.byteLength / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`✗ ${animal.id}: ${err.message}`);
    manifest.files[animal.id] = { file: null, accepted: null, prompt: animal.prompt, error: err.message };
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
