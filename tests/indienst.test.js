// v0.35.0: digitaal indiensttredingsformulier — validatie, keuzelijst, PDF, link
const assert = require('assert'); const I = require('../netlify/functions/_lib/indienst.js'); const T = require('../netlify/functions/_lib/sjablonen.js');
const nu = new Date(2026, 9, 30, 12);
// keuzelijst: eigen winkels + HQ, geen franchise, HQ onderaan
assert.ok(I.WINKELS.length >= 13); assert.ok(!I.WINKELS.some(w => /haarlem$|groningen|amersfoort/i.test(w.naam)));
assert.strictEqual(I.WINKELS[I.WINKELS.length - 1].code, 'HO'); assert.ok(I.WINKELS.some(w => w.naam === 'Kerkplein'));
// BSN 11-proef en IBAN mod-97 (voorbeeldnummers, geen echte personen)
assert.strictEqual(I.bsnOk('111222333'), '111222333'); assert.strictEqual(I.bsnOk('111222334'), ''); assert.strictEqual(I.bsnOk('11122233'), '');
assert.strictEqual(I.ibanOk('nl91abna0417164300'), 'NL91 ABNA 0417 1643 00'); assert.strictEqual(I.ibanOk('NL91ABNA0417164301'), '');
const goed = { vestiging: 'KP', voornaam: 'Test', voorletters: 'tj', achternaam: 'Persoon', geslacht: 'V', straat: 'Teststraat', huisnummer: '1', toevoeging: 'a', postcode: '1234ab', woonplaats: 'Den Haag', mobiel: '06 12345678', email: 'Test@Voorbeeld.nl', nationaliteit: 'Nederlandse', bsn: '111222333', geboortedatum: '2001-06-11', datumIndienst: '2026-11-01', uren: '0', functie: 'SLA worker', iban: 'NL91ABNA0417164300' };
let v = I.valideer(goed, nu);
assert.ok(v.ok, JSON.stringify(v.fouten)); assert.strictEqual(v.schoon.postcode, '1234 AB'); assert.strictEqual(v.schoon.voorletters, 'T.J.'); assert.strictEqual(v.schoon.email, 'test@voorbeeld.nl');
assert.strictEqual(v.schoon.geboortedatum, '11-06-2001'); assert.strictEqual(v.schoon.datumIndienst, '01-11-2026'); assert.strictEqual(v.winkel.bv, 'SLA Den Haag BV');
// fouten
v = I.valideer(Object.assign({}, goed, { vestiging: 'Amsterdam', bsn: '123', iban: 'x', email: 'geen', geboortedatum: '2020-01-01', uren: '60', voornaam: '' }), nu);
assert.deepStrictEqual(Object.keys(v.fouten).sort(), ['bsn', 'email', 'geboortedatum', 'iban', 'uren', 'vestiging', 'voornaam'].sort(), JSON.stringify(v.fouten));
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
// v0.35.1: retour sturen
{
  const rijen = [{ naam: 'Danique Test', docUrl2: 'sb:11111111-1111-1111-1111-111111111111:indienst' }, { naam: 'Annabel Test', docUrl2: 'sb:22222222-2222-2222-2222-222222222222:indienst' }];
  const lijst = { 'danique test': { reden: 'Vestiging klopt niet', velden: ['vestiging'], ref: rijen[0].docUrl2, op: '2026-10-30T10:00:00Z' }, 'annabel test': { reden: 'x', ref: 'sb:oud' } };
  I.annoteerMet(rijen, lijst);
  assert.strictEqual(rijen[0].indienstRetour.reden, 'Vestiging klopt niet'); // actief: nog hetzelfde formulier
  assert.strictEqual(rijen[1].indienstRetour, undefined);                   // vervallen: er is een nieuwer formulier
  const m = I.retourMail('Danique Test', 'Je hebt Amsterdam ingevuld.', ['vestiging'], false);
  assert.ok(/indienst\.html\?t=/.test(m.html) && /Amsterdam ingevuld/.test(m.text) && /Vestiging/.test(m.text) && /BSN en IBAN/.test(m.text));
  assert.ok(/Location/.test(I.retourMail('Danique Test', 'x', ['vestiging'], true).text));
  assert.deepStrictEqual(I.RETOUR_VELDEN.adres.velden, ['postcode', 'huisnummer', 'toevoeging', 'straat', 'woonplaats']);
  console.log('indienst retour tests OK');
}

