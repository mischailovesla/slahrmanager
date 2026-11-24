// v0.56.0 loonronde: deadlines (weekend → werkdag ervoor), open stappen, uren per uurloner, ziektecontrole,
// uitdienst, mutatie-mail en Excel-export. Pure logica; geen netwerk.
const assert = require('assert');
const L = require('../netlify/functions/_lib/loonronde');
const V = require('../netlify/functions/_lib/vastloners');
const X = require('../netlify/functions/_lib/xlsx');
const C = require('../netlify/functions/_lib/config');

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// 1. Periode en standaardmaand
assert.deepStrictEqual(L.periode(2026, 10), { jaar: 2026, maand: 10, label: 'oktober 2026', van: '2026-10-01', tot: '2026-10-31', sleutel: '2026-10' });
assert.throws(() => L.periode(2026, 13));
assert.deepStrictEqual(L.standaardMaand(new Date(2026, 10, 24)), { jaar: 2026, maand: 10 });
assert.deepStrictEqual(L.standaardMaand(new Date(2027, 0, 5)), { jaar: 2026, maand: 12 });

// 2. Deadlines: 6e en 18e van de maand erna; weekend → vrijdag ervoor
assert.strictEqual(iso(L.deadlineVan(2026, 10, 6)), '2026-11-06');   // vrijdag
assert.strictEqual(iso(L.deadlineVan(2026, 11, 6)), '2026-12-04');   // 6 dec = zondag → vrijdag 4 dec
assert.strictEqual(iso(L.deadlineVan(2026, 11, 18)), '2026-12-18');  // vrijdag
assert.strictEqual(iso(L.deadlineVan(2026, 12, 6)), '2027-01-06');   // jaarwisseling
assert.strictEqual(iso(L.deadlineVan(2027, 1, 6)), '2027-02-05');    // 6 feb 2027 = zaterdag → vrijdag

// 3. Stappenoverzicht
const ov = L.stappenOverzicht(2026, 11, { stappen: { uren: { klaar: true, door: 'a@b.nl', tijd: '03-12-2026 10:00' } } }, new Date(2026, 11, 3));
assert.strictEqual(ov.length, 4);
assert.strictEqual(ov[0].klaar, true); assert.strictEqual(ov[0].door, 'a@b.nl');
assert.strictEqual(ov[1].klaar, false); assert.strictEqual(ov[1].dagen, 1); assert.strictEqual(ov[1].deadline, '04-12-2026');
assert.strictEqual(ov[2].dagen, 15); assert.strictEqual(ov[2].deadline, '18-12-2026');

