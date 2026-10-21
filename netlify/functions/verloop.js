// GET /api/verloop?maanden=12[&ververs=1]  (getVerloopData, Verloop.gs v1.3)
// GET /api/verloop?maanden=12&controle=1   -> controle van de uitstroom (nieuw account, winkelwissel, <= 14 dagen, zonder dossier)
const { beveiligd } = require('./_lib/auth');
const VR = require('./_lib/verloop');
exports.handler = beveiligd('verloop', async (event) => {
  const q = event.queryStringParameters || {};
  const r = await VR.getVerloopData(q.maanden, q.ververs === '1');
  if (!q.controle) return r;
  const med = await VR.laadMedewerkers(false);
  let ontslag = []; try { ontslag = await require('./_lib/sheets').getOntslag(true); } catch (e) { /* dossiers niet beschikbaar */ }
  const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return VR.controleUitstroom(med, r, ontslag, nu);
});
