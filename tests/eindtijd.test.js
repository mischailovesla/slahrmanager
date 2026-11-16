// v0.48.0 Eindtijd & afsluiten: xlsx-lezer, beide bronnen, berekening (sluitdienst, middernacht, zonder uitklok, drempels) en sjablonen
const assert = require('assert');
const Z = require('../netlify/functions/_lib/zip');
const X = require('../netlify/functions/_lib/xlsx');
const E = require('../netlify/functions/_lib/eindtijd');

// ---------- 1. Een mini-export als echte xlsx (zelfde kolommen als Shiftbase "Urenregistratie") ----------
const KOP = ['Gebruikers-id', 'Naam', 'Datum', 'Team', 'Afdeling-id', 'Status', 'Rooster starttijd', 'Rooster eindtijd', 'Eindtijd', 'Uitgeklokt om', 'Gewerkt', 'Rooster totaal', 'Uurloon', 'Contracttype', 'Gekeurd door'];
const serie = iso => Date.parse(iso + 'T00:00:00Z') / 864e5 + 25569;
const klok = (iso, hm) => { const [h, m] = hm.split(':').map(Number); return serie(iso) + (h * 60 + m) / 1440; };
// [uid, naam, datum, status, rStart, rEind, eindtijd, uitklok(datum+tijd | null), gewerkt, roosterTotaal]
const RIJEN = [
  ['1', 'Anna Test', '2026-10-05', 'Goedgekeurd', '17:00:00', '21:30:00', '22:40:00', ['2026-10-05', '22:40'], 5.2, 4.0],   // +70
  ['1', 'Anna Test', '2026-10-06', 'Goedgekeurd', '17:00:00', '21:30:00', '22:15:00', ['2026-10-06', '22:15'], 4.8, 4.0],   // +45
  ['1', 'Anna Test', '2026-10-07', 'Goedgekeurd', '17:00:00', '21:30:00', '23:00:00', null, 5.5, 4.0],                       // +90 zonder uitklok
  ['1', 'Anna Test', '2026-10-08', 'Onbeslist', '17:00:00', '21:30:00', '00:20:00', ['2026-10-09', '00:20'], 6.8, 4.0],     // +170 over middernacht
  ['1', 'Anna Test', '2026-10-09', 'Afgekeurd', '17:00:00', '21:30:00', '23:59:00', ['2026-10-09', '23:59'], 6.9, 4.0],     // telt niet
  ['2', 'Bram Voorbeeld', '2026-10-05', 'Goedgekeurd', '16:00:00', '21:30:00', '21:40:00', ['2026-10-05', '21:40'], 5.2, 5.0], // +10
  ['2', 'Bram Voorbeeld', '2026-10-06', 'Goedgekeurd', '16:00:00', '21:30:00', '22:10:00', ['2026-10-06', '22:10'], 5.6, 5.0], // +40
  ['2', 'Bram Voorbeeld', '2026-10-07', 'Goedgekeurd', '09:00:00', '17:00:00', '18:30:00', ['2026-10-07', '18:30'], 9.0, 7.5], // geen sluitdienst
  ['3', 'Cas Keuken', '2026-10-05', 'Goedgekeurd', '17:00:00', '22:00:00', '23:30:00', ['2026-10-05', '23:30'], 6.5, 5.0]       // andere afdeling (keuken)
];
const strings = [], sidx = s => { let i = strings.indexOf(s); if (i < 0) { strings.push(s); i = strings.length - 1; } return i; };
const col = i => String.fromCharCode(65 + i);
const cel = (r, c, v) => v == null ? '' : typeof v === 'number' ? '<c r="' + col(c) + r + '"><v>' + v + '</v></c>' : '<c r="' + col(c) + r + '" t="s"><v>' + sidx(String(v)) + '</v></c>';
let rows = '<row r="1">' + KOP.map((k, c) => cel(1, c, k)).join('') + '</row>';
RIJEN.forEach((x, i) => {
  const r = i + 2, dept = x[1] === 'Cas Keuken' ? '153193' : '153141', team = x[1] === 'Cas Keuken' ? 'SLA Keuken' : 'SLA Den Haag';
  const w = [x[0], x[1], serie(x[2]), team, dept, x[3], x[4], x[5], x[6], x[7] ? klok(x[7][0], x[7][1]) : null, x[8], x[9], 14.5, 'Nul uren', 'Store Manager'];
  rows += '<row r="' + r + '">' + w.map((v, c) => cel(r, c, v)).join('') + '</row>';
});
const sheet = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows + '</sheetData></worksheet>';
const sst = '<?xml version="1.0"?><sst>' + strings.map(s => '<si><t>' + s.replace(/&/g, '&amp;') + '</t></si>').join('') + '</sst>';
const xlsx = Z.schrijf([{ naam: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet) }, { naam: 'xl/sharedStrings.xml', data: Buffer.from(sst) }]);

