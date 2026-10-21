// ============================================================
// POST /api/salaris-mail  (port van stuurDocsNaarSalaris v29.3 + stuurKortingNaarSalaris)
// { type:'loonheffing'|'ontslag'|'korting', rij }
//  - haalt de geüploade formulieren uit Supabase Storage (eigen uploadpagina, _lib/uploads.js)
//    en mailt ze als bijlage naar SALARIS_EMAIL (Mahdia / HRM Online) in SLA-huisstijl
//  - logt de tijdstempel: loonheffing K, ontslag O, korting M (groen)
//  - oude Google-Forms-uploads (Drive-links) kunnen niet automatisch mee: antwoord { success:false, upload:{...} } → het dashboard
//    laat HR het document uit Drive downloaden en hier uploaden (/api/document-upload) en stuurt daarna opnieuw. zonderDrive:1 = toch versturen zonder.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const U = require('./_lib/uploads');

exports.handler = beveiligd('salaris-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const type = String(p.type || ''), rij = parseInt(p.rij, 10) || 0;
  if (['loonheffing', 'ontslag', 'korting', 'overplaatsing'].indexOf(type) === -1) throw new Error('Onbekend type: ' + type);
  if (!rij) throw new Error('Rijnummer ontbreekt.');
  const lijst = await require('./_lib/salaris').lijstVan(type);
  const row = lijst.find(r => r.rij === rij);
  if (!row) throw new Error('Medewerker niet gevonden (rij ' + rij + ').');

  return require('./_lib/salaris').stuur(type, row, g.email, p);
});
