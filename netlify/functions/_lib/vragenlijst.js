// ============================================================
// Gedeelde logica voor vragenlijsten die HR zelf beheert (exit-survey, check-in 30/60).
// Vorm van een vraag: { key, type: keuze|schaal|nps|tekst, nl, en, opties?: [[key, nl, en, alarm?], ...],
//   toelichting?: true  (optioneel tekstveld onder de vraag; antwoord onder key + '__toelichting'),
//   alleenEigenOntslag?: true (exit-survey: alleen tonen als de medewerker zelf ontslag nam — niet na een aanzegging/niet verlengen) }
// - normaliseer(lijst): controleert en normaliseert wat de editor in het dashboard opstuurt
// - vertaal(lijst, taal): vragen zoals de publieke pagina ze toont
// - valideer(antwoorden, lijst): controleert ingevulde antwoorden → { uit, nps, opmerking, schalen, alarmen }
// ============================================================
const TYPES = ['keuze', 'schaal', 'nps', 'tekst'];
const slug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function normaliseer(lijst) {
  if (!Array.isArray(lijst) || !lijst.length) throw new Error('Minimaal één vraag.');
  if (lijst.length > 20) throw new Error('Maximaal 20 vragen.');
  const keys = new Set(), uit = [];
  lijst.forEach((v, i) => {
    const nl = String(v.nl || '').trim(), en = String(v.en || '').trim() || nl;
    if (!nl) throw new Error('Vraag ' + (i + 1) + ': Nederlandse tekst ontbreekt.');
    const type = TYPES.includes(v.type) ? v.type : 'schaal';
    let key = slug(v.key);
    if (!key) key = slug(nl).slice(0, 24) || 'vraag' + (i + 1);
    if (keys.has(key)) throw new Error('Vraag ' + (i + 1) + ': sleutel "' + key + '" komt dubbel voor.');
    keys.add(key);
    const q = { key, type, nl, en };
    if (type !== 'tekst' && (v.toelichting === true || v.toelichting === 'true')) q.toelichting = true;
    if (v.alleenEigenOntslag === true || v.alleenEigenOntslag === 'true') q.alleenEigenOntslag = true;
    if (type === 'keuze') {
      const opties = (v.opties || [])
        .map(o => Array.isArray(o) ? o : [o.key, o.nl, o.en, o.alarm])
        .map(o => { const r = [slug(o[0]), String(o[1] || '').trim(), String(o[2] || '').trim() || String(o[1] || '').trim()]; if (o[3] === true || o[3] === 'true' || o[3] === '!') r.push(true); return r; })
        .filter(o => o[1]);
      opties.forEach(o => { if (!o[0]) o[0] = slug(o[1]).slice(0, 24); });
      if (opties.length < 2) throw new Error('Vraag ' + (i + 1) + ' (keuze): minimaal twee opties.');
      if (new Set(opties.map(o => o[0])).size !== opties.length) throw new Error('Vraag ' + (i + 1) + ': optiesleutels komen dubbel voor.');
      q.opties = opties;
    }
    uit.push(q);
  });
  return uit;
}
// ctx.eigenOntslag: true = zelf opgezegd, false = aanzegging/werkgever (vragen met alleenEigenOntslag vallen weg), null = onbekend (de pagina beslist op basis van de vertrekreden)
const zichtbaar = (lijst, ctx) => (lijst || []).filter(v => !(v.alleenEigenOntslag && ctx && ctx.eigenOntslag === false));
function vertaal(lijst, taal, ctx) {
  const en = String(taal || '').toUpperCase() === 'EN';
  return zichtbaar(lijst, ctx).map(v => ({ key: v.key, type: v.type, vraag: en ? v.en : v.nl, opties: v.opties ? v.opties.map(o => ({ key: o[0], label: en ? o[2] : o[1] })) : undefined, toelichting: v.toelichting || undefined, alleenEigenOntslag: v.alleenEigenOntslag || undefined }));
}
function valideer(antwoorden, lijst, ctx) {
  const uit = {}, schalen = [], alarmen = []; let nps = null, opmerking = '', toel = '';
  for (const v of zichtbaar(lijst, ctx)) {
    if (v.toelichting && antwoorden && antwoorden[v.key + '__toelichting']) { const t = String(antwoorden[v.key + '__toelichting']).trim().slice(0, 1000); if (t) { uit[v.key + '__toelichting'] = t; if (!toel) toel = t; } }
    const a = antwoorden ? antwoorden[v.key] : undefined;
    if (a === undefined || a === null || a === '') continue;
    if (v.type === 'schaal') { const n = +a; if (!(n >= 1 && n <= 5)) throw new Error('Ongeldig antwoord bij ' + v.key); uit[v.key] = n; schalen.push({ key: v.key, vraag: v.nl, n }); }
    else if (v.type === 'nps') { const n = +a; if (!(n >= 0 && n <= 10)) throw new Error('Ongeldig antwoord bij ' + v.key); uit[v.key] = n; if (nps === null) nps = n; }
    else if (v.type === 'keuze') { const o = v.opties.find(x => x[0] === a); if (!o) throw new Error('Ongeldig antwoord bij ' + v.key); uit[v.key] = String(a); if (o[3] === true) alarmen.push({ key: v.key, vraag: v.nl, label: o[1] }); }
    else { const t = String(a).trim().slice(0, 2000); uit[v.key] = t; if (!opmerking) opmerking = t; }
  }
  if (!Object.keys(uit).length) throw new Error('Vul minimaal één vraag in.');
  return { uit, nps, opmerking: opmerking || toel, schalen, alarmen };
}
// Labels per antwoord (voor tabellen en exports): { vraagKey: optielabel }
function labels(lijst, antwoorden) {
  const uit = {};
  for (const v of lijst || []) if (v.opties && antwoorden && antwoorden[v.key] != null) { const o = v.opties.find(x => x[0] === antwoorden[v.key]); if (o) uit[v.key] = o[1]; }
  return uit;
}
module.exports = { TYPES, normaliseer, vertaal, valideer, labels, zichtbaar };
