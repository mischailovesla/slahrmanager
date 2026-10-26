// Scheduled function (fase 2): contractketen (dagelijks 10:00 zomertijd / 09:00 wintertijd)
// Cron in UTC: '10 6 * * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
// v0.32.3: vervroegd naar UTC '10 6 * * *' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('10 6 * * *', async () => {
  const rap = await SIG.draai('contractketen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
