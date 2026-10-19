// ============================================================
// Fase 4a: GET /api/academy[?ververs=1] — training & certificaten uit SLA Academy (alleen lezen).
//   -> { stand, totaal, winkels (dekking per winkel), signalen, medewerkers (compact), ongekoppeld, drempels }
// ============================================================
const { beveiligd } = require('./_lib/auth');
const A = require('./_lib/academy');
const C = require('./_lib/config');

exports.handler = beveiligd('academy', async (event) => {
  const q = event.queryStringParameters || {};
  const r = await A.laad(q.ververs === '1');
  return { stand: r.stand, totaal: r.totaal, winkels: r.winkels, signalen: r.signalen, medewerkers: r.lijst.map(m => A.compact(m, r.vandaag)), ongekoppeld: r.ongekoppeld,
    drempels: { welkomDagen: C.ACADEMY_WELKOM_DAGEN, nooitIngelogdDagen: C.ACADEMY_NOOIT_INGELOGD_DAGEN, certWaarschuwDagen: C.ACADEMY_CERT_WAARSCHUW_DAGEN } };
});
