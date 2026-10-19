// ============================================================
// Fase 3b: gesprekken (ingelogd, elke HR-rol).
//   GET  /api/gesprek?mid=..&naam=..        -> { gesprekken (van één medewerker), soorten, kanalen }
//   GET  /api/gesprek?dagen=90              -> { gesprekken (alle, laatste N dagen), open (openstaande vervolgen), soorten, kanalen }
//   POST { actie:'opslaan', gesprek:{...}, checkinId?, vervolgVan? }   -> nieuw of bewerken (id in gesprek)
//   POST { actie:'vervolg-af', id, notitie }                           -> vervolg afvinken zonder nieuw gesprek
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const G = require('./_lib/gesprekken');
const C = require('./_lib/config');

exports.handler = beveiligd('gesprek', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'vervolg-af') {
      const r = await G.vervolgAf(p.id, p.notitie, g.email);
      await logActie({ door: g.email, actie: 'gesprek-vervolg-af', bron: 'gesprek', naam: r.naam || null, veld: r.soort || '', details: String(p.notitie || '') });
      return { bericht: 'Vervolg afgevinkt' + (r.naam ? ': ' + r.naam : '') + '.' };
    }
    if (p.actie !== 'opslaan') throw new Error('Onbekende actie');
    const ges = p.gesprek || {}, nieuw = !ges.id;
    const r = await G.opslaan(ges, g.email, { checkinId: nieuw ? p.checkinId : null, vervolgVan: nieuw ? p.vervolgVan : null });
    await logActie({ door: g.email, actie: nieuw ? 'gesprek' : 'gesprek-bewerkt', bron: 'gesprek', naam: r.rij.naam, veld: r.rij.soort, nieuw: r.id, details: G.label(r.rij.soort) + ' ' + r.rij.datum + (r.rij.vervolg_datum ? ' · vervolg ' + r.rij.vervolg_datum : '') + (p.checkinId ? ' · check-in opgevolgd' : '') + (p.vervolgVan ? ' · vervolg van ' + p.vervolgVan : '') });
    return { id: r.id, bericht: (nieuw ? 'Gesprek vastgelegd' : 'Gesprek bijgewerkt') + ' voor ' + r.rij.naam + (r.rij.vervolg_datum ? ' · vervolg op ' + r.rij.vervolg_datum.split('-').reverse().join('-') : '') + (p.checkinId && nieuw ? ' · check-in opgevolgd' : '') + '.' };
  }
  const q = event.queryStringParameters || {};
  const meta = { soorten: C.GESPREK_SOORTEN, kanalen: C.GESPREK_KANALEN };
  if (q.mid || q.naam) return Object.assign({ gesprekken: await G.voorPersoon(q) }, meta);
  return Object.assign({ gesprekken: await G.lijst(q), open: await G.openVervolgen() }, meta);
});
