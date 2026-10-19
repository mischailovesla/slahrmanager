// GET /api/oproepaanbod — fase 2d: verstuurde aanbiedingen (nieuwste bovenaan) + kandidaten uit de laatste
// oproepaanbod-check (hr_signaleringen) + winkels voor het formulier. ?live=1 draait de check nu (droog; Shiftbase-roosters 12 mnd).
const { beveiligd, admin } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const winkels = Object.keys(C.WINKEL_BV_MAP).map(code => Object.assign({ code }, C.WINKEL_BV_MAP[code])).sort((a, b) => a.naam.localeCompare(b.naam));
exports.handler = beveiligd('oproepaanbod', async (event) => {
  const qs = event.queryStringParameters || {};
  let kandidaten = [], stand = '';
  if (qs.live === '1') {
    const rap = await require('./_lib/signaleringen').CHECKS['oproepaanbod'](true);
    kandidaten = rap.gevonden; stand = 'zojuist';
  } else {
    const { data } = await admin().from('hr_signaleringen').select('tijdstip,details').eq('check', 'oproepaanbod').order('tijdstip', { ascending: false }).limit(1);
    if (data && data[0]) { kandidaten = (data[0].details && data[0].details.gevonden) || []; stand = new Date(data[0].tijdstip).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }); }
  }
  return { rijen: await S.getOproepaanbod(), kandidaten, stand, winkels, maanden: C.OPROEP_MAANDEN };
});
