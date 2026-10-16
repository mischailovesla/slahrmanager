// GET /api/vastloners?jaar=2026&maand=9  (getVastlonerMaand, Vastloners.gs v30.0) — maandmutaties salaris voor de store managers
const { beveiligd } = require('./_lib/auth');
const V = require('./_lib/vastloners');
exports.handler = beveiligd('vastloners', async (event) => { const q = event.queryStringParameters || {}; return V.getVastlonerMaand(q.jaar, q.maand); });