// v0.35.2: logische controles
{
  const nu2 = new Date(2026, 9, 30, 12), basis = Object.assign({}, goed);
  let v2 = I.valideer(basis, nu2);
  assert.ok(v2.ok, JSON.stringify(v2.fouten)); assert.strictEqual(v2.schoon.adres, 'Teststraat 1A'); assert.strictEqual(v2.schoon.nationaliteit, 'NL');
  const f = o => I.valideer(Object.assign({}, basis, o), nu2).fouten;
  assert.strictEqual(f({ geboortedatum: '2027-01-01' }).geboortedatum, 'toekomst');
  assert.strictEqual(f({ geboortedatum: '2001-06-11', datumIndienst: '2014-01-01' }).datumIndienst, 'bereik');          // te ver terug
  assert.strictEqual(f({ geboortedatum: '2013-09-01', datumIndienst: '2026-08-01' }).datumIndienst, 'voor-geboorte');    // start vóór 13e verjaardag
  assert.strictEqual(f({ voornaam: 'Annab3l' }).voornaam, 'cijfers'); assert.strictEqual(f({ woonplaats: '1082' }).woonplaats, 'cijfers');
  assert.strictEqual(f({ voorletters: 'K' }).voorletters, 'voorletters');                            // past niet bij 'Test'
  assert.strictEqual(f({ voorletters: 'K', _bevestigd: ['voorletters'] }).voorletters, undefined);     // roepnaam bevestigd
  assert.strictEqual(f({ nationaliteit: 'XX' }).nationaliteitAnders, 'leeg');
  assert.strictEqual(f({ nationaliteit: 'Klingon' }).nationaliteit, 'ongeldig');
  assert.strictEqual(f({ mobiel: '061234567' }).mobiel, 'ongeldig');
  assert.strictEqual(f({ huisnummer: '1a' }).huisnummer, 'ongeldig');
  // adrescontrole met nep-PDOK
  const zoek = async (pc, nr) => pc === '1234 AB' && nr === '1' ? { straat: 'Teststraat', woonplaats: "'s-Gravenhage" } : pc === '1234 AB' ? { geenNummer: true } : null;
  (async () => {
    const s1 = Object.assign({}, v2.schoon); assert.deepStrictEqual(await I.controleerAdres(s1, zoek), {}); assert.strictEqual(s1.woonplaats, 'Den Haag'); // alias blijft staan
    const s2 = Object.assign({}, v2.schoon, { woonplaats: 'Rotterdam' }); const r2 = await I.controleerAdres(s2, zoek); assert.strictEqual(r2.woonplaats, 'pc-woonplaats'); assert.strictEqual(r2._suggestie, "'s-Gravenhage");
    assert.deepStrictEqual(await I.controleerAdres(Object.assign({}, v2.schoon, { huisnummer: '7' }), zoek), { huisnummer: 'pc-huisnummer' });
    assert.deepStrictEqual(await I.controleerAdres(Object.assign({}, v2.schoon, { postcode: '9999 ZZ' }), zoek), { postcode: 'pc-onbekend' });
    assert.deepStrictEqual(await I.controleerAdres(Object.assign({}, v2.schoon, { postcode: 'SW1A 1AA' }), zoek), {}); // buitenland: geen controle
    assert.deepStrictEqual(await I.controleerAdres(Object.assign({}, v2.schoon), async () => undefined), {});            // PDOK onbereikbaar: niet blokkeren
    console.log('indienst adres tests OK');
  })().catch(e => { console.error('✗ indienst adres: ' + e.message); process.exitCode = 1; });
  // HR-controle
  process.env.UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'test';
  const K = require('../netlify/functions/_lib/indienstcontrole.js');
  const gg = I.zonderGevoelig(v2.schoon, I.WINKELS.find(w => w.code === 'KP'));
  assert.ok(gg.bsnHash && gg.bsnHash.length === 32 && !JSON.stringify(gg).includes('111222333') && gg.euer === true && gg.ibanLand === 'NL');
  const form = { 'sb:a:indienst': { naam: 'Test Persoon', gegevens: gg }, 'sb:b:indienst': { naam: 'Ander Iemand', gegevens: Object.assign({}, gg) }, 'sb:c:indienst': { naam: 'Jong Ding', gegevens: Object.assign({}, gg, { geboortedatum: '01-01-2010', nationaliteit: 'IN', euer: false, bsnHash: 'x', email: 'jong@voorbeeld.nl' }) } };
  const med = [{ naam: 'Test Persoon', email: 'test@voorbeeld.nl', winkelCode: 'CB', winkelNaam: 'Ceintuurbaan', indienst: '15-11-2026', contractUren: 20, leeftijd: 25, verjaardag: '2027-06-11' }];
  const rijen = [{ rij: 2, naam: 'Test Persoon', docUrl2: 'sb:a:indienst' }, { rij: 3, naam: 'Jong Ding', docUrl2: 'sb:c:indienst' }, { rij: 4, naam: 'Excel Mens', docUrl2: 'sb:d:loon' }, { rij: 5, naam: 'Al Weg', docUrl2: 'sb:a:indienst', salaris: 'x' }];
  K.controleerMet(rijen, form, med, { 'sb:a:indienst': ['uren'] }, nu2);
  const soorten = r => (r.indienstControle || []).map(c => c.soort).sort();
  assert.deepStrictEqual(soorten(rijen[0]), ['bsn-dubbel', 'startdatum', 'vestiging']);          // uren: HR gaf akkoord; geboortedatum klopt
  assert.ok(rijen[0].indienstControle.find(c => c.soort === 'vestiging').reden.includes('Ceintuurbaan'));
  assert.deepStrictEqual(soorten(rijen[1]), ['jeugd', 'niet-in-shiftbase', 'wav-document']);
  assert.deepStrictEqual(soorten(rijen[2]), ['handmatig']);
  assert.strictEqual(rijen[3].indienstControle, undefined);                                        // al naar salaris: niets
  assert.deepStrictEqual(K.blokkeert(rijen[1]).map(c => c.soort), ['wav-document']); assert.strictEqual(K.blokkeert(rijen[2]).length, 0);
  console.log('indienst controle tests OK');
}

