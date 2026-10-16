// GET /api/vakantie?jaar=2026  (getVakantiePlannerData) — heatmap winkel × week; ?stil=1 geeft alleen de stille-afwezigenlijst
const { beveiligd } = require('./_lib/auth');
const VK = require('./_lib/vakantie');
const SB = require('./_lib/shiftbase');
exports.handler = beveiligd('vakantie', async (event) => {
  const q = event.queryStringParameters || {};
  if (q.stil === '1') return VK.getStilleAfwezigen(await SB.getMedewerkers(false));
  return VK.getVakantiePlannerData(q.jaar);
});
