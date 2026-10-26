// Scheduled function (stap 4): stille afwezigen (checkStilleAfwezigen, maandag 10:00)
// Cron in UTC: '45 6 * * 1' = maandag 10:00 zomertijd / 09:00 wintertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
// v0.32.3: vervroegd naar UTC '45 6 * * 1' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('45 6 * * 1', async () => {
  const rap = await SIG.draai('stille-afwezigen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
