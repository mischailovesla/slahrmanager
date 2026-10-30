// v0.35.0: digitaal indiensttredingsformulier — validatie, keuzelijst, PDF, link
const assert = require('assert'); const I = require('../netlify/functions/_lib/indienst.js'); const T = require('../netlify/functions/_lib/sjablonen.js');
const nu = new Date(2026, 9, 30, 12);
// keuzelijst: eigen winkels + HQ, geen franchise, HQ onderaan
assert.ok(I.WINKELS.length >= 13); assert.ok(!I.WINKELS.some(w => /haarlem$|groningen|amersfoort/i.test(w.naam)));
assert.strictEqual(I.WINKELS[I.WINKELS.length - 1].code, 'HO'); assert.ok(I.WINKELS.some(w => w.naam === 'Kerkplein'));
// BSN 11-proef en IBAN mod-97 (voorbeeldnummers, geen echte personen)
assert.strictEqual(I.bsnOk('111222333'), '111222333'); assert.strictEqual(I.bsnOk('111222334'), ''); assert.strictEqual(I.bsnOk('11122233'), '');
assert.strictEqual(I.ibanOk('nl91abna0417164300'), 'NL91 ABNA 0417 1643 00'); assert.strictEqual(I.ibanOk('NL91ABNA0417164301'), '');
const goed = { vestiging: 'KP', voornaam: 'Test', voorletters: 'tj', achternaam: 'Persoon', geslacht: 'V', adres: 'Teststraat 1', postcode: '1234ab', woonplaats: 'Den Haag', mobiel: '06 12345678', email: 'Test@Voorbeeld.nl', nationaliteit: 'Nederlands', bsn: '111222333', geboortedatum: '2001-06-11', datumIndienst: '2026-11-01', uren: '0', functie: 'SLA worker', iban: 'NL91ABNA0417164300' };
let v = I.valideer(goed, nu);
assert.ok(v.ok, JSON.stringify(v.fouten)); assert.strictEqual(v.schoon.postcode, '1234 AB'); assert.strictEqual(v.schoon.voorletters, 'T.J.'); assert.strictEqual(v.schoon.email, 'test@voorbeeld.nl');
assert.strictEqual(v.schoon.geboortedatum, '11-06-2001'); assert.strictEqual(v.schoon.datumIndienst, '01-11-2026'); assert.strictEqual(v.winkel.bv, 'SLA Den Haag BV');
// fouten
v = I.valideer(Object.assign({}, goed, { vestiging: 'Amsterdam', bsn: '123', iban: 'x', email: 'geen', geboortedatum: '2020-01-01', uren: '60', voornaam: '' }), nu);
assert.deepStrictEqual(Object.keys(v.fouten).sort(), ['bsn', 'email', 'geboortedatum', 'iban', 'uren', 'vestiging', 'voornaam'].sort());
assert.strictEqual(v.fouten.geboortedatum, 'leeftijd');
// gegevens voor de database bevatten geen BSN/IBAN
const z = I.zonderGevoelig(I.valideer(goed, nu).schoon, I.WINKELS.find(w => w.code === 'KP'));
assert.ok(!('bsn' in z) && !('iban' in z)); assert.strictEqual(z.vestigingNaam, 'Kerkplein');
// mail: persoonlijke link, oude Excel-link wordt vervangen
const l = I.link('Test Persoon'); assert.ok(/\/indienst\.html\?t=/.test(l));
const p = T.personaliseerUploadLinks('Vul in: https://slahrmanager.netlify.app/Indiensttredingsformulier_SLA.xlsx\nof https://slahrmanager.netlify.app/indienst.html', 'Test Persoon');
assert.ok(!/xlsx/.test(p)); assert.strictEqual((p.match(/indienst\.html\?t=/g) || []).length, 2);
assert.ok(/indienst\.html\?t=/.test(T.loonUitnodigingHtml ? T.loonUitnodigingHtml('Test Persoon', '05-11-2026') : l));
// PDF
I.maakPdf(I.valideer(goed, nu).schoon, { tijd: nu.toISOString() }).then(b => { assert.ok(b.length > 1000); assert.strictEqual(Buffer.from(b.slice(0, 5)).toString(), '%PDF-'); console.log('indienst tests OK'); })
  .catch(e => { console.error('✗ indienst PDF: ' + e.message); process.exitCode = 1; });