const blad = X.lees(xlsx);
assert.deepStrictEqual(blad.kop, KOP);
assert.strictEqual(blad.rijen.length, RIJEN.length);
assert.throws(() => E.vanExport({ kop: ['Naam'], rijen: [] }), /geen Shiftbase-export/);

const WINKELS = { '153141': { code: 'KP', naam: 'Kerkplein' } };
const a = E.analyseer(E.vanExport(blad), { winkels: WINKELS });
assert.deepStrictEqual(Object.keys(a.winkels), ['KP'], 'keuken telt niet mee');
const w = a.winkels.KP;
assert.strictEqual(w.naam, 'Den Haag', 'winkelnaam uit het Shiftbase-team');
assert.strictEqual(w.team.sluitdiensten, 6, 'afgekeurd + dagdienst tellen niet');
const anna = w.medewerkers.find(m => m.naam === 'Anna Test'), bram = w.medewerkers.find(m => m.naam === 'Bram Voorbeeld');
assert.strictEqual(anna.aantalTotaal, 4);
assert.strictEqual(anna.aantalLaat, 4);
assert.strictEqual(anna.aantalNa22, 4, '00:20 de volgende dag telt als na 22:00');
assert.strictEqual(anna.gemMin, Math.round((70 + 45 + 90 + 170) / 4));
assert.strictEqual(anna.zonderUitklok, 1);
assert.deepStrictEqual(anna.ergste, { datum: '2026-10-08', roosterEind: '21:30', uitklok: '00:20', laat: 170, zonderUitklok: false });
assert.strictEqual(anna.voorgedragen, true);
assert.strictEqual(bram.aantalLaat, 1); assert.strictEqual(bram.voorgedragen, false);
// Team per avond: 05-10 laatste uitklok 22:40 (+70), 06-10 22:15 (+45), 07-10 23:00 (+90), 08-10 00:20 (+170)
assert.strictEqual(w.team.avonden, 4);
assert.strictEqual(w.team.gemMin, Math.round((70 + 45 + 90 + 170 + 10 + 40) / 6), 'gemiddelde over alle sluitdiensten');
assert.strictEqual(w.team.pctAvonden30, 100);
assert.strictEqual(w.team.maxMin, 170);
assert.strictEqual(w.team.besteDagen, '', 'geen enkele dag gemiddeld binnen 30 min');
// Extra uren = gewerkt - rooster (alleen positief) op sluitdiensten
assert.strictEqual(w.kosten.extraUren, Math.round(((1.2 + 0.8 + 1.5 + 2.8) + (0.2 + 0.6)) * 10) / 10);
assert.strictEqual(w.goedkeuring[0].naam, 'Store Manager'); assert.strictEqual(w.goedkeuring[0].aantal, 5, 'onbeslist telt niet als goedgekeurd');
// Periode filtert
const a2 = E.analyseer(E.vanExport(blad), { van: '2026-10-06', tot: '2026-10-07', winkels: WINKELS });
assert.strictEqual(a2.winkels.KP.team.sluitdiensten, 3);
assert.strictEqual(a2.periode.tekst, '6 oktober t/m 7 oktober 2026');

