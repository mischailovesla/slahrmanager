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
// SLA Holding BV: 40 uur fulltime en pensioen via a.s.r.
b = m({ bv: 'SLA Holding BV', uren: 40 });
assert.ok(b.tekst.includes('fulltime werkweek bij werkgever bedraagt 40 uur'));
assert.ok(b.tekst.includes('op basis van een 40 urige werkweek'));
assert.ok(b.tekst.includes('ondergebracht bij a.s.r.') && !b.tekst.includes('Pensioenfonds Horeca'));
assert.ok(!b.let_op.some(x => /fulltime/.test(x)));
assert.ok(!/CAO/.test(b.tekst), 'holding: geen cao-verwijzingen');
assert.ok(b.tekst.includes('geen collectieve arbeidsovereenkomst (cao) van toepassing'));
assert.ok(b.tekst.includes('tijd voor tijd') && !b.tekst.includes('Referentiefuncties'));
assert.ok(b.tekst.includes('104 weken 70%') && b.tekst.includes('twee (2) wachtdagen') && !b.tekst.includes('95%'));
b = m({});
assert.ok(b.tekst.includes('38 urige werkweek') && b.tekst.includes('Pensioenfonds Horeca & Catering') && b.tekst.includes('CAO Horeca van toepassing') && b.tekst.includes('95%') && b.tekst.includes('één (1) wachtdag'));
// deeltijd: fulltime maandsalaris wordt naar rato omgerekend en genoemd
b = m({ uren: 24, bedrag: '3800' });
assert.ok(b.tekst.includes('gemiddeld 24 uur per week'));
assert.ok(b.tekst.includes('op basis van een 38 urige werkweek') && b.tekst.includes('zijnde € 2.400,00 bruto per maand'));
assert.ok(b.samenvatting.includes('€ 2.400,00/mnd (fulltime € 3.800,00)'));
b = m({ bv: 'SLA Holding BV', uren: 32, bedrag: '4000' });
assert.ok(b.tekst.includes('40 urige werkweek') && b.tekst.includes('zijnde € 3.200,00 bruto per maand'));
b = m({ uren: 38 });
assert.ok(!b.tekst.includes('naar rato'));
console.log('contractmaatwerk tests OK');

// v0.35.0: opnieuw gebruiken — logboektekst (zonder BSN/IBAN) terug naar formulier; opnieuw opbouwen geeft exact dezelfde tekst
const hr = ['Regel een', 'Regel twee'];
const rondje = (o) => {
  const p = Object.assign({}, basis, { geboortedatum: '01-02-1999', geboorteplaats: 'Utrecht', vertegenwoordiger: 'Jop van de Graaf', _huisregels: hr }, o);
  const b1 = CM.bouw(p); assert.deepStrictEqual(b1.fouten, [], JSON.stringify(b1.fouten));
  const terug = CM.terugLezen(CM.redigeer(b1.tekst));
  assert.strictEqual(terug.iban, ''); assert.strictEqual(terug.bsn, '');
  const b2 = CM.bouw(Object.assign(terug, { bsn: p.bsn, iban: 'NL99NEUW0000000001', _huisregels: hr }));
  assert.strictEqual(b2.tekst, b1.tekst.replace('NL00TEST0123456789', 'NL99NEUW0000000001'));
  assert.strictEqual(b2.samenvatting, b1.samenvatting);
  return terug;
};
let tr = rondje({});
assert.strictEqual(tr.naam, 'Test Persoon'); assert.strictEqual(tr.startdatum, '2026-11-01'); assert.strictEqual(tr.maanden, '12'); assert.strictEqual(tr.opzegWn, '2');
rondje({ uren: 32, bedrag: '3.250,00' });                                   // deeltijd met maandsalaris naar rato
rondje({ vorm: 'oproep', loonsoort: 'uur', bedrag: '16,50', proeftijd: 0, maanden: 6, opzegWn: 1 });
rondje({ soort: 'onbepaald', maanden: '', proeftijd: 2, opzegWn: 3 });
rondje({ bv: 'SLA Holding BV', referentie: '', uren: 40, bedrag: '4000' });
rondje({ maanden: '', einddatum: '2027-03-15', proeftijd: 0 });
tr = rondje({ fasering: { aan: true, fase1: { vorm: 'oproep', loon: 'uur', bedrag: '16,50', tot: '2026-11-30' }, fase2: { vorm: 'vast', uren: 36, loon: 'maand', bedrag: '3250' } },
  ns: { aan: true, klasse: '1', prive: true, ingang: '2026-12-01' }, extra: 'Werknemer volgt een opleiding.\n\nDe kosten zijn voor werkgever.' });
assert.strictEqual(tr.fasering.fase1.tot, '2026-11-30'); assert.strictEqual(tr.ns.klasse, '1'); assert.ok(tr.extra.includes('kosten zijn voor werkgever'));
assert.throws(() => CM.terugLezen('Beste Lisa, dit is geen contract.'));
