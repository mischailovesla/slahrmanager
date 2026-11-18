// v0.53.4: opgegeven beschikbaarheid bij de weekendcheck
const assert = require('assert');
const W = require('../netlify/functions/_lib/weekend');

assert.strictEqual(W.beschSoort({ available_type: 'available_all_day' }), 'wel');
assert.strictEqual(W.beschSoort({ type: 'Unavailable from' }), 'niet');
assert.strictEqual(W.beschSoort({ available: false }), 'niet');
assert.strictEqual(W.beschSoort({ type: '' }), '');
assert.deepStrictEqual(W.beschObj({ Availability: { user_id: '1', date: '2026-11-14' } }), { user_id: '1', date: '2026-11-14' });
assert.deepStrictEqual(W.beschObj({ Foo: { user_id: '2' }, User: [] }), { user_id: '2' });

// Woensdag 18-11-2026: laatste 3 volledige weekenden = 13-15 nov, 6-8 nov, 30 okt-1 nov
const vandaag = new Date(2026, 10, 18);
const med = [
  { id: '1', naam: 'Wel Beschikbaar', winkelNaam: 'Kerkplein', indienst: '01-01-2026' },
  { id: '2', naam: 'Niet Beschikbaar', winkelNaam: 'Kerkplein', indienst: '01-01-2026' },
  { id: '3', naam: 'Niets Opgegeven', winkelNaam: 'Kerkplein', indienst: '01-01-2026' },
  { id: '4', naam: 'Deels Beschikbaar', winkelNaam: 'Kerkplein', indienst: '01-01-2026' }
];
const ros = ['1', '2', '3', '4'].map(u => ({ Roster: { user_id: u, date: '2026-11-11' } }));   // alleen doordeweeks gewerkt
const av = (u, d, t) => ({ Availability: { user_id: u, date: d, available_type: t } });
const wk = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-13', '2026-11-14', '2026-11-15'];
const besch = []
  .concat(wk.filter((d, i) => i % 3 !== 0).map(d => av('1', d, 'available_all_day')))          // za + zo elk weekend
  .concat(wk.map(d => av('2', d, 'unavailable_all_day')))
  .concat([av('4', '2026-11-14', 'available_from'), av('4', '2026-11-15', 'unavailable_all_day')])
  .concat([av('1', '2026-11-11', 'available_all_day')]);                                          // doordeweeks telt niet
const uit = W.bepaalWeekendOntwijkers(med, ros, [], vandaag, 3, [], besch);
const st = Object.fromEntries(uit.map(x => [x.naam, x.beschikbaarheid]));
assert.strictEqual(st['Wel Beschikbaar'].status, 'beschikbaar'); assert.strictEqual(st['Wel Beschikbaar'].wel, 6);
assert.strictEqual(st['Niet Beschikbaar'].status, 'niet'); assert.strictEqual(st['Niet Beschikbaar'].niet, 9);
assert.strictEqual(st['Niets Opgegeven'].status, 'geen');
assert.strictEqual(st['Deels Beschikbaar'].status, 'deels'); assert.strictEqual(st['Deels Beschikbaar'].wel, 1);
assert.ok(/wél beschikbaar opgegeven \(6 van 9 weekenddagen\)/.test(W.beschikbaarheidTekst(st['Wel Beschikbaar'])));
// zonder data: onbekend, geen tekst
const zonder = W.bepaalWeekendOntwijkers(med, ros, [], vandaag, 3, [], null);
assert.strictEqual(zonder[0].beschikbaarheid.status, 'onbekend'); assert.strictEqual(W.beschikbaarheidTekst(zonder[0].beschikbaarheid), '');
// Onderbouwing in de brief
const o = W.berekenWeekendOnderbouwing('2', ros, [], vandaag, 3, besch);
assert.ok(/voor 9 van de 9 weekenddagen \(vrijdag t\/m zondag\) op dat je niet beschikbaar was/.test(o.tekst));
assert.ok(/geen beschikbaarheid opgegeven/.test(W.berekenWeekendOnderbouwing('3', ros, [], vandaag, 3, besch).tekst));
assert.ok(!/Shiftbase/.test(W.berekenWeekendOnderbouwing('3', ros, [], vandaag, 3, null).tekst));
console.log('weekend-beschikbaarheid tests OK');
