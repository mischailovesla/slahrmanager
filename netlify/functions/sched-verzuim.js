// Scheduled function (fase 2): verzuim (dagelijks 10:20 zomertijd / 09:20 wintertijd)
// Cron in UTC: '20 8 * * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('20 8 * * *', async () => {
  const rap = await SIG.draai('verzuim', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
