// v0.49.0 declaraties via Academy: IBAN-controle, bedrag lezen, invoercontrole, dubbel-detectie, Academy-sessie
const assert = require('assert');
const D = require('../netlify/functions/_lib/declaraties');

// IBAN (voorbeelden uit de oude Google-Form-sheet, met en zonder spaties)
assert.ok(D.controleerIban('NL89 ABNA 0576 7151 74').ok);
assert.ok(D.controleerIban('nl91abna0417164300').ok);
assert.strictEqual(D.controleerIban('NL89 ABNA 0576 7151 74').iban, 'NL89ABNA0576715174');
assert.ok(!D.controleerIban('NL30RABO033999103').ok, '17 tekens (typfout uit de sheet) moet worden geweigerd');
assert.ok(!D.controleerIban('NL89ABNA0576715175').ok, 'verkeerd controlegetal');
assert.ok(!D.controleerIban('').ok);
assert.ok(D.controleerIban('BE68 5390 0754 7034').ok);
assert.ok(D.controleerIban('DE89 3704 0044 0532 0130 00').ok);
assert.strictEqual(D.ibanMooi('NL89ABNA0576715174'), 'NL89 ABNA 0576 7151 74');

// Bedragen zoals mensen ze typen
const b = { '12,50': 12.5, '€115,22': 115.22, '24,48 euro': 24.48, '2,38€': 2.38, '29': 29, '26.4': 26.4, '1.234,56': 1234.56, '1,234.56': 1234.56, '1.234': 1234, '0,99': 0.99, 'abc': null, '': null };
for (const [k, v] of Object.entries(b)) assert.strictEqual(D.leesBedrag(k), v, 'leesBedrag(' + k + ')');
assert.strictEqual(D.leesBedrag(7.005), 7.01);

// Invoercontrole
const nu = new Date('2026-11-16T12:00:00Z');
const goed = { datum: '2026-11-14', leverancier: 'Albert Heijn', bedrag: '14,60', omschrijving: 'Veldsla en feta', iban: 'NL89 ABNA 0576 7151 74', iban_naam: 'PWJ de Bruine', akkoord: true };
let c = D.controleerInvoer(goed, nu);
assert.ok(c.ok, c.fouten.join(';'));
assert.strictEqual(c.waarde.bedrag, 14.6);
assert.strictEqual(c.waarde.iban, 'NL89ABNA0576715174');
assert.ok(!D.controleerInvoer(Object.assign({}, goed, { datum: '2026-11-20' }), nu).ok, 'toekomst');
assert.ok(!D.controleerInvoer(Object.assign({}, goed, { datum: '2025-10-01' }), nu).ok, 'ouder dan een jaar');
assert.ok(!D.controleerInvoer(Object.assign({}, goed, { akkoord: 'Yes' }), nu).ok, 'akkoord moet echt true zijn');
assert.ok(!D.controleerInvoer(Object.assign({}, goed, { bedrag: '3000' }), nu).ok, 'boven maximum');
assert.ok(!D.controleerInvoer(Object.assign({}, goed, { bedrag: '0' }), nu).ok);
c = D.controleerInvoer({}, nu);
assert.ok(c.fouten.length >= 6, 'alle velden leeg geeft per veld een melding');

// Dubbel: zelfde persoon + datum + bedrag (zoals de avocado's van 5-8-2025); afgewezen telt niet
const r = D.markeerDubbel([
  { email: 'a@x', aankoop_datum: '2025-08-05', bedrag: 8.07, status: 'ingediend' },
  { email: 'a@x', aankoop_datum: '2025-08-05', bedrag: '8.07', status: 'betaald' },
  { email: 'a@x', aankoop_datum: '2025-08-05', bedrag: 5.38, status: 'ingediend' },
  { email: 'b@x', aankoop_datum: '2025-08-05', bedrag: 8.07, status: 'ingediend' },
  { email: 'c@x', aankoop_datum: '2025-08-06', bedrag: 3, status: 'afgewezen' },
  { email: 'c@x', aankoop_datum: '2025-08-06', bedrag: 3, status: 'ingediend' }
]);
assert.deepStrictEqual(r.map(x => x.dubbel), [true, true, false, false, false, false]);

// CORS: alleen Academy
assert.strictEqual(D.cors({ headers: { origin: 'https://sla-academy.netlify.app' } })['Access-Control-Allow-Origin'], 'https://sla-academy.netlify.app');
assert.strictEqual(D.cors({ headers: { origin: 'https://evil.example' } })['Access-Control-Allow-Origin'], 'https://sla-academy.netlify.app');

// Academy-sessie: naam en winkel komen uit Academy, niet uit de invoer
(async () => {
  const nep = (map) => async (url) => { const k = Object.keys(map).find(x => url.indexOf(x) > -1); return k ? { ok: true, json: async () => map[k] } : { ok: false, json: async () => ({}) }; };
  const m = await D.academyGebruiker('tok', nep({ '/auth/v1/user': { email: 'Lena@ilovesla.com' }, '/rest/v1/employees': [{ id: 'e1', full_name: 'Lena Hemmink', shiftbase_id: 123, location_id: 4, language: 'en', active: true }], '/rest/v1/locations': [{ name: 'Middenweg', code: 'MW', franchise: false }] }));
  assert.deepStrictEqual(m, { email: 'lena@ilovesla.com', academy_id: 'e1', naam: 'Lena Hemmink', shiftbase_id: '123', winkel: 'Middenweg', winkel_code: 'MW', franchise: false, taal: 'en' });
  await assert.rejects(D.academyGebruiker('', nep({})), e => e.status === 401);
  await assert.rejects(D.academyGebruiker('tok', nep({})), e => e.status === 401);
  await assert.rejects(D.academyGebruiker('tok', nep({ '/auth/v1/user': { email: 'x@y' }, '/rest/v1/employees': [] })), e => e.status === 403);
  // afwijsmail in de taal van de medewerker
  const mail = require('../netlify/functions/declaraties')._afwijsMail({ naam: 'Lena Hemmink', taal: 'en', bedrag: 8.07, leverancier: 'Albert Heijn', aankoop_datum: '2025-08-05' }, 'Duplicate');
  assert.ok(/not approved/.test(mail.subject) && /Hi Lena/.test(mail.text) && /05-08-2025/.test(mail.text));
  console.log('✓ declaraties');
})().catch(e => { console.error('✗ declaraties (async): ' + e.message); process.exitCode = 1; });
