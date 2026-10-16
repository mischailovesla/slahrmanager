// POST /api/notitie { naam, email, tekst }  (voegNotitieToe, Dossier.gs) — interne dossiernotitie met auteur + datum, tab 'Notities'
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const D = require('./_lib/datum');
exports.handler = beveiligd('notitie', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim(), tekst = String(p.tekst || '').trim();
  if (!naam) throw new Error('Naam ontbreekt.');
  if (tekst.length < 3) throw new Error('Notitie is leeg.');
  const nu = D.stempel();
  const rij = await S.voegNotitieToe(naam, String(p.email || '').trim(), g.email, tekst, nu);
  await logActie({ door: g.email, actie: 'notitie', bron: 'dossier', veld: 'notitie', rij, naam, nieuw: tekst.slice(0, 200), details: 'Dossiernotitie toegevoegd' });
  return { bericht: 'Notitie opgeslagen.', rij, notitie: { rij, naam, email: p.email || '', datum: nu, auteur: g.email, tekst } };
});
