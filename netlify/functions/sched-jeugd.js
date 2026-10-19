// Scheduled function (fase 2): jeugd (maandag 10:15 zomertijd / 09:15 wintertijd)
// Cron in UTC: '15 8 * * 1'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('15 8 * * 1', async () => {
  const rap = await SIG.draai('jeugd', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
