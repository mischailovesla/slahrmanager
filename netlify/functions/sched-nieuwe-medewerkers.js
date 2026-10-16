// Scheduled function (stap 4): nieuwe medewerkers zonder loonheffingsuitnodiging (checkNieuweMedewerkers, 09:45)
// Cron in UTC: '45 7 * * *' = 09:45 zomertijd / 08:45 wintertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('45 7 * * *', async () => {
  const rap = await SIG.draai('nieuwe-medewerkers', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
