// Scheduled function (stap 4): nieuwe medewerkers zonder loonheffingsuitnodiging — elke 4 uur overdag.
// Cron in UTC: '45 7,11,15,19 * * *' = 09:45/13:45/17:45/21:45 zomertijd (een uur eerder in de winter).
// Schakelaar 'loon_auto' aan: automatisch uitnodigen (NL + EN). Uit: HR-lijstje alleen bij de eerste run van de dag. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('45 7,11,15,19 * * *', async () => {
  const rap = await SIG.draai('nieuwe-medewerkers', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
