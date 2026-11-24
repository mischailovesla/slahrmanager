// v0.55.0 werkgeversverklaring: tekst NL/EN, tijdelijk/vast, nog niet in dienst, nulurencontract, controles en salaris-redactie voor het logboek
const assert = require('assert');
const WV = require('../netlify/functions/_lib/werkgeversverklaring');
const nu = new Date(2026, 10, 24);   // 24-11-2026
const basis = { naam: 'Eva Mazzon', functie: 'Store Manager', bv: 'SLA ASW BV', bvAdres: 'Amstelveenseweg 124, 1075 XL Amsterdam', startdatum: '2026-11-30', einddatum: '2027-06-30', soort: 'bepaald', vorm: 'vast', uren: '38', loonsoort: 'maand', bedrag: '3.250,00', toeslag: '8', afzenderNaam: 'Mischa Kamstra', afzenderFunctie: 'Operations Manager', taal: 'EN' };

// Engels, tijdelijk, nog niet in dienst
let b = WV.bouw(basis, nu);
assert.deepStrictEqual(b.fouten, []);
assert.ok(/will start employment with us/.test(b.tekst) && /Employment starts:\*\* November 30, 2026/.test(b.tekst), 'toekomstige start');
assert.ok(/Fixed-term employment agreement, ending automatically on June 30, 2027/.test(b.tekst), 'einddatum staat erin');
assert.ok(/38 hours per week/.test(b.tekst) && /€ 3\.250,00 \(excluding 8% holiday allowance\)/.test(b.tekst), 'uren en salaris');
assert.ok(b.tekst.includes('{{HANDTEKENING}}') && /\*\*Mischa Kamstra\*\*\nOperations Manager\nSLA ASW BV/.test(b.tekst), 'ondertekenblok');
assert.ok(b.let_op.some(x => /nog niet in dienst/.test(x)) && b.let_op.some(x => /Tijdelijk contract/.test(x)), 'let-op: nog niet in dienst + tijdelijk');

// Nederlands, al in dienst, onbepaalde tijd
b = WV.bouw(Object.assign({}, basis, { taal: 'NL', startdatum: '2025-03-01', einddatum: '', soort: 'onbepaald', proeftijd: '' }), nu);
assert.deepStrictEqual(b.fouten, []);
assert.ok(/in dienst is/.test(b.tekst) && /In dienst sinds:\*\* 1 maart 2025/.test(b.tekst) && /onbepaalde tijd/.test(b.tekst) && /38 uur per week/.test(b.tekst), 'NL tekst');
assert.ok(!b.let_op.some(x => /nog niet in dienst|Tijdelijk/.test(x)), 'geen let-op bij vast en in dienst');

// Doel en proeftijd
b = WV.bouw(Object.assign({}, basis, { doel: 'for a rental application', proeftijd: '1' }), nu);
assert.ok(/at the request of the employee for a rental application/.test(b.tekst) && /probationary period of 1 month\b/.test(b.tekst));

// Controles
b = WV.bouw({ taal: 'NL' }, nu);
assert.ok(b.fouten.length >= 5, 'lege invoer geeft fouten');
b = WV.bouw(Object.assign({}, basis, { einddatum: '' }), nu);
assert.ok(b.fouten.some(x => /einddatum/.test(x)), 'bepaalde tijd zonder einddatum');
b = WV.bouw(Object.assign({}, basis, { vorm: 'oproep', loonsoort: 'maand', uren: '' }), nu);
assert.ok(b.fouten.some(x => /uurloon/.test(x)), 'nulurencontract met maandsalaris');
b = WV.bouw(Object.assign({}, basis, { vorm: 'oproep', loonsoort: 'uur', bedrag: '14,50', uren: '' }), nu);
assert.deepStrictEqual(b.fouten, []);
assert.ok(/On-call basis/.test(b.tekst) && /Gross hourly wage:\*\* € 14,50/.test(b.tekst) && b.let_op.some(x => /Nulurencontract/.test(x)));
assert.strictEqual(WV.isOproepType('Nul uren'), true);
assert.strictEqual(WV.isOproepType('Vaste uren'), false);

// Salaris-redactie voor het logboek
b = WV.bouw(basis, nu);
const gelogd = WV.redigeer(b.tekst);
assert.ok(!/3\.250/.test(gelogd) && /Gross monthly salary:\*\* € •••/.test(gelogd), 'salaris niet in het logboek');
assert.ok(/Store Manager/.test(gelogd), 'rest blijft staan');
const nl = WV.redigeer(WV.bouw(Object.assign({}, basis, { taal: 'NL' }), nu).tekst);
assert.ok(!/3\.250/.test(nl) && /Bruto maandsalaris:\*\* € •••/.test(nl));

// De PDF-bouw werkt met de tekst (pdf-lib)
(async () => {
  const P = require('../netlify/functions/_lib/pdf');
  const pdf = await P.maakOpgemaakteBrief(WV.bouw(basis, nu).tekst.replace('{{HANDTEKENING}}', '\n\n\n'), { titel: 'Test' });
  assert.ok(pdf.length > 1000 && pdf.slice(0, 4).toString() === '%PDF', 'PDF gemaakt');
  console.log('✓ werkgeversverklaring');
})().catch(e => { console.error('✗ werkgeversverklaring (pdf): ' + e.message); process.exitCode = 1; });
