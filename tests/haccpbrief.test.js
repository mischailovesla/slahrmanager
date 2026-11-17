// v0.53.0 algemene HACCP-brief: sjablonen vullen zonder losse {variabelen}, cijferblok aan/uit, lijsten als lijst in de mail
const assert = require('assert');
const HB = require('../netlify/functions/_lib/haccpbrief');
const E = require('../netlify/functions/_lib/eindtijd');
for (const taal of ['NL', 'EN']) {
  const sj = HB.SJABLONEN[taal];
  const v = { voornaam: 'Kenza', winkel: 'Den Haag', winkel_kort: ' Den Haag', ingangsdatum: '24 november 2026', afzender_naam: 'Mischa', afzender_functie: 'Operations Manager', gemist: 12, verplicht: 56, pct: 21, periode: '1 t/m 28 november 2026' };
  const zonder = E.vul(sj.tekst, v, { cijfers: false }), met = E.vul(sj.tekst, v, { cijfers: true });
  assert.deepStrictEqual(E.openVariabelen(zonder), [], taal + ': alles ingevuld');
  assert.deepStrictEqual(E.openVariabelen(E.vul(sj.onderwerp, v, {})), []);
  assert.ok(!/12/.test(zonder) && /12/.test(met), taal + ': cijferblok aan/uit');
  const html = E.naarHtml(met);
  assert.ok((html.match(/<ol/g) || []).length === 1 && (html.match(/<ul/g) || []).length === 1, taal + ': afspraken als genummerde lijst, redenen als opsomming');
}
console.log('✓ haccpbrief');
