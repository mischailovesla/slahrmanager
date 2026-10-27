// v0.33.0: contract op maat — opbouw, fasering, NS Business Card, proeftijdregels en redigeren van BSN/IBAN
const assert = require('assert');
const CM = require('../netlify/functions/_lib/contractmaatwerk');
const basis = { naam: 'Test Persoon', adres: 'Straat 1', postcodePlaats: '1000 AA Amsterdam', bsn: '123456789', iban: 'NL00TEST0123456789',
  bv: 'SLA ASW BV', bvAdres: 'Amstelveenseweg 124, 1075 XL Amsterdam', functie: 'Store Manager', referentie: 'A.5.I', soort: 'bepaald', startdatum: '2026-11-01', maanden: 12, proeftijd: 1, opzegWn: 2,
  vorm: 'vast', uren: 38, loonsoort: 'maand', bedrag: '3.250,00' };
const m = (o) => CM.bouw(Object.assign({}, basis, o));

// standaard: 13 artikelen, einddatum automatisch, geen fouten
let b = m({});
assert.deepStrictEqual(b.fouten, []);
assert.ok(b.tekst.includes('eindigt derhalve van rechtswege op 31-10-2027'));
assert.ok(b.tekst.includes('**Artikel 13 Nadere bepalingen.**'));
assert.ok(b.tekst.includes('geen recht op reiskostenvergoeding'));
assert.ok(b.tekst.includes('€ 3.250,00 per maand'));
assert.ok(!/\{\{ART:/.test(b.tekst), 'alle artikelverwijzingen ingevuld');
assert.ok(b.tekst.includes('ten laste van het in artikel 7 bedoelde'));

// fasering: nulurencontract → 38 uur met maandsalaris
b = m({ fasering: { aan: true, fase1: { vorm: 'oproep', loon: 'uur', bedrag: '16,50', tot: '2026-11-30' }, fase2: { vorm: 'vast', uren: 38, loon: 'maand', bedrag: '3250' } } });
assert.deepStrictEqual(b.fouten, []);
assert.ok(b.tekst.includes('**Fase 2** (met ingang van 01-12-2026)'));
assert.ok(b.tekst.includes('nulurenovereenkomst'));
assert.ok(b.tekst.includes('€ 16,50 (exclusief vakantietoeslag)'));
// fase 2 moet aansluiten / oproep met maandsalaris is fout
assert.ok(m({ fasering: { aan: true, fase1: { vorm: 'oproep', loon: 'maand', bedrag: '2000', tot: '2026-11-30' }, fase2: { vorm: 'vast', uren: 38, loon: 'maand', bedrag: '3250', van: '2026-12-05' } } }).fouten.length >= 2);

// NS Business Card vervangt het reiskostenartikel en verwijst naar het eigendomsartikel
b = m({ ns: { aan: true, klasse: '1', prive: false } });
assert.ok(b.tekst.includes('NS Business Card (eerste klas)'));
assert.ok(b.tekst.includes('Privégebruik van de kaart is niet toegestaan'));
assert.ok(b.tekst.includes('(zie artikel 11)'));
assert.ok(!b.tekst.includes('geen recht op reiskostenvergoeding'));

// proeftijd: contract ≤ 6 maanden → fout; onbepaalde tijd zonder aanzegartikel
assert.ok(m({ maanden: 6 }).fouten.some(f => /proeftijd/.test(f)));
b = m({ soort: 'onbepaald', proeftijd: 2 });
assert.deepStrictEqual(b.fouten, []);
assert.ok(!b.tekst.includes('Aanzegging bij voorbaat'));

// aanvullende afspraken als eigen artikel, vóór Nadere bepalingen
b = m({ extra: 'Werknemer volgt de opleiding X.' });
assert.ok(/\*\*Artikel 13 Aanvullende afspraken\.\*\*[\s\S]*\*\*Artikel 14 Nadere bepalingen\.\*\*/.test(b.tekst));

// BSN en IBAN alleen in de PDF-tekst, niet in het logboek
const red = CM.redigeer(m({}).tekst);
assert.ok(!red.includes('123456789') && !red.includes('NL00TEST'));
console.log('contractmaatwerk tests OK');
