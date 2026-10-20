// ============================================================
// POST /api/document-upload — HR uploadt zelf een document voor een dossier (ingelogd).
// Voor rijen waarvan het document nog in Google Drive staat (oud Google-formulier): HR downloadt het uit Drive
// en uploadt het hier; daarna gaat → Salaris gewoon en staat het in de eigen opslag (bucket hr-documenten).
//   { stap:'start', type:'loonheffing'|'ontslag'|'korting', rij, key, naam, mime, bytes } -> { pad, token, bucket }
//   { stap:'klaar', type, rij, bestanden:[{key,pad,naam_orig,bytes,mime}] }               -> { id, refs }
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
const S = require('./_lib/sheets');
const { zetVinkje } = require('./_lib/vinkje');

const SOORT = { loonheffing: 'loon', ontslag: 'ontslag', korting: 'korting' };

exports.handler = beveiligd('document-upload', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event), type = String(p.type || ''), rij = parseInt(p.rij, 10) || 0;
  if (!SOORT[type]) throw new Error('Onbekend type: ' + type);
  const lijst = type === 'loonheffing' ? await S.getLoonheffing() : type === 'ontslag' ? await S.getOntslag() : await S.getKorting();
  const row = lijst.find(r => r.rij === rij); if (!row) throw new Error('Dossier niet gevonden (rij ' + rij + ').');
  const tok = { s: SOORT[type], n: row.naam };
  if (p.stap === 'start') return await U.startUpload(tok, p.key, { naam: p.naam, mime: p.mime, bytes: p.bytes });
  if (p.stap !== 'klaar') throw new Error('Onbekende stap');
  // e-mail van het dossier meegeven: anders wint een oude Drive-link die op e-mail gekoppeld is
  const reg = await U.registreer(tok, p.bestanden, { email: String(row.email || '').trim().toLowerCase() || null, rij, handmatig: true });
  let vinkFout = '';
  try { await zetVinkje(tok, reg.refs); } catch (e) { vinkFout = e.message; }
  if (S.vergeetCache) try { S.vergeetCache(); } catch (e) { /* */ }
  await logActie({ door: g.email, actie: 'upload', bron: type, veld: Object.keys(reg.refs).join('+'), rij, naam: row.naam, nieuw: reg.id, details: 'Door HR geüpload: ' + reg.bestanden.map(b => b.label + ' (' + (b.naam_orig || '') + ', ' + Math.round(b.bytes / 1024) + ' kB)').join(', ') + (vinkFout ? ' | vinkje: ' + vinkFout : '') });
  return { id: reg.id, refs: reg.refs, bericht: reg.bestanden.length + ' document(en) van ' + row.naam + ' opgeslagen.' };
});
