// v0.46.0 fooiverdeling: plaktekst, BV-sleutel (50% uren / 50% omzet), verdeling per medewerker op uren
const assert = require('assert');
const F = require('../netlify/functions/_lib/fooi');

// 1. Tabel uit de mail van Jop (oktober 2026)
const mail = `Winkel	Gratuity (EUR)
Ceintuurbaan + Westerstraat	1.142,05
Amstelveenseweg	1.036,99
Middenweg + Haarlemmerdijk	965,15
Utrechtsestraat	854,35
Hoog Catharijne	639,82
Den Haag (Kerkplein)	628,78
Franchise (StoppelsLuinge)	553,45
Haarlem	477,38
Utrecht (Voorstraat)	369,98
Admiraal de Ruijter	267,01
Zuidas	210,93
Totaal	7.145,89`;
const p = F.leesPlaktekst(mail);
assert.deepStrictEqual(p.potten, { ceintuur: 1142.05, AW: 1036.99, midden: 965.15, US: 854.35, HC: 639.82, KP: 628.78, VS: 369.98, AD: 267.01, ZA: 210.93 });
assert.strictEqual(p.genegeerd.length, 3, 'franchise, Haarlem en Totaal genegeerd');
assert.strictEqual(p.onbekend.length, 0);
assert.strictEqual(F.bedrag('1.142,05'), 1142.05); assert.strictEqual(F.bedrag('7,145.89'), 7145.89); assert.strictEqual(F.bedrag('965.15'), 965.15);
assert.strictEqual(F.bedrag('€ 1.036'), 1036); assert.strictEqual(F.bedrag('12,5'), 12.5);

// 2. Grootste-rest telt exact op
const c = F.verdeelCenten(100, [1, 1, 1]); assert.strictEqual(c.reduce((a, b) => a + b, 0), 100); assert.deepStrictEqual(c, [34, 33, 33]);

// 3. Sleutel = Excel-template (okt 2026: CB 725,41 u / € 52.234,01 — WS 652,94 u / € 37.465,00)
const regels = [
  { userId: '1', naam: 'Anna', code: 'CB', uren: 425.41 }, { userId: '2', naam: 'Bram', code: 'CB', uren: 300 },
  { userId: '2', naam: 'Bram', code: 'WS', uren: 52.94 }, { userId: '3', naam: 'Cas', code: 'WS', uren: 600 },
  { userId: '4', naam: 'Dewi', code: 'MW', uren: 612 }, { userId: '5', naam: 'Eva', code: 'HD', uren: 637.86 },
  { userId: '6', naam: 'Fleur', code: 'AW', uren: 100 }, { userId: '7', naam: 'Gijs', code: 'AW', uren: 50 }
];
const omzet = { CB: 52234.01, WS: 37465.00, MW: 41115.33, HD: 39334.26 };
const r = F.bereken({ potten: { ceintuur: 1142.05, midden: 965.15, AW: 1036.99 }, regels, omzet });
const w = code => [].concat(...r.potten.map(x => x.winkels)).find(x => x.code === code);
assert.strictEqual(w('CB').fooi, 633.05); assert.strictEqual(w('WS').fooi, 509.00);
assert.strictEqual(w('MW').fooi, 482.92); assert.strictEqual(w('HD').fooi, 482.23);
assert.strictEqual(w('AW').fooi, 1036.99);
assert.strictEqual(Math.round(w('AW').medewerkers.reduce((a, m) => a + m.fooi, 0) * 100), 103699, 'winkel telt exact op');
assert.strictEqual(w('AW').medewerkers[0].naam, 'Fleur'); assert.strictEqual(w('AW').medewerkers[0].fooi, 691.33);
const bram = r.medewerkers.find(m => m.naam === 'Bram');
assert.strictEqual(bram.delen.length, 2, 'Bram werkte in twee winkels'); assert.strictEqual(r.totaal.meerdereWinkels, 1);
assert.strictEqual(r.totaal.fooi, 3144.19); assert.strictEqual(r.totaal.verdeeld, 3144.19); assert.strictEqual(r.totaal.nietVerdeeld, 0);

// 4. Omzet ontbreekt -> gedeelde pot niet verdeeld, handmatige omzet lost het op
const r2 = F.bereken({ potten: { ceintuur: 100 }, regels, omzet: {} });
assert.strictEqual(r2.potten[0].status, 'omzet'); assert.strictEqual(r2.potten[0].winkels[0].fooi, null);
const r3 = F.bereken({ potten: { ceintuur: 100 }, regels, omzet: {}, handmatig: { CB: '52.234,01', WS: '37465' } });
assert.strictEqual(r3.potten[0].status, 'ok'); assert.strictEqual(r3.potten[0].winkels[0].omzetBron, 'handmatig');

