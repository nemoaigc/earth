import https from 'https';
import { writeFileSync } from 'fs';

const auth = Buffer.from(process.env.SCENARIO_API_KEY + ':' + process.env.SCENARIO_API_SECRET).toString('base64');
const MODEL = 'model_cox2ghwocuxq1GErcbcXb4aK'; // Animated Feature 2.0

const ANIMALS = [
  {
    id: 'stellerseacow',
    prompt: "Steller's Sea Cow, huge manatee-like prehistoric sea creature, massive dark grey barrel-shaped body, wide flat tail flukes, tiny stubby front flippers, round chubby face, Pixar 3D cartoon style, no clothing no costume no accessories, isolated on dark background, game asset character sprite, full body visible",
    negative: "clothing, costume, jacket, vest, accessories, dolphin, whale, fish, realistic, photo"
  },
  {
    id: 'greatauk',
    prompt: "Great Auk, large extinct flightless seabird, black back white belly, large hooked beak with white spot, short vestigial wings, upright standing posture, looks like a bigger razorbill, Pixar 3D cartoon style, dark background, game asset character sprite, full body",
    negative: "penguin, realistic, photo, clothing, Emperor penguin"
  }
];

function request(opts, body) {
  return new Promise((res, rej) => {
    const chunks = [];
    const req = https.request(opts, r => {
      r.on('data', c => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', rej);
    if (body) req.write(body);
    req.end();
  });
}

async function generate(animal) {
  const body = JSON.stringify({
    prompt: animal.prompt, negativePrompt: animal.negative,
    numSamples: 1, guidance: 8, numInferenceSteps: 40,
    negativePromptStrength: 0.8,
    width: 512, height: 512, modelId: MODEL
  });
  const r = await request({
    hostname: 'api.cloud.scenario.com', path: '/v1/generate/txt2img', method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json',
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  const j = JSON.parse(r.body);
  if (!j.job) throw new Error('No job: ' + r.body.slice(0, 200));
  return j.job.jobId;
}

async function waitJob(jobId) {
  for (let i = 0; i < 30; i++) {
    const r = await request({ hostname: 'api.cloud.scenario.com', path: '/v1/jobs/' + jobId,
      headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' } });
    const j = JSON.parse(r.body);
    if (j.job.status === 'success') return j.job.metadata?.assetIds?.[0];
    if (j.job.status === 'failed') throw new Error('Job failed');
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timeout');
}

async function downloadAsset(assetId, outPath) {
  const r = await request({ hostname: 'api.cloud.scenario.com', path: '/v1/assets/' + assetId,
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' } });
  const url = new URL(JSON.parse(r.body).asset.url);
  // Follow one redirect if needed
  let dl = await request({ hostname: url.hostname, path: url.pathname + url.search });
  if (dl.status === 301 || dl.status === 302) {
    const loc = new URL(dl.headers.location);
    dl = await request({ hostname: loc.hostname, path: loc.pathname + loc.search });
  }
  if (dl.status !== 200) throw new Error(`Download failed: ${dl.status} ${dl.body.slice(0,100)}`);
  writeFileSync(outPath, dl.body);
  return dl.body.length;
}

for (const animal of ANIMALS) {
  process.stdout.write(`\nGenerating ${animal.id}... `);
  const jobId = await generate(animal);
  const assetId = await waitJob(jobId);
  const bytes = await downloadAsset(assetId, `public/animals/${animal.id}.png`);
  console.log(` ✓ ${(bytes/1024).toFixed(0)} KB`);
}
console.log('\nDone.');
