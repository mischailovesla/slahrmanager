// Scheduled function (v0.26.0): datacontrole (maandag 09:40 zomertijd / een uur eerder in de wintertijd)
// Cron in UTC: '40 7 * * 1'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('40 7 * * 1', async () => {
  const rap = await SIG.draai('datacontrole', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
