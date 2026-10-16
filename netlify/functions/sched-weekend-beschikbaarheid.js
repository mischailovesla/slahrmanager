// Scheduled function (batch A): weekendbeschikbaarheid (checkWeekendBeschikbaarheid, maandag 09:45)
// Cron in UTC: '45 7 * * 1' = maandag 09:45 zomertijd / 08:45 wintertijd. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('45 7 * * 1', async () => {
  const rap = await SIG.draai('weekend-beschikbaarheid', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