// 4. Uurloners: uren per BV/winkel, ziektecontrole
const gebruiker = (id, v, a, e, teams, extra) => ({ User: Object.assign({ id, first_name: v, last_name: a, email: e || '', enddate: '' }, extra || {}), Team: teams || [] });
const teamCB = [{ id: 't1', name: 'SLA Ceintuurbaan', department_id: '153188' }];
const users = [
  gebruiker('1', 'Lisa', 'Seidelt', 'lisa@x.nl', [{ id: 't9', name: 'SLA Zuidas', department_id: '153189' }]),
  gebruiker('2', 'Piet', 'Jansen', 'piet@x.nl', teamCB),
  gebruiker('3', 'Kees', 'de Vries', 'kees@x.nl', [{ id: 't2', name: 'Keuken', department_id: '999' }]),
  gebruiker('4', 'Els', 'Franchise', 'els@x.nl', [{ id: 't3', name: 'SLA Groningen', department_id: '153187' }]),
  gebruiker('5', 'Mo', 'Leaver', 'mo@x.nl', teamCB, { enddate: '2026-10-20' }),
  gebruiker('6', 'Test', 'Test', 'test@x.nl', teamCB)
];
const med = [
  { id: '1', naam: 'Lisa Seidelt', email: 'lisa@x.nl', functie: 'Senior Store Manager', winkelNaam: 'Zuidas', winkelBv: 'SLA Zuidas BV' },
  { id: '2', naam: 'Piet Jansen', email: 'piet@x.nl', functie: 'SLA-maker', winkelNaam: 'Ceintuurbaan', winkelBv: 'SLA Ceintuur BV' },
  { id: '3', naam: 'Kees de Vries', email: 'kees@x.nl', functie: 'Keukenhulp', winkelNaam: 'Keuken', winkelBv: '' }
];
const ts = (datum, uid, tot, status, dept) => ({ Timesheet: { date: datum, user_id: uid, total: tot, status: status || 'Approved', department_id: dept || '153188' } });
const timesheets = [
  ts('2026-10-03', '2', 6), ts('2026-10-04', '2', 4.5, 'Pending'), ts('2026-10-05', '2', 5, 'Declined'), ts('2026-10-12', '2', 5),
  ts('2026-10-03', '1', 8, 'Approved', '153189'),          // vastloner: telt niet mee
  ts('2026-10-07', '3', 7, 'Approved', '999'),             // keuken: onbekend in SB_DEPT_CODE → naam uit departments
  ts('2026-10-07', '4', 7, 'Approved', '153187'),          // franchise: niet via SLA-salaris
  ts('2026-10-10', '5', 3),
  ts('2026-10-09', '6', 8),                                // 'Test Test' is uitgesloten
  ts('2026-11-01', '2', 8)                                 // buiten de maand
];
const depts = [{ Department: { id: '999', name: 'Keuken' } }];
const abs = (uid, optie, van, tot, hpd, extra) => ({ Absentee: Object.assign({ user_id: uid, absentee_option_id: optie, status: 'Approved', startdate: van, enddate: tot, hours_per_day: hpd }, extra || {}) });
const absentees = [
  abs('2', '1019458', '2026-10-12', '2026-10-13', 0),      // Piet: 0 uur, maar wél uren geklokt op 12-10 → oranje
  abs('5', '1019458', '2026-10-14', '2026-10-14', 6),      // Mo: ziekte staat op 6 uur → rood
  abs('3', '1019458', '2026-10-30', '', 0),                // Kees: loopt nog → grijs
  abs('1', '1019458', '2026-10-12', '2026-10-12', 8),      // vastloner: niet in deze controle
  abs('2', '1019457', '2026-10-20', '2026-10-21', 8)       // vakantie: niet in deze controle
];
const res = L.berekenUurloners({ timesheets, users, teams: [], depts, absentees, typeMap: C.VL_TYPE_MAP, med }, L.periode(2026, 10));
const u = res.uren;
assert.deepStrictEqual(u.regels.map(r => [r.bv, r.winkel, r.naam, r.uren]), [
  ['SLA Ceintuur BV', 'Ceintuurbaan', 'Mo Leaver', 3],
  ['SLA Ceintuur BV', 'Ceintuurbaan', 'Piet Jansen', 15.5],   // 6 + 4,5 (nog niet goedgekeurd) + 5; afgewezen telt niet
  ['SLA Hofhouse BV', 'Keuken', 'Kees de Vries', 7]
]);
assert.strictEqual(u.regels[1].openUren, 4.5);
assert.strictEqual(u.regels[0].einde, '2026-10-20');
assert.deepStrictEqual(u.totaal, { uren: 25.5, medewerkers: 3, regels: 3 });
assert.deepStrictEqual(u.perBv, [{ bv: 'SLA Ceintuur BV', uren: 18.5, medewerkers: 2 }, { bv: 'SLA Hofhouse BV', uren: 7, medewerkers: 1 }]);
assert.strictEqual(u.afgewezen, 1); assert.strictEqual(u.vastOvergeslagen, 1);
assert.ok(u.waarschuwingen.some(w => /1 timesheet\(s\) met 4,5 uur/.test(w)));
assert.strictEqual(u.perDag, undefined);

