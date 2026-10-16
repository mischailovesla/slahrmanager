// GET /api/beschikbaarheid-onderbouwing?id=<shiftbase user id>  (port van getWeekendOnderbouwing, read-only)
// Geeft een brief-klare onderbouwing over de laatste BSK_ONDERBOUWING_WEKEN weekenden.
const { beveiligd } = require('./_lib/auth');
const W = require('./_lib/weekend');
exports.handler = beveiligd('beschikbaarheid-onderbouwing', async (event) => {
  const id = (event.queryStringParameters || {}).id;
  return W.getWeekendOnderbouwing(id);
});
