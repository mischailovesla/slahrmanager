// Scheduled function (batch D): datakwaliteit Shiftbase (stuurDataHygieneRapport, 1e van de maand 09:00)
// Cron in UTC: '0 7 1 * *' = 09:00 zomertijd / 08:00 wintertijd. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 7 1 * *', async () => {
  const rap = await SIG.draai('data-hygiene', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
