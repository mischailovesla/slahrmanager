// v0.34.0: Shiftbase-templates per winkel — markers invullen, huisregels centraal, zip lezen/schrijven, Shiftbase-velden intact
const assert = require('assert');
const Z = require('../netlify/functions/_lib/zip');
const SB = require('../netlify/functions/_lib/shiftbasetemplates');
const CM = require('../netlify/functions/_lib/contractmaatwerk');

// zip: heen en terug
const z = Z.schrijf([{ naam: 'a.txt', data: 'hallo' }, { naam: 'map/b.xml', data: Buffer.from('<x>ü</x>') }]);
const terug = Z.lees(z);
assert.deepStrictEqual(terug.map(e => e.naam), ['a.txt', 'map/b.xml']);
assert.strictEqual(terug[1].data.toString('utf8'), '<x>ü</x>');

// winkels: geen holding, Utrecht krijgt plaats Utrecht
const ws = SB.winkels();
assert.ok(ws.length >= 12);
assert.ok(!ws.some(w => /holding/i.test(w.bv)));
const vs = ws.find(w => w.code === 'VS');
assert.deepStrictEqual([vs.adres, vs.postcodePlaats, vs.plaats], ['Voorstraat 52', '3512 AR Utrecht', 'Utrecht']);

// vul(): markers + huisregels gekloond, XML-escaping
const xml = '<w:body><w:p><w:r><w:t>[[BV]] · [[ADRES]] · [[POSTCODE_PLAATS]] · [[VERTEGENWOORDIGER]]</w:t></w:r></w:p><w:p><w:pPr/><w:r><w:t xml:space="preserve">• [[HUISREGEL]]</w:t></w:r></w:p><w:p><w:r><w:t>{first_name} te [[PLAATS]]</w:t></w:r></w:p></w:body>';
const uit = SB.vul(xml, Object.assign({}, vs, { bv: 'SLA R&D BV' }), { huisregels: ['Regel één', 'Regel <twee>'], vertegenwoordiger: 'Jodi Ko' });
assert.ok(uit.includes('SLA R&amp;D BV · Voorstraat 52 · 3512 AR Utrecht · Jodi Ko'));
assert.ok(uit.includes('• Regel één') && uit.includes('• Regel &lt;twee&gt;'));
assert.strictEqual((uit.match(/<w:p>/g) || []).length, 4);
assert.ok(uit.includes('{first_name} te Utrecht'));
assert.throws(() => SB.vul('<w:t>[[ONBEKEND]]</w:t>', vs, {}), /onbekende marker/);

// echte masters: alle soorten × een winkel, geen markers of Ceintuurbaan-resten, Shiftbase-velden blijven staan
for (const s of SB.SOORTEN) {
  const r = SB.maak(s.key, 'VS', { huisregels: CM.HUISREGELS, vertegenwoordiger: 'Jodi Ko' });
  const doc = Z.lees(r.data).find(e => e.naam === 'word/document.xml').data.toString('utf8');
  const tekst = (doc.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
  assert.ok(!/\[\[|Ceintuur|1072/.test(tekst), s.key + ': resten van de master');
  assert.ok(tekst.includes('SLA Utrecht BV') && tekst.includes('Voorstraat 52') && tekst.includes('getekend te Utrecht'), s.key + ': winkelgegevens');
  assert.ok(tekst.includes('{start_date}') && tekst.includes('{first_name}'), s.key + ': Shiftbase-velden');
  {   // v0.34.1: ook verlengingen hebben de huisregels als bijlage
    assert.ok(tekst.includes('SLAcademy') && !tekst.includes('Apprendo'), s.key + ': huisregels');
    assert.strictEqual((tekst.match(/• /g) || []).length, CM.HUISREGELS.length, s.key + ': aantal huisregels');
  }
  assert.ok(r.bestandsnaam.startsWith('Voorstraat - '));
  // v0.34.1: gelijkgetrokken teksten
  assert.ok(tekst.includes('rond de 14e van de volgende maand') && !/laatste dag van de periode|eind van de maand/.test(tekst), s.key + ': betaling');
  assert.ok(!tekst.includes('10.00') && tekst.includes('09.00'), s.key + ': werktijden');
  assert.strictEqual(tekst.includes('7:628 lid 5'), s.key === 'nieuw-slamaker', s.key + ': 7:628 lid 5');
  assert.strictEqual(/indien opgeroepen/.test(tekst), /slamaker/.test(s.key), s.key + ': indien opgeroepen');
  assert.ok(tekst.includes('functie van {job_title}') || tekst.includes('functie van  {job_title}'), s.key + ': {job_title}');
  assert.ok(tekst.includes(/slamaker/.test(s.key) ? 'A.3.I' : /junior/.test(s.key) ? 'A.4.I' : 'A.5.I'), s.key + ': functie-indeling');
  assert.ok(!/B\.\d\.I/.test(tekst), s.key + ': geen B-indeling meer');
}
assert.throws(() => SB.maak('nieuw-sm', 'HO', {}), /Onbekende winkel/);

// v0.34.3: werkgever altijd vertegenwoordigd door de eigenaar
assert.strictEqual(SB.STANDAARD.vertegenwoordiger, 'Jop van de Graaf');
{ const d = Z.lees(SB.maak('nieuw-sm', 'CB', { huisregels: ['x'], vertegenwoordiger: SB.STANDAARD.vertegenwoordiger }).data).find(e => e.naam === 'word/document.xml').data.toString('utf8');
  assert.ok(d.includes('Jop van de Graaf') && !/Jodi Ko(?! \()/.test(d.replace(/<[^>]+>/g, ''))); }

// bundel: per winkel een map
const b = Z.lees(SB.bundel(['nieuw-sm', 'verlenging-sm'], ['VS', 'CB'], { huisregels: CM.HUISREGELS }));
assert.strictEqual(b.length, 4);
assert.ok(b.some(e => e.naam === 'Ceintuurbaan/Ceintuurbaan - Store Manager (bepaalde tijd).docx'));

// contract op maat gebruikt de centrale huisregels als die worden meegegeven
const basis = { naam: 'Test Persoon', adres: 'Straat 1', postcodePlaats: '1000 AA Amsterdam', bv: 'SLA ASW BV', bvAdres: 'Amstelveenseweg 124, 1075 XL Amsterdam', functie: 'Store Manager', referentie: 'A.5.I', soort: 'bepaald', startdatum: '2026-11-01', maanden: 12, proeftijd: 1, opzegWn: 2, vorm: 'vast', uren: 38, loonsoort: 'maand', bedrag: '3.250,00' };
assert.ok(CM.bouw(Object.assign({}, basis, { _huisregels: ['Alleen deze regel.'] })).tekst.includes('- Alleen deze regel.'));
assert.ok(CM.bouw(basis).tekst.includes('SLAcademy-account'));
console.log('✓ shiftbasetemplates');
