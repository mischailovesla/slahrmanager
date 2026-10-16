// Scheduled function (batch D): AVG-bewaartermijnrapport (bewaartermijnRapport, 1e van de maand 08:00)
// Cron in UTC: '0 6 1 * *' = 08:00 zomertijd / 07:00 wintertijd. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 6 1 * *', async () => {
  const rap = await SIG.draai('bewaartermijnen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
