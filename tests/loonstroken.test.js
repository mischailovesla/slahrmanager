// v0.51.0 loonstroken: PDF-tekst lezen, per medewerker groeperen/knippen, koppelen aan Shiftbase.
// Geen echte loonstroken in de repo (persoonsgegevens): de test bouwt een nep-PDF in dezelfde opmaak als Exact Online.
const assert = require('assert');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const L = require('../netlify/functions/_lib/loonstroken');

// --- tokenizer: literal strings met escapes en octaal (Exact gebruikt (tekst) Tj met WinAnsi)
{
  const src = Buffer.from('BT 10 20 Td (Hallo \\(wereld\\)) Tj ET BT 30 40 Td (Caf\\351 \\200 5) Tj ET BT 1 0 0 1 50 60 Tm <48656C6C6F> Tj ET BT 5 5 Td [(Ge) -50 (splitst) -300 (woord)] TJ ET', 'latin1');
  const it = L.tekstItems(new Uint8Array(src));
  assert.deepStrictEqual(it.map(i => i.t), ['Hallo (wereld)', 'Café € 5', 'Hello', 'Gesplitst woord']);
  assert.deepStrictEqual([it[0].x, it[0].y, it[2].x, it[2].y], [10, 20, 50, 60]);
}

// --- naam op de strook ontleden
assert.deepStrictEqual(L.ontleedNaam('Mevrouw J. Loewy'), { initialen: 'J', achternaam: 'loewy' });
assert.deepStrictEqual(L.ontleedNaam('M.C.C. Coulouvrat-Cren'), { initialen: 'MCC', achternaam: 'coulouvrat cren' });
assert.deepStrictEqual(L.ontleedNaam('De heer D. Onody-Molnar'), { initialen: 'D', achternaam: 'onody molnar' });
assert.deepStrictEqual(L.ontleedNaam('Mevrouw N.J. van Commenee'), { initialen: 'NJ', achternaam: 'van commenee' });
assert.ok(L.achternaamPast('van commenee', 'Noor van Commenee'));
assert.ok(L.achternaamPast('commenee', 'Noor van Commenee'));
assert.ok(L.achternaamPast('coulouvrat cren', 'Marie Coulouvrat'), 'deel van dubbele achternaam');
assert.ok(!L.achternaamPast('de groot', 'Lisa de Vries'));

// --- koppelen
const MW = [
  { id: '1', naam: 'Julia Loewy', voornaam: 'Julia', email: 'j@x.nl', gebDatum: '2000-02-11' },
  { id: '2', naam: 'Lotte de Groot', voornaam: 'Lotte', email: 'l@x.nl', gebDatum: '2007-11-03' },
  { id: '3', naam: 'Lieke de Groot', voornaam: 'Lieke', email: 'l2@x.nl', gebDatum: '' },
  { id: '4', naam: 'Sam Getrouwd', voornaam: 'Sanne', email: 's@x.nl', gebDatum: '2003-11-28' },
  { id: '5', naam: 'Femke Kleyhorst', voornaam: 'Femke', email: 'f@x.nl', gebDatum: '' }
];
const strook = (naam, geb, nr) => ({ bv: 'SLA Midden B.V.', exactNr: nr || '1', naamStrook: naam, geboortedatum: geb });
assert.strictEqual(L.koppel(strook('Mevrouw J. Loewy', '11-02-2000'), MW, {}).zekerheid, 'zeker');
assert.strictEqual(L.koppel(strook('Mevrouw J. Loewy', '11-02-2000'), MW, {}).shiftbaseId, '1');
{ const k = L.koppel(strook('Mevrouw L.D. de Groot', '03-11-2007'), MW, {}); assert.strictEqual(k.shiftbaseId, '2'); assert.strictEqual(k.zekerheid, 'zeker'); }
{ const k = L.koppel(strook('Mevrouw S. White', '28-11-2003'), MW, {}); assert.strictEqual(k.shiftbaseId, '4'); assert.strictEqual(k.zekerheid, 'voorstel', 'andere achternaam (getrouwd): alleen voorstel'); }
{ const k = L.koppel(strook('Mevrouw F.S. Kleyhorst', '24-06-2003'), MW, {}); assert.strictEqual(k.shiftbaseId, '5'); assert.strictEqual(k.zekerheid, 'voorstel', 'geen geboortedatum in Shiftbase: voorstel op naam'); }
{ const k = L.koppel(strook('Mevrouw L. de Groot', '01-01-1990'), MW, {}); assert.strictEqual(k.shiftbaseId, '', 'twee de Groots met L, geen geboortedatum-match'); assert.ok(/2 medewerkers/.test(k.reden)); }
{ const k = L.koppel(strook('Mevrouw X. Onbekend', '01-01-1990'), MW, {}); assert.strictEqual(k.zekerheid, ''); }
{ const k = L.koppel(strook('Mevrouw X. Onbekend', '01-01-1990', '777'), MW, { 'SLA Midden B.V.|777': { shiftbase_id: '3', naam: 'Lieke de Groot' } }); assert.strictEqual(k.zekerheid, 'vast'); assert.strictEqual(k.shiftbaseId, '3'); }

