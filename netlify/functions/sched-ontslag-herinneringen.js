// Scheduled function (stap 4): ontslag-herinneringen (checkOntslagHerinneringen, 09:15)
// Cron in UTC: '15 7 * * *' = 09:15 zomertijd / 08:15 wintertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('15 7 * * *', async () => {
  const rap = await SIG.draai('ontslag-herinneringen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
