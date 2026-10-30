// ============================================================
// v0.35.1: POST /api/indienst-retour — indiensttredingsformulier terugsturen naar de medewerker
//   { actie:'retour', rij, reden, velden[] }   mail met reden + persoonlijke link naar het webformulier
//   { actie:'herinner', rij }                  dezelfde vraag nog eens sturen
//   { actie:'intrekken', rij }                 retour vervalt, formulier staat weer klaar voor salaris
// Zolang een retour actief is, gaat het dossier niet (automatisch) naar salaris.
// ============================================================
const { beveiligd, body } = require('./_lib/auth');
const S = require('./_lib/sheets');
const I = require('./_lib/indienst');

exports.handler = beveiligd('loonheffing-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event), rij = Number(p.rij);
  const r = (await S.getLoonheffing()).find(x => x.rij === rij); if (!r) throw new Error('Dossier niet gevonden (rij ' + p.rij + ').');
  if (p.actie === 'intrekken') return await I.trekRetourIn(r, g.email);
  if (p.actie === 'herinner') { if (!r.indienstRetour) throw new Error('Er staat geen retour open voor ' + r.naam + '.'); return await I.stuurRetour(r, { reden: r.indienstRetour.reden, velden: r.indienstRetour.velden, herinner: true }, g.email); }
  if (p.actie === 'retour') return await I.stuurRetour(r, p, g.email);
  throw new Error('Onbekende actie');
});
