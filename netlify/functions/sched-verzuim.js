// Scheduled function (fase 2): verzuim (dagelijks 10:20 zomertijd / 09:20 wintertijd)
// Cron in UTC: '15 6 * * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
// v0.32.3: vervroegd naar UTC '15 6 * * *' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('15 6 * * *', async () => {
  const rap = await SIG.draai('verzuim', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