// --- nep-PDF in Exact-opmaak: 3 medewerkers, de tweede met 2 documenten (nabetaling + correctie), plus een vervolgpagina
async function nepPdf() {
  const doc = await PDFDocument.create(); doc.setCreator('Exact Online');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const pagina = (titel, nr, per, naam, geb, pag) => {
    const p = doc.addPage([595, 842]); const t = (s, x, y) => p.drawText(s, { x, y, size: 8, font: f });
    if (titel) {
      t(titel, 425, 818.06); t('Medewerker', 425, 800.78); t(nr, 554.15, 800.78); t('Jaar - periode', 425, 789.44); t(per, 551.48, 789.44);
      t('Begindatum', 425, 778.1); t('Einddatum', 425, 766.76);
      t('SLA Midden B.V.', 14.17, 703.62); t('Middenweg 55 B H', 14.17, 686.61); t(naam, 297.5, 703.62); t('Straat 1', 297.5, 686.61);
      t('Medewerkergegevens', 17, 602.33); t('Medewerker', 17, 590.99); t(nr, 173.53, 590.99); t('Geboortedatum', 17, 579.65); t(geb, 159.31, 579.65);
      t('Afdeling', 205, 579.65); t("SLA Middenweg A'dam", 300, 579.65);
    } else t('Vervolg van de specificatie', 17, 700);
    t('Exact Online', 14.17, 3.11); t('M2026.10.3', 549.15, 3.11); t(pag, 279.82, 3.11);
  };
  pagina('Salarisspecificatie', '105181', '2026-10', 'Mevrouw J. Loewy', '11-02-2000', 'Pagina 1 van 1');
  pagina('Nabetalingsspecificatie', '105214', '2026-10', 'Mevrouw M.K. Busse', '25-04-2004', 'Pagina 1 van 1');
  pagina('Aanvullende salarisspecificatie', '105214', '2026-8', 'Mevrouw M.K. Busse', '', 'Pagina 1 van 1');
  pagina('Salarisspecificatie', '105229', '2026-10', 'E. Hendrikse', '26-07-2005', 'Pagina 1 van 2');
  pagina(null, '', '', '', '', 'Pagina 2 van 2');
  return doc.save();
}

(async () => {
  const bytes = await nepPdf();
  const r = await L.lees(bytes);
  assert.strictEqual(r.paginas, 5);
  assert.deepStrictEqual(r.waarschuwingen, []);
  assert.strictEqual(r.stroken.length, 3);
  const [a, b, c] = r.stroken;
  assert.deepStrictEqual([a.exactNr, a.periode, a.run, a.bv, a.naamStrook, a.geboortedatum, a.afdeling], ['105181', '2026-10', 'M2026.10.3', 'SLA Midden B.V.', 'Mevrouw J. Loewy', '11-02-2000', "SLA Middenweg A'dam"]);
  assert.deepStrictEqual(b.paginaIdx, [1, 2]);
  assert.deepStrictEqual(b.documenten, ['Nabetalingsspecificatie', 'Aanvullende salarisspecificatie 2026-08']);
  assert.strictEqual(b.geboortedatum, '25-04-2004');
  assert.deepStrictEqual(c.paginaIdx, [3, 4], 'vervolgpagina hoort bij de vorige medewerker');
  // knippen: losse PDF met precies de juiste pagina's, en opnieuw leesbaar
  const los = await L.knip(r.doc, b.paginaIdx, 'test');
  const r2 = await L.lees(los);
  assert.strictEqual(r2.paginas, 2); assert.strictEqual(r2.stroken.length, 1); assert.strictEqual(r2.stroken[0].exactNr, '105214');
  // bundelen
  const bundel = await L.bundel([await L.knip(r.doc, a.paginaIdx), los]);
  assert.strictEqual((await PDFDocument.load(bundel)).getPageCount(), 3);
  // opslagpad en bestandsnaam
  assert.strictEqual(L.opslagPad(a), 'stroken/2026-10/SLA_Midden_B.V./M2026.10.3_105181_mevrouw_j_loewy.pdf');
  assert.strictEqual(L.bestandsnaam('Julia Loewy', '2026-10'), 'Salarisspecificatie_Julia_Loewy_2026-10.pdf');
  // geen Exact-PDF: geen stroken, wel waarschuwing
  const leeg = await PDFDocument.create(); leeg.addPage();
  const r3 = await L.lees(await leeg.save());
  assert.strictEqual(r3.stroken.length, 0); assert.strictEqual(r3.waarschuwingen.length, 1);
  // mailtekst
  const m = require('../netlify/functions/loonstroken')._mailInhoud('Thea', ['2026-04', '2026-05', '2026-06'], 'en');
  assert.strictEqual(m.subject, 'Your payslips – April 2026, May 2026 and June 2026');
  assert.ok(/DUO/.test(m.text));
  // import-endpoint: sleutel
  const I = require('../netlify/functions/loonstroken-import');
  delete process.env.LOONSTROKEN_IMPORT_SECRET; assert.strictEqual(I._sleutelKlopt('x'), null, 'zonder env staat de import uit');
  process.env.LOONSTROKEN_IMPORT_SECRET = 'kort'; assert.strictEqual(I._sleutelKlopt('kort'), null, 'te korte sleutel = uit');
  process.env.LOONSTROKEN_IMPORT_SECRET = 'a'.repeat(40);
  assert.strictEqual(I._sleutelKlopt('a'.repeat(40)), true); assert.strictEqual(I._sleutelKlopt('b'.repeat(40)), false); assert.strictEqual(I._sleutelKlopt(''), false);
  const r401 = await I.handler({ httpMethod: 'POST', headers: { 'x-import-sleutel': 'fout' }, body: '{}' }); assert.strictEqual(r401.statusCode, 401);
  delete process.env.LOONSTROKEN_IMPORT_SECRET;
  console.log('✓ loonstroken');
})().catch(e => { console.error('✗ loonstroken:', e.message); process.exitCode = 1; });
