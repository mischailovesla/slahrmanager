// GET /api/archief?type=loonheffing|ontslag|sommatie|onboarding  -> gearchiveerde rijen (tab 'Archief')
// POST /api/archief { type, rij }  -> terugzetten (herstelUitArchief in Code.gs v29.5)
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
exports.handler = beveiligd('archief', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    const naam = await S.herstelUitArchief(p.type, p.rij);
    await logActie({ door: g.email, actie: 'herstel', bron: p.type, veld: 'archief', rij: parseInt(p.rij, 10) || 0, naam, details: 'Teruggezet uit het archief' });
    return { bericht: naam + ' teruggezet.', naam };
  }
  const type = (event.queryStringParameters || {}).type || 'loonheffing';
  return Object.assign({ type }, await S.getArchief(type));
});
