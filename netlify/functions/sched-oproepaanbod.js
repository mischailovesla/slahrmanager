// Scheduled function (fase 2): oproepaanbod (maandag 10:30 zomertijd / 09:30 wintertijd)
// Cron in UTC: '40 6 * * 1'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
// v0.32.3: vervroegd naar UTC '40 6 * * 1' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('40 6 * * 1', async () => {
  const rap = await SIG.draai('oproepaanbod', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
