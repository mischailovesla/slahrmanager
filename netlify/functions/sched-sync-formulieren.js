// Scheduled function (stap 4): formulierstatus syncen (syncFormulierStatus, elke 4 uur)
// Cron in UTC: '0 */4 * * *' = elke 4 uur. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 */4 * * *', async () => {
  const rap = await SIG.draai('sync-formulieren', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
