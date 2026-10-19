// Scheduled function (fase 2): oproepaanbod (maandag 10:30 zomertijd / 09:30 wintertijd)
// Cron in UTC: '30 8 * * 1'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('30 8 * * 1', async () => {
  const rap = await SIG.draai('oproepaanbod', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
