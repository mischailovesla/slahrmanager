// v0.48.3: leeg document (0 bytes) uit het dossier halen — in een eigen proces, zodat de nep-Supabase andere tests niet raakt
const { execFileSync } = require('child_process');
const path = require('path');
const code = `
const assert = require('assert'), Module = require('module'), path = require('path');
const db = { uploads: { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', naam: 'Test Persoon', bestanden: [{ key: 'loon', label: 'Loonheffingsverklaring', pad: 'loon/test/1_loon_x.pdf' }, { key: 'indienst', label: 'Indienst', pad: 'loon/test/1_indienst_y.pdf' }] } }, grootte: { '1_loon_x.pdf': 0, '1_indienst_y.pdf': 2746 }, update: null };
const client = {
  from: () => ({ select: () => ({ eq: (k, id) => ({ single: async () => ({ data: db.uploads[id] }) }) }), update: v => ({ eq: async (k, id) => { db.update = { id, v }; return { error: null }; } }) }),
  storage: { from: () => ({ list: async (map, o) => ({ data: [{ name: o.search, metadata: { size: db.grootte[o.search] } }] }) }) }
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) { if (r === '@supabase/supabase-js') return path.join(${JSON.stringify(__dirname)}, 'stub-supabase.js'); return orig.call(this, r, ...a); };
require(path.join(${JSON.stringify(__dirname)}, 'stub-supabase.js')).createClient = () => client;
process.env.SUPABASE_URL = 'x'; process.env.SUPABASE_SERVICE_KEY = 'y';
const U = require(${JSON.stringify(path.join(__dirname, '..', 'netlify', 'functions', '_lib', 'uploads'))});
(async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await assert.rejects(U.verwijderLeeg('sb:' + id + ':indienst', 'hr@x'), /niet leeg \\(2746 bytes\\)/);
  assert.strictEqual(db.update, null, 'niet-leeg document blijft staan');
  const uit = await U.verwijderLeeg('sb:' + id + ':loon', 'hr@x');
  assert.strictEqual(uit.key, 'loon');
  const b = db.update.v.bestanden;
  assert.deepStrictEqual(b.map(x => x.key), ['loon_leeg', 'indienst']);
  assert.strictEqual(b[0].verwijderd_door, 'hr@x'); assert.strictEqual(b[0].oorspronkelijkeKey, 'loon');
  // v0.50.1: afkeuren met reden mag ook bij een niet-leeg document
  const af = await U.verwijderLeeg('sb:' + id + ':indienst', 'hr@x', 'onleesbaar');
  assert.strictEqual(af.key, 'indienst');
  assert.strictEqual(db.update.v.bestanden[1].key, 'indienst_afgekeurd');
  assert.ok(/afgekeurd door HR: onleesbaar/.test(db.update.v.bestanden[1].reden));
  console.log('leeg-document tests OK');
})().catch(e => { console.error(e.message); process.exit(1); });
`;
const uit = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' });
process.stdout.write(uit);
