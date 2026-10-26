// Scheduled function (stap 4): aanzegtermijn-bewaking (checkAanzegtermijnen, 09:50)
// Cron in UTC: '0 6 * * *' = 09:50 zomertijd / 08:50 wintertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
// v0.32.3: vervroegd naar UTC '0 6 * * *' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 6 * * *', async () => {
  const rap = await SIG.draai('aanzegtermijnen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
