// Scheduled function (v0.26.0): jubilea (maandag 09:10 zomertijd / een uur eerder in de wintertijd)
// Cron in UTC: '10 7 * * 1'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('10 7 * * 1', async () => {
  const rap = await SIG.draai('jubilea', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
