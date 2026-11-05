// v0.46.0 Fooiverdeling — GET /api/fooi?jaar=2026&maand=10[&ververs=1]
// POST /api/fooi { actie: 'bereken' | 'opslaan' | 'definitief' | 'heropen' | 'plak', jaar, maand, potten, handmatig, tekst }
const { beveiligd, body } = require('./_lib/auth');
const F = require('./_lib/fooi');
exports.handler = beveiligd('fooi', async (event, gebruiker) => {
  if (event.httpMethod !== 'POST') { const q = event.queryStringParameters || {}; return F.getFooi(q.jaar, q.maand, q.ververs === '1'); }
  const p = body(event);
  if (p.actie === 'plak') return F.leesPlaktekst(p.tekst);
  if (p.actie === 'bereken') { const r = await F.maakOverzicht(p.jaar, p.maand, F.schoonPotten(p.potten), F.schoonHandmatig(p.handmatig), !!p.ververs); r.opslag = p.opslag || null; return r; }
  if (p.actie === 'opslaan' || p.actie === 'definitief') return F.opslaan(p.jaar, p.maand, p.potten, p.handmatig, p.actie === 'definitief', gebruiker);
  if (p.actie === 'heropen') return F.heropen(p.jaar, p.maand, gebruiker);
  throw new Error('Onbekende actie.');
});
