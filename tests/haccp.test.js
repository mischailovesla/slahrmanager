// v0.50.0 HACCP-naleving: rooster uit Shiftbase + lijsten uit Academy -> wie stond in het tijdvak van een niet afgeronde lijst
const assert = require('assert');
const H = require('../netlify/functions/_lib/haccp');

// Shiftbase-rosters (afdeling 153130 = Middenweg, 152898 = Voorstraat; 999 = onbekend/keuken -> weg; user 0 = open dienst -> weg)
const rosters = { data: [
  { Roster: { id: 1, user_id: 11, department_id: 153130, date: '2026-11-14', starttime: '08:00:00', endtime: '16:00:00' } },
  { Roster: { id: 2, user_id: 12, department_id: 153130, date: '2026-11-14', starttime: '13:15:00', endtime: '21:30:00' } },   // 15 min overlap: telt niet
  { Roster: { id: 3, user_id: 13, department_id: 153130, date: '2026-11-14', starttime: '16:00:00', endtime: '22:00:00' } },   // alleen avond
  { Roster: { id: 4, user_id: 11, department_id: 153130, date: '2026-11-15', starttime: '09:00:00', endtime: '17:00:00' } },
  { Roster: { id: 5, user_id: 0, department_id: 153130, date: '2026-11-15', starttime: '09:00:00', endtime: '17:00:00' } },
  { Roster: { id: 6, user_id: 14, department_id: 999, date: '2026-11-14', starttime: '07:00:00', endtime: '15:00:00' } },
  { Roster: { id: 7, user_id: 15, department_id: 152898, date: '2026-11-14', starttime: '10:00:00', endtime: '18:00:00' } },
  { Roster: { id: 7, user_id: 15, department_id: 152898, date: '2026-11-14', starttime: '10:00:00', endtime: '18:00:00' } }    // dubbel -> één keer
] };
const users = [{ User: { id: 11, first_name: 'Nynke', last_name: 'Moorman' } }, { User: { id: 12, first_name: 'Lena', last_name: 'Hemmink' } }, { User: { id: 13, first_name: 'Avond', last_name: 'Mens' } }, { User: { id: 15, first_name: 'Laura', last_name: 'Janssen' } }];
const d = H.rooster(rosters, users);
assert.strictEqual(d.length, 5);
assert.deepStrictEqual(d[0], { uid: '11', naam: 'Nynke Moorman', code: 'MW', datum: '2026-11-14', start: 480, eind: 960 });

const lijsten = [
  { datum: '2026-11-14', code: 'MW', winkel: 'Middenweg', lijst: 'HACCP dag', van: '06:00', tot: '13:30', status: 'gemist' },
  { datum: '2026-11-15', code: 'MW', winkel: 'Middenweg', lijst: 'HACCP dag', van: '06:00', tot: '13:30', status: 'gemist' },
  { datum: '2026-11-14', code: 'VS', winkel: 'Voorstraat', lijst: 'HACCP dag', van: '06:00', tot: '13:30', status: 'laat', klaar: '15:02' },
  { datum: '2026-11-16', code: 'VS', winkel: 'Voorstraat', lijst: 'HACCP dag', van: '06:00', tot: '13:30', status: 'gemist' },   // geen rooster: dicht
  { datum: '2026-11-14', code: 'MW', winkel: 'Middenweg', lijst: 'Temp. warm', van: '06:00', tot: '13:00', status: 'ok' }
];
const a = H.analyseer(lijsten, d, { winkels: [{ code: 'MW', naam: 'Middenweg' }, { code: 'VS', naam: 'Voorstraat' }] });
const mw = a.winkels.find(w => w.code === 'MW'), vs = a.winkels.find(w => w.code === 'VS');
assert.deepStrictEqual([mw.verwacht, mw.gemist, mw.laat, mw.dicht], [3, 2, 0, 0]);
assert.deepStrictEqual([vs.verwacht, vs.gemist, vs.laat, vs.dicht], [1, 0, 1, 1], 'dag zonder rooster telt niet');
assert.strictEqual(a.totaal.gemist, 2);
assert.strictEqual(a.medewerkers.length, 1, 'alleen wie in het tijdvak stond bij een gemiste lijst');
const n = a.medewerkers[0];
assert.deepStrictEqual([n.naam, n.inTijdvak, n.gemist, n.pct, n.laatste], ['Nynke Moorman', 3, 2, 67, '2026-11-15']);
assert.strictEqual(a.gemist[0].datum, '2026-11-15');
assert.deepStrictEqual(a.gemist[1].ploeg.map(p => p.naam), ['Nynke Moorman'], 'Lena (15 min overlap) en avonddienst niet');
// filter op lijst
assert.strictEqual(H.analyseer(lijsten, d, { lijst: 'Temp. warm' }).totaal.gemist, 0);
// toelichting voor de waarschuwing
const t = H.toelichting(n, false);
assert.ok(/14-11-2026 · Middenweg · HACCP dag \(af te ronden 06:00–13:30\) · jouw dienst 08:00–16:00/.test(t), t);
assert.ok(/your shift 09:00–17:00/.test(H.toelichting(n, true)));
// nieuwe huisregels
const T = require('../netlify/functions/_lib/sjablonen');
assert.strictEqual(T.regelsById(['HR50', 'HR57', 'HR61']).length, 3);
console.log('✓ haccp');
