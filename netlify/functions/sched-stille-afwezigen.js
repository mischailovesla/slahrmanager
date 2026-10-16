// Scheduled function (stap 4): stille afwezigen (checkStilleAfwezigen, maandag 10:00)
// Cron in UTC: '0 8 * * 1' = maandag 10:00 zomertijd / 09:00 wintertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 8 * * 1', async () => {
  const rap = await SIG.draai('stille-afwezigen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
