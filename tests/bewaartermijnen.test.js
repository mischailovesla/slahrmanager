const assert = require('assert');
const B = require('../netlify/functions/_lib/bewaartermijnen.js');
const vandaag = new Date(2026, 9, 22);
const users = [
  { User: { id: '1', first_name: 'Anna', last_name: 'Actief', email: 'anna@x.nl', enddate: '' } },
  { User: { id: '2', first_name: 'Bram', last_name: 'Weg', email: 'bram@x.nl', enddate: '2023-03-01' } },
  { User: { id: '3', first_name: 'Carla', last_name: 'Oud', email: 'carla@x.nl', enddate: '2020-06-15' } },
  { User: { id: '4', first_name: 'Dirk', last_name: 'Recent', email: 'dirk@x.nl', enddate: '2025-12-31' } },
  { User: { id: '5', first_name: 'Eva', last_name: 'Toekomst', email: 'eva@x.nl', enddate: '2026-12-31' } }
];
const sb = B.shiftbaseIndex(users, vandaag);
const data = {
  hr_loonheffing: [
    { rij: 2, naam: 'Anna Actief', email: 'anna@x.nl', verzenddatum: 'Verzonden op 01-01-2015' },
    { rij: 3, naam: 'Bram Weg', email: 'bram@x.nl', verzenddatum: '01-02-2022' },
    { rij: 4, naam: 'Carla Oud', email: '', verzenddatum: '01-02-2019' },
    { rij: 5, naam: 'Zoë Onbekend', email: 'zoe@y.nl', verzenddatum: '01-02-2018' }],
  hr_ontslag: [
    { rij: 2, naam: 'Bram Weg', email: 'bram@x.nl', einddatum: '01-03-2023' },
    { rij: 3, naam: 'Dirk Recent', email: 'dirk@x.nl', einddatum: '31-12-2025' },
    { rij: 4, naam: 'Eva Toekomst', email: 'eva@x.nl', einddatum: '31-12-2026' },
    { rij: 5, naam: 'Zoë Onbekend', email: '', einddatum: '01-05-2023' }],
  hr_mails: [
    { id: 1, naam: 'Bram Weg', naar: 'mafshari@hrmonline.nl', tijdstip: '2023-02-20T10:00:00Z' },
    { id: 2, naam: 'HR-team', naar: 'mischa@ilovesla.com', tijdstip: '2020-01-01T10:00:00Z' }],
  hr_uploads: [{ id: 'u1', soort: 'loon', naam: 'Bram Weg', email: '', created_at: '2022-02-03T00:00:00Z', bestanden: [{ pad: 'loon/bram/a.pdf' }] },
               { id: 'u2', soort: 'ontslag', naam: 'Bram Weg', email: '', created_at: '2023-02-03T00:00:00Z', bestanden: [{ pad: 'ontslag/bram/b.pdf' }] }],
  hr_exit: [{ id: 'e1', naam: 'Bram Weg', email: 'bram@x.nl', medewerker_id: '2', ingevuld_op: '2023-03-05T00:00:00Z' }, { id: 'e2', naam: '', email: '', medewerker_id: null, ingevuld_op: '2020-01-01' }]
};
const r = B.bereken(data, sb, vandaag);
const by = Object.fromEntries(r.personen.map(p => [p.naam, p]));
// Anna actief: nooit
assert(!by['Anna Actief'], 'actief mag niet');
// Eva: einddatum in de toekomst = actief
assert(!by['Eva Toekomst']);
// Dirk: uit dienst 31-12-2025: dossier vervalt 31-12-2027 -> niet
assert(!by['Dirk Recent']);
// Bram: uit 01-03-2023 -> dossier vervalt 01-03-2025 (ja); fiscaal 01-01-2029 (nee)
const b = by['Bram Weg']; assert(b, 'Bram moet erin');
const tab = Object.fromEntries(b.items.map(i => [i.tabel, i]));
assert(tab.hr_ontslag && tab.hr_mails && tab.hr_exit && tab.hr_uploads, JSON.stringify(b.items));
assert(!tab.hr_loonheffing, 'loonheffing Bram is fiscaal, nog niet');
assert.strictEqual(tab.hr_uploads.aantal, 1, 'alleen de ontslag-upload, niet de loon-upload');
assert.strictEqual(b.bestanden, 1); assert.strictEqual(b.ankerBron, 'shiftbase'); assert.strictEqual(tab.hr_exit.actie, 'anonimiseer');
// Carla: uit 15-06-2020 -> fiscaal vervalt 01-01-2026 -> ja (gekoppeld op naam)
assert(by['Carla Oud'] && by['Carla Oud'].items[0].tabel === 'hr_loonheffing');
// Zoë: niet in Shiftbase, laatste activiteit 01-05-2023 -> dossier ja (ontslag), fiscaal 01-01-2029 nee; samengevoegd via naam->email alias
const z = by['Zoë Onbekend']; assert(z && !z.gekoppeld && z.ankerBron === 'laatste-activiteit' && z.anker === '2023-05-01', JSON.stringify(z));
assert.deepStrictEqual(z.items.map(i => i.tabel), ['hr_ontslag']);
// HR-team mail is geen persoon
assert(!r.personen.some(p => /hr/i.test(p.naam)));
// niet-gekoppelden achteraan
assert(!r.personen[r.personen.length - 1].gekoppeld);
// selecteerRijen geeft dezelfde aantallen als bereken
const sel = B.selecteerRijen(data, sb, b, new Date(2026, 9, 22));
assert.strictEqual(sel.length, b.aantal);
// vervaldatums
assert.strictEqual(B.vervalt(new Date(2020, 5, 15), 'fiscaal').toLocaleDateString('sv-SE'), '2026-01-01');
assert.strictEqual(B.vervalt(new Date(2023, 2, 1), 'dossier').toLocaleDateString('sv-SE'), '2025-03-01');
// datumUit
assert.strictEqual(B.datumUit('Verzonden op 3-4-2024 10:00').toLocaleDateString('sv-SE'), '2024-04-03');
assert.strictEqual(B.datumUit('2024-04-03T22:30:00Z').toLocaleDateString('sv-SE'), '2024-04-03');
assert.strictEqual(B.datumUit('Ja'), null);
// strip
assert.deepStrictEqual(B.stripAntwoorden({ q1: 4, q2: 'studie', q3: 'Ik vond de sfeer niet fijn', q7__toelichting: 'abc', nps: 8 }), { q1: 4, q2: 'studie', nps: 8 });
console.log('alle tests OK —', r.personen.length, 'personen:', r.personen.map(p => p.naam + '(' + p.aantal + ')').join(', '), '| inDienst', r.inDienst, '| binnenkort', r.binnenkort);