const z = res.ziekte;
assert.deepStrictEqual(z.totaal, { ziekeMedewerkers: 3, metAfwijking: 3, teCorrigeren: 2, ziekmeldingen: 3 });
assert.deepStrictEqual(z.metAfwijking.map(m => [m.naam, m.ernst]), [['Mo Leaver', 'rood'], ['Piet Jansen', 'oranje'], ['Kees de Vries', 'grijs']]);
assert.strictEqual(z.metAfwijking[0].afwijkingen[0].soort, 'uren'); assert.ok(/6 uur/.test(z.metAfwijking[0].afwijkingen[0].tekst));
assert.strictEqual(z.metAfwijking[1].afwijkingen[0].soort, 'gewerkt'); assert.ok(/12-10-2026 \(5 u\)/.test(z.metAfwijking[1].afwijkingen[0].tekst));
assert.strictEqual(z.metAfwijking[2].afwijkingen[0].soort, 'lopend'); assert.strictEqual(z.metAfwijking[2].periodes[0].dagen, 2); // 30 + 31 oktober
// Een ziekmelding op 0 uur zonder geklokte uren is gewoon goed: geen afwijking
const schoon = L.berekenUurloners({ timesheets: [], users, teams: [], depts, absentees: [abs('2', '1019458', '2026-10-12', '2026-10-13', 0)], typeMap: C.VL_TYPE_MAP, med }, L.periode(2026, 10)).ziekte;
assert.deepStrictEqual(schoon.totaal, { ziekeMedewerkers: 1, metAfwijking: 0, teCorrigeren: 0, ziekmeldingen: 1 });
assert.strictEqual(schoon.medewerkers[0].ernst, 'ok');
// Halve dag ziek met uren geklokt is normaal (deel van de dag gewerkt): wél ziekte-uren blijft rood, maar geen 'gewerkt'-melding
const deel = L.berekenUurloners({ timesheets: [ts('2026-10-12', '2', 3)], users, teams: [], depts, absentees: [abs('2', '1019458', '2026-10-12', '2026-10-12', 0, { partial_day: true })], typeMap: C.VL_TYPE_MAP, med }, L.periode(2026, 10)).ziekte;
assert.strictEqual(deel.totaal.metAfwijking, 0);

// 5. Uitdienst + controle tegen de ontslagdossiers
const users2 = users.filter(x => x.User.id !== '1').concat([
  gebruiker('7', 'Vera', 'Later', 'vera@x.nl', teamCB, { enddate: '2026-12-05' }),                                                                                  // buiten het venster
  gebruiker('1', 'Lisa', 'Seidelt', 'lisa@x.nl', [{ id: 't9', name: 'SLA Zuidas', department_id: '153189' }], { enddate: '2026-11-10' })    // vastloner
]);
const ontslag = [{ naam: 'Mo Leaver', email: '', einddatum: '20-10-2026' }, { naam: 'Ghost Persoon', email: '', einddatum: '25-10-2026' }];
const ud = L.uitdienstLijst(users2, med, ontslag, '2026-10-01', '2026-11-30');
assert.deepStrictEqual(ud.uitdienst.map(x => [x.naam, x.einddatum, x.soort, x.winkel, x.bv]), [
  ['Mo Leaver', '20-10-2026', 'uurloner', 'Ceintuurbaan', 'SLA Ceintuur BV'],
  ['Lisa Seidelt', '10-11-2026', 'vastloner', 'Zuidas', 'SLA Zuidas BV']
]);
assert.deepStrictEqual(ud.venster, { van: '01-10-2026', tot: '30-11-2026' });
assert.strictEqual(ud.controle.filter(c => c.ernst === 'oranje').length, 1);
assert.ok(/Ghost Persoon/.test(ud.controle.find(c => c.ernst === 'oranje').tekst));
assert.ok(ud.controle.some(c => c.ernst === 'grijs' && /Lisa Seidelt/.test(c.tekst)));   // geen ontslagdossier
assert.ok(!ud.controle.some(c => /Mo Leaver/.test(c.tekst)));                              // Mo klopt in beide

// 6. Mutatie-mail voor Mahdia
const vastloners = [{ id: '1', naam: 'Lisa Seidelt', email: 'lisa@x.nl', functie: 'Senior Store Manager', locatie: 'Zuidas' }, { id: '8', naam: 'Anna Maeda', email: '', functie: 'Store Manager', locatie: 'Utrechtsestraat' }];
const vl = V.berekenMaand(vastloners, [
  abs('1', '1019457', '2026-10-05', '2026-10-07', 8),
  abs('1', '1019458', '2026-10-12', '2026-10-12', 8, { wait_days: 1, wait_hours: 8 })
], C.VL_TYPE_MAP, 2026, 10);
const mail = L.bouwMutatieMail(vl, ud, 'Mischa');
assert.ok(/oktober 2026/.test(mail.subject));
for (const s of ['Hoi Mahdia,', 'MUTATIES VASTLONERS', 'Lisa Seidelt (Zuidas)', 'Vakantie: 3 dag(en) / 24 uur', 'Ziek: 1 dag(en)', 'WACHTDAGEN (ZIEKTE)', '- Lisa Seidelt: 12-10-2026 (8 uur)', 'UIT DIENST (einddatum 01-10-2026 t/m 30-11-2026)', '- Mo Leaver (SLA Ceintuur BV, Ceintuurbaan, uurloner): laatste dag 20-10-2026', 'Geen mutaties bij de overige 1 vastloner(s).', 'Groet,\nMischa'])
  assert.ok(mail.text.indexOf(s) > -1, 'mail mist: ' + s);
