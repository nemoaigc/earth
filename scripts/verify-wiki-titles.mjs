#!/usr/bin/env node
// Check every animal's wikiTitle against zh.wikipedia.org first, then
// fall back to en. If zh has a page we prefer it; otherwise we print
// what zh does have for that English title so we can patch animals.ts.

const ANIMALS = [
  ['dodo',              'Dodo'],
  ['thylacine',         'Thylacine'],
  ['moa',               'Moa'],
  ['passengerpigeon',   'Passenger_pigeon'],
  ['greatauk',          'Great_auk'],
  ['stellerseacow',     "Steller's_sea_cow"],
  ['quagga',            'Quagga'],
  ['caspiantiger',      'Caspian_tiger'],
  ['barbarylion',       'Barbary_lion'],
  ['formosanleopard',   'Formosan_clouded_leopard'],
  ['japanesewolf',      'Japanese_wolf'],
  ['goldentoad',        'Golden_toad'],
  ['caribbeanmonkseal', 'Caribbean_monk_seal'],
  ['westernblackrhino', 'Western_black_rhinoceros'],
  ['chinesepaddlefish', 'Chinese_paddlefish'],
  ['baijidolphin',      'Baiji'],
  ['pyreneanibex',      'Pyrenean_ibex'],
  ['bluebuck',          'Bluebuck'],
  ['carolinaparakeet',  'Carolina_parakeet'],
  ['ivorybill',         'Ivory-billed_woodpecker'],
];

async function check(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'lost-planet/1.0 (contact: nemo)' },
    redirect: 'follow',
  });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  if (data.type === 'disambiguation') return { ok: false, note: 'disambiguation' };
  return { ok: true, resolved: data.titles?.canonical ?? data.title };
}

async function enToZh(enTitle) {
  // Use langlinks API to find the zh sibling of an EN page.
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(enTitle)}&prop=langlinks&lllang=zh&lllimit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'lost-planet/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const ll = page.langlinks?.[0];
    if (ll?.['*']) return ll['*'];
  }
  return null;
}

const rows = [];
for (const [id, enTitle] of ANIMALS) {
  // 1. Try zh with the same title (usually fails since titles are English).
  // 2. Use EN langlinks to find the zh page title.
  // 3. Also verify EN itself works.
  const en = await check('en', enTitle);
  let zhTitle = null;
  if (en.ok) zhTitle = await enToZh(enTitle);

  const zhRow = zhTitle ? await check('zh', zhTitle) : { ok: false };

  rows.push({ id, enTitle, enOk: en.ok, zhTitle, zhOk: zhRow.ok, resolved: zhRow.resolved ?? en.resolved });
  await new Promise((r) => setTimeout(r, 300));
}

console.log(`\n  id                       EN   ZH   zh-title`);
console.log(`  ---------------------------------------------------`);
for (const r of rows) {
  const en = r.enOk ? '✓' : '✗';
  const zh = r.zhOk ? '✓' : '—';
  console.log(`  ${r.id.padEnd(22)} ${en}    ${zh}    ${r.zhTitle ?? ''}`);
}

const missing = rows.filter((r) => !r.enOk && !r.zhOk);
if (missing.length) {
  console.log(`\n  ${missing.length} missing:`, missing.map((r) => r.id).join(', '));
}

// Emit a JSON patch suggestion for src/data/animals.ts
console.log('\n  Suggested mapping (id → zhWikiTitle):');
for (const r of rows) {
  if (r.zhTitle) console.log(`    ${r.id.padEnd(22)} "${r.zhTitle}"`);
}