// v0.35.3: verblijfsdocument
{
  const nu3 = new Date(2026, 9, 30, 12), K = require('../netlify/functions/_lib/indienstcontrole.js');
  const nlr = I.valideer(goed, nu3); assert.strictEqual(nlr.schoon.verblijf, null);                         // NL: geen verblijfsdocument
  let v = I.valideer(Object.assign({}, goed, { nationaliteit: 'IN' }), nu3);
  assert.deepStrictEqual(Object.keys(v.fouten).sort(), ['verblijfArbeid', 'verblijfGeldig', 'verblijfType']);
  v = I.valideer(Object.assign({}, goed, { nationaliteit: 'IN', verblijfType: 'vergunning', verblijfArbeid: 'vrij', verblijfGeldig: '2026-01-01' }), nu3);
  assert.strictEqual(v.fouten.verblijfGeldig, 'verlopen');
  v = I.valideer(Object.assign({}, goed, { nationaliteit: 'UA', verblijfGeldig: '2028-03-04' }), nu3);
  assert.ok(v.ok, JSON.stringify(v.fouten)); assert.strictEqual(v.schoon.verblijf.type, 'oekraine');       // UA: type vanzelf, geen arbeid-vraag
  const sig = (verblijf, extra) => { const r = [{ rij: 1, naam: 'X Y', docUrl2: 'sb:z:indienst' }]; K.controleerMet(r, { 'sb:z:indienst': { naam: 'X Y', gegevens: Object.assign({ nationaliteit: 'IN', euer: false, datumIndienst: '01-11-2026', uren: '12', verblijf }, extra || {}) } }, [], {}, nu3); return r[0].indienstControle.filter(c => /^wav/.test(c.soort)).map(c => c.soort + ':' + c.ernst); };
  assert.deepStrictEqual(sig(null), ['wav-document:rood']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'vrij', geldigTot: '01-06-2028', document: true }), ['wav-echt:oranje']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'twv', geldigTot: '01-06-2028', document: true }), ['wav-twv:rood']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'niet', geldigTot: '01-06-2028', document: true }), ['wav-niet:rood']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'vrij', geldigTot: '15-12-2026', document: true }), ['wav-bijna:oranje', 'wav-echt:oranje']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'vrij', geldigTot: '31-10-2026', document: true }, { datumIndienst: '01-11-2026' }), ['wav-verlopen:rood', 'wav-echt:oranje']);
  assert.deepStrictEqual(sig({ type: 'oekraine', arbeid: 'onbekend', geldigTot: '04-03-2028', document: true }), ['wav-uwv:oranje']);
  assert.deepStrictEqual(sig({ type: 'vergunning', arbeid: 'twv', geldigTot: '01-06-2028', document: true, student: true }, { uren: '24' }), ['wav-twv:rood', 'wav-student:rood']);
  console.log('indienst verblijf tests OK');
}