assert.ok(mail.text.indexOf('Anna Maeda') === -1, 'vastloner zonder mutatie staat niet in de lijst');
const leeg = L.bouwMutatieMail(V.berekenMaand(vastloners, [], C.VL_TYPE_MAP, 2026, 10), { uitdienst: [], controle: [], venster: { van: '01-10-2026', tot: '30-11-2026' } }, '');
for (const s of ['Geen mutaties in oktober 2026.', 'Geen wachtdagen in oktober 2026.', 'Niemand uit dienst in deze periode.', 'Groet,\nHR']) assert.ok(leeg.text.indexOf(s) > -1, 'lege mail mist: ' + s);

// 7. Excel: schrijven en weer lezen met de eigen lezer
const buf = L.maakXlsx(L.uurlonersBladen(res));
assert.ok(Buffer.isBuffer(buf) && buf.slice(0, 2).toString() === 'PK');
const x = X.lees(buf);
assert.deepStrictEqual(x.kop, ['BV', 'Winkel', 'Medewerker', 'Uren', 'Waarvan nog niet goedgekeurd', 'Laatste dag (uit dienst)']);
assert.deepStrictEqual(x.rijen[1].slice(0, 4), ['SLA Ceintuur BV', 'Ceintuurbaan', 'Piet Jansen', 15.5]);
assert.strictEqual(x.rijen[1][4], 4.5);
assert.strictEqual(x.rijen[x.rijen.length - 1][2], 'TOTAAL'); assert.strictEqual(x.rijen[x.rijen.length - 1][3], 25.5);
// speciale tekens blijven heel (& < > ")
const speciaal = X.lees(L.maakXlsx([{ naam: 'Test: blad?', kolommen: [{ kop: 'Naam' }, { kop: 'Uren', uren: true }], rijen: [['A & B <C> "D"', 1.25]] }]));
assert.deepStrictEqual(speciaal.rijen[0], ['A & B <C> "D"', 1.25]);

// 8. Open stappen (signalering): venster en LOONRONDE_VANAF
(async () => {
  const zonder = async () => ({ stappen: {}, mail: null });
  assert.ok(/^\d{4}-\d{2}$/.test(C.LOONRONDE_VANAF));
  let open = await L.openStappen(new Date(2026, 11, 3), zonder);
  assert.deepStrictEqual(open.map(x => x.stap), ['uren', 'ziekte']);                  // de 18e is nog ver weg
  assert.ok(/over 1 dag/.test(open[0].sub)); assert.ok(/november 2026/.test(open[0].titel));
  open = await L.openStappen(new Date(2026, 11, 3), async () => ({ stappen: { ziekte: { klaar: true } }, mail: null }));
  assert.deepStrictEqual(open.map(x => x.stap), ['uren']);                            // afgevinkt = weg
  open = await L.openStappen(new Date(2026, 11, 16), zonder);                         // 6e is 12 dagen geleden: buiten het venster
  assert.deepStrictEqual(open.map(x => x.stap), ['mutaties', 'uitdienst']);
  open = await L.openStappen(new Date(2026, 11, 21), zonder);                         // 3 dagen na de 18e
  assert.deepStrictEqual(open.map(x => [x.stap, x.dagen]), [['mutaties', -3], ['uitdienst', -3]]);
  assert.ok(/3 dagen te laat/.test(open[0].sub));
  open = await L.openStappen(new Date(2026, 10, 20), zonder);                         // oktober valt vóór LOONRONDE_VANAF: geen alarm voor de oude ronde
  assert.deepStrictEqual(open, []);
})().catch(e => { console.error('✗ loonronde (open stappen): ' + e.message); process.exit(1); });
