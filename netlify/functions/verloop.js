// GET /api/verloop?maanden=12[&ververs=1]  (getVerloopData, Verloop.gs v1.3)
const { beveiligd } = require('./_lib/auth');
const VR = require('./_lib/verloop');
exports.handler = beveiligd('verloop', async (event) => { const q = event.queryStringParameters || {}; return VR.getVerloopData(q.maanden, q.ververs === '1'); });
