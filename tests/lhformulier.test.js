// v0.44.0: digitale loonheffingsverklaring + modelcontrole
const assert = require('assert'), zlib = require('zlib');
const L = require('../netlify/functions/_lib/lhformulier.js');
const T = require('../netlify/functions/_lib/sjablonen.js');
const nu = new Date(2026, 10, 4, 12);
// kleine PNG (ruis, zodat hij groter is dan de ondergrens)
function png(wd, ht) {
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(wd, 0); ihdr.writeUInt32BE(ht, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((wd + 1) * ht); let s = 7; for (let i = 0; i < raw.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; raw[i] = i % (wd + 1) === 0 ? 0 : s & 0xff; }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hand = 'data:image/png;base64,' + png(120, 40).toString('base64');
const tok = { s: 'loon', n: 'Test Persoon' };
const goed = { voorletters: 'tj', achternaam: 'Persoon', straat: 'Teststraat', huisnummer: '1', toevoeging: 'a', postcode: '1234ab', woonplaats: 'Den Haag', bsn: '111222333', geboortedatum: '2001-06-11', lhk: 'ja', lhkVanaf: '2026-11-01', naamGetypt: 'Test Persoon', akkoord: true, handtekening: hand };
let v = L.valideer(goed, tok, nu);
assert.ok(v.ok, JSON.stringify(v.fouten));
assert.strictEqual(v.schoon.naamVoorletters, 'T.J. Persoon'); assert.strictEqual(v.schoon.postcode, '1234 AB'); assert.strictEqual(v.schoon.adres, 'Teststraat 1A');
assert.strictEqual(v.schoon.lhkVanaf, '01-11-2026'); assert.strictEqual(v.schoon.geboortedatum, '11-06-2001'); assert.ok(v.handtekening.length > 800);
// Nee → geen datum nodig
v = L.valideer(Object.assign({}, goed, { lhk: 'nee', lhkVanaf: '' }), tok, nu); assert.ok(v.ok); assert.strictEqual(v.schoon.lhkVanaf, '');
// fouten: BSN, naam van iemand anders, geen handtekening, geen akkoord, Ja zonder datum
v = L.valideer(Object.assign({}, goed, { bsn: '111222334', naamGetypt: 'Iemand Anders', handtekening: '', akkoord: false, lhkVanaf: '' }), tok, nu);
assert.deepStrictEqual(Object.keys(v.fouten).sort(), ['akkoord', 'bsn', 'handtekening', 'lhkVanaf', 'naamGetypt']);
// buitenlandse postcode zonder vinkje → vraag; met vinkje → land en regio verplicht
v = L.valideer(Object.assign({}, goed, { postcode: 'D-50667' }), tok, nu); assert.strictEqual(v.fouten.postcode, 'w-buitenland');
v = L.valideer(Object.assign({}, goed, { postcode: '50667', woonplaats: 'Koeln', buitenland: true }), tok, nu); assert.strictEqual(v.fouten.landRegio, 'leeg');
v = L.valideer(Object.assign({}, goed, { postcode: '50667', woonplaats: 'Koeln', buitenland: true, landRegio: 'Duitsland, NRW' }), tok, nu); assert.ok(v.ok, JSON.stringify(v.fouten));
// geen nep-PNG
assert.strictEqual(L.leesHandtekening('data:image/png;base64,' + Buffer.alloc(2000).toString('base64')), null);
// versiecode uit de bestandsnaam en de modelpagina
assert.strictEqual(L.codeUitBestand('model_opgaaf_gegevens_loonheffingen_lh0082z12fol.pdf'), 'LH 008 - 2Z*12FOL');
const html = '<meta name="DCTERMS.modified" content="2026-08-20T10:00:00"><a href="https://download.belastingdienst.nl/belastingdienst/docs/model_opgaaf_gegevens_loonheffingen_lh0082z13fol.pdf">pdf</a>';
const pg = L.parseModelPagina(html); assert.strictEqual(pg.code, 'LH 008 - 2Z*13FOL'); assert.strictEqual(pg.gewijzigd, '2026-08-20');
assert.strictEqual(L.parseModelPagina('<html>niets</html>'), null);
// mails: persoonlijke link naar het digitale formulier, papieren upload als alternatief
const u = T.loonHtml('uitnodiging', 'Test Persoon', '05-11-2026', false);
assert.ok(/loonheffing\.html\?t=/.test(u) && /upload\.html\?t=/.test(u) && !/model_opgaaf_gegevens_voor_de_loonheffingen/.test(u));
assert.ok(/loonheffing\.html\?t=/.test(T.loonHtml('herinnering', 'Test Persoon', '', true)));
const pl = T.personaliseerUploadLinks(T.loonPlain('uitnodiging', 'Test Persoon', '', false), 'Test Persoon');
assert.ok(/loonheffing\.html\?t=/.test(pl) && /indienst\.html\?t=/.test(pl));
assert.ok(/\/loonheffing\.html\?t=/.test(L.link('Test Persoon')));
// controle met een nagemaakte pagina (zonder opslaan)
L.controleerModel({ haal: async () => html, opslaan: false }).then(async r => {
  assert.strictEqual(r.status, 'nieuw'); assert.strictEqual(r.gevonden.code, 'LH 008 - 2Z*13FOL');
  const r2 = await L.controleerModel({ haal: async () => html.replace('13fol', '12fol'), opslaan: false }); assert.strictEqual(r2.status, 'actueel');
  const r3 = await L.controleerModel({ haal: async () => { throw new Error('offline'); }, opslaan: false }); assert.strictEqual(r3.status, 'fout'); assert.strictEqual(r3.foutTeller, 1);
  const s = L.valideer(goed, tok, nu);
  const b = await L.maakPdf(s.schoon, { tijd: nu.toISOString(), handtekening: s.handtekening, ip: '1.2.3.4', browser: 'test', email: 'test@voorbeeld.nl', werkgever: 'SLA Den Haag BV (Kerkplein)' });
  assert.strictEqual(Buffer.from(b.slice(0, 5)).toString(), '%PDF-'); assert.ok(b.length > 3000);
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'lh-test.pdf'), Buffer.from(b));
  console.log('lhformulier tests OK');
}).catch(e => { console.error('✗ lhformulier: ' + e.message); process.exitCode = 1; });
