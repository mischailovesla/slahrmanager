// Scheduled function (batch B): loonheffingskorting-herinneringen (checkKortingHerinneringen, dagelijks 09:55)
// Cron in UTC: '55 7 * * *' = 09:55 zomertijd / 08:55 wintertijd. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('55 7 * * *', async () => {
  const rap = await SIG.draai('korting-herinneringen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