// 5. Fooi zonder uren -> waarschuwing en niet verdeeld
const r4 = F.bereken({ potten: { ZA: 50 }, regels, omzet });
assert.strictEqual(r4.totaal.nietVerdeeld, 50); assert.ok(r4.waarschuwingen.some(x => /Zuidas/.test(x)));

// 6. Timesheets: afdeling via team, afgewezen eruit, open telt mee, HQ eruit, buiten de maand eruit
const ts = [
  { Timesheet: { user_id: 1, team_id: 't1', date: '2026-10-02', total: '8.5', status: 'Approved' } },
  { Timesheet: { user_id: 1, department_id: '153188', date: '2026-10-03', starttime: '10:00:00', endtime: '16:30:00', break: 30, status: 'Pending' } },
  { Timesheet: { user_id: 1, department_id: '153188', date: '2026-10-04', total: '5', status: 'Declined' } },
  { Timesheet: { user_id: 9, department_id: '153191', date: '2026-10-04', total: '8', status: 'Approved' } },
  { Timesheet: { user_id: 1, department_id: '153188', date: '2026-11-01', total: '8', status: 'Approved' } }
];
const v = F.verwerkTimesheets(ts, [{ User: { id: 1, first_name: 'Anna', last_name: 'Jansen' } }], [{ Team: { id: 't1', department_id: '153188' } }], '2026-10-01', '2026-10-31');
assert.deepStrictEqual(v.regels, [{ userId: '1', naam: 'Anna Jansen', code: 'CB', uren: 14.5, uitDienst: '' }]);
// v0.47.1: uit dienst halverwege de maand -> label + waarschuwing
const v2 = F.verwerkTimesheets([{ Timesheet: { user_id: 2, department_id: '153188', date: '2026-10-05', total: 6, status: 'Approved' } }],
  [{ User: { id: 2, first_name: 'Bo', last_name: 'Vos', enddate: '2026-10-15' } }], [], '2026-10-01', '2026-10-31', '2026-11-05');
assert.strictEqual(v2.regels[0].uitDienst, '15-10-2026');
const r5 = F.bereken({ potten: { ceintuur: 10 }, regels: v2.regels.concat([{ userId: '3', naam: 'Cas', code: 'WS', uren: 6 }]), omzet: { CB: 1, WS: 1 } });
assert.strictEqual(r5.totaal.uitDienst, 1); assert.ok(r5.waarschuwingen.some(x => /Bo Vos/.test(x) && /contant/.test(x)));
assert.strictEqual(r5.medewerkers.find(m => m.naam === 'Bo Vos').uitDienst, '15-10-2026');
assert.strictEqual(v.openAantal, 1); assert.strictEqual(v.openUren, 6); assert.strictEqual(v.afgewezen, 1);
assert.deepStrictEqual(F.omzetPerCode([{ winkel: 'Ceintuurbaan', netto: '10.5' }, { winkel: 'Ceintuurbaan', netto: 4.5 }, { winkel: 'Groningen', netto: 99 }]), { CB: 15 });
assert.deepStrictEqual(F.periode(2026, 2), { jaar: 2026, maand: 2, label: 'februari 2026', van: '2026-02-01', tot: '2026-02-28' });
// 7. Omzet uit Shiftbase team_days (team -> afdeling), buiten de maand en verwachte omzet tellen niet
const od = F.omzetUitTeamDays([
  { TeamDay: { team_id: 228093, date: '2026-10-01', turnover: '1000.50', expected_turnover: '900' } },
  { TeamDay: { team_id: 228093, date: '2026-10-02', turnover: 500 } },
  { TeamDay: { team_id: 228093, date: '2026-11-01', turnover: 999 } },
  { TeamDay: { team_id: 228093, date: '2026-10-03', expected_turnover: 800 } },
  { TeamDay: { team_id: 777, date: '2026-10-03', turnover: 50 } }
], [{ Team: { id: '228093', department_id: '153188' } }], '2026-10-01', '2026-10-31');
assert.deepStrictEqual(od, { omzet: { CB: 1500.5 }, dagen: { CB: 2 } });
console.log('fooi tests OK');