// ---------- 2. Zelfde via de Shiftbase-API-vorm ----------
const api = E.vanApi({
  users: [{ User: { id: '1', first_name: 'Anna', last_name: 'Test' } }, { User: { id: '9', first_name: 'Sam', last_name: 'Manager' } }],
  teams: [{ Team: { id: '228005', department_id: '153141', name: 'SLA Den Haag' } }],
  rosters: [{ Roster: { id: '500', date: '2026-10-08', starttime: '17:00:00', endtime: '21:30:00', total: 4, department_id: '153141', Department: { id: '153141', name: 'SLA Den Haag' } } },
    { Roster: { id: '501', date: '2026-10-10', starttime: '18:00:00', endtime: '00:30:00', total: 6, department_id: '153141' } }],
  timesheets: [
    { Timesheet: { id: 't1', user_id: '1', date: '2026-10-08', roster_id: '500', team_id: '228005', status: 'Approved', clocked_out: '2026-10-09 00:20:00', endtime: '00:20:00', total: '6.8', wage: '14.50', reviewed_by: '9' } },
    { Timesheet: { id: 't2', user_id: '1', date: '2026-10-10', roster_id: '501', team_id: '228005', status: 'Pending', clocked_out: null, endtime: '01:00:00', total: '7', wage: '14.50' } },
    { Timesheet: { id: 't3', user_id: '1', date: '2026-10-11', roster_id: null, team_id: '228005', status: 'Approved', clocked_out: '2026-10-11 23:00:00', total: '5' } },
    { Timesheet: { id: 't4', user_id: '1', date: '2026-10-12', roster_id: '500', team_id: '228005', status: 'Declined', clocked_out: '2026-10-12 23:00:00', total: '5' } }
  ]
});
const b = E.analyseer(api, { winkels: WINKELS }).winkels.KP;
assert.strictEqual(b.team.sluitdiensten, 2, 'zonder rooster en afgekeurd tellen niet');
const anna2 = b.medewerkers[0];
assert.strictEqual(anna2.naam, 'Anna Test');
assert.deepStrictEqual(anna2.diensten.map(d => [d.datum, d.roosterEind, d.eind, d.laat, d.zonderUitklok]), [['2026-10-08', '21:30', '00:20', 170, false], ['2026-10-10', '00:30', '01:00', 30, true]]);
assert.strictEqual(anna2.aantalLaat, 1, 'precies 30 min is niet "meer dan 30"');
assert.strictEqual(b.goedkeuring[0].naam, 'Sam Manager');

// ---------- 3. Sjablonen ----------
const v = Object.assign(E.medewerkerVars(anna, w, a.periode), { voornaam: 'Anna', datum_eerder_bericht: '17 november 2026', ingangsdatum: '1 december 2026', afzender_naam: 'Test Afzender', afzender_functie: 'HR' });
const met = E.vul(E.WAARSCHUWING.tekst, v, { eerder: true, contract: true });
assert.ok(/Op 17 november 2026 hebben we het team van SLA Den Haag/.test(met));
assert.ok(/verlenging van je contract/.test(met));
assert.ok(/\*\*4 van 4\*\*/.test(met));
assert.ok(/donderdag 8 oktober 2026\*\*: geroosterd tot 21:30, uitgeklokt om 00:20/.test(met));
assert.deepStrictEqual(E.openVariabelen(met), []);
const zonder = E.vul(E.WAARSCHUWING.tekst, v, { eerder: false, contract: false });
assert.ok(!/17 november/.test(zonder) && /^Beste Anna,\n\nIn de klokdata zien we/.test(zonder));
assert.ok(!/verlenging van je contract/.test(zonder));
const team = E.vul(E.TEAMBRIEF.tekst, Object.assign(E.teamVars(w, a.periode), { ingangsdatum: '1 december 2026' }), { beste: false });
assert.deepStrictEqual(E.openVariabelen(team, ['voornaam']), ['afzender_naam', 'afzender_functie']);
assert.ok(/gemiddeld 71 minuten later/.test(team) && /op 100% van de dagen/.test(team) && !/Het kan dus/.test(team));
const html = E.naarHtml('Hallo **vet**\n\n1. een\n2. twee\n\n- a\n- b <x>');
assert.ok(/<strong>vet<\/strong>/.test(html) && /<ol/.test(html) && /<ul/.test(html) && /&lt;x&gt;/.test(html));
assert.strictEqual(E.naarPdfTekst('- a\n1. b'), '• a\n1. b');
assert.strictEqual(E.opsomming(['maandag', 'dinsdag', 'zaterdag']), 'maandag, dinsdag en zaterdag');

console.log('eindtijd tests OK');
