// v0.53.2: herinnering om een waarschuwing voor gezien te tekenen + koppeling tekenstatus aan de logregel
const assert = require('assert');
const SIG = require('../netlify/functions/_lib/signaleringen');
const ON = require('../netlify/functions/_lib/ondertekening');

const r = (id, aangemaakt, extra) => Object.assign({ id, naam: 'Test ' + id, email: id + '@x.nl', status: 'wacht', aangemaakt, taal: 'NL' }, extra || {});
const lijst = [
  r('a', '2026-11-16'),                                  // 1 dag oud: nog niet
  r('b', '2026-11-14'),                                  // 3 dagen: eerste herinnering
  r('c', '2026-11-08'),                                  // 2x herinnerd, laatste 3 dagen geleden: derde
  r('d', '2026-11-08'),                                  // laatste herinnering gisteren: wachten
  r('e', '2026-11-01'),                                  // al 3x: klaar
  r('f', '2026-11-10', { status: 'getekend' }),          // getekend: nooit
  r('g', '2026-11-10', { email: '' }),                   // geen e-mail
  r('h', '2026-09-01')                                   // link verlopen: niet meer
];
const her = { c: ['2026-11-11', '2026-11-14'], d: ['2026-11-11', '2026-11-16'], e: ['2026-11-04', '2026-11-07', '2026-11-10'] };
assert.deepStrictEqual(SIG.tekenHerinnerKandidaten(lijst, her, '2026-11-17').map(x => x.id), ['b', 'c']);

const nl = SIG.tekenHerinnerMail(r('b', '2026-11-14', { naam: 'Kenza Oulammou' }), 'https://link/x');
assert.ok(/^Herinnering/.test(nl.subject) && /Beste Kenza,/.test(nl.text) && /14-11-2026/.test(nl.text) && /https:\/\/link\/x/.test(nl.text));
assert.ok(/link\/x/.test(nl.html) && /Voor gezien tekenen/.test(nl.html));
const en = SIG.tekenHerinnerMail(r('b', '2026-11-14', { naam: 'Kenza Oulammou', taal: 'EN' }), 'https://link/x');
assert.ok(/^Reminder/.test(en.subject) && /Dear Kenza,/.test(en.text) && /Sign as seen/.test(en.html));

// koppel: logregel (naam + verzenddatum) -> ondertekening; rij gaat voor
const st = [{ id: '1', naam: 'Kenza Oulammou', rij: 13, aangemaakt: '2026-11-16', status: 'wacht' }, { id: '2', naam: 'Kenza Oulammou', rij: 20, aangemaakt: '2026-11-20', status: 'getekend' }];
assert.strictEqual(ON.koppel(st, { naam: 'Kenza  Oulammou', verzenddatum: '16-11-2026 10:26', rij: 13 }).id, '1');
assert.strictEqual(ON.koppel(st, { naam: 'Kenza Oulammou', verzenddatum: '20-11-2026 09:00' }).id, '2');
assert.strictEqual(ON.koppel(st, { naam: 'Iemand Anders', verzenddatum: '16-11-2026 10:26' }), null);
console.log('teken-herinneringen tests OK');
