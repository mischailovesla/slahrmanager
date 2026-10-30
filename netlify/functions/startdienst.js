// v0.36.0: GET /api/startdienst?vanaf=jjjj-mm-dd — instroom-KPI: dagen tussen indienstdatum en eerste geroosterde dienst (Shiftbase)
const { beveiligd } = require('./_lib/auth');
exports.handler = beveiligd('overzicht', async (event) => {
  const q = event.queryStringParameters || {};
  const vanaf = /^\d{4}-\d{2}-\d{2}$/.test(q.vanaf || '') ? q.vanaf : new Date(Date.now() - 60 * 864e5).toLocaleDateString('sv-SE');
  return await require('./_lib/startdienst').laad(vanaf);
});
