// Scheduled function (v0.44.0): nieuwe versie van het model opgaaf gegevens voor de loonheffingen? (elke maandag)
// Cron in UTC: '23 6 * * 1' = 07:23 wintertijd / 08:23 zomertijd. Mail alleen als SIGNALERINGEN_ACTIEF=1 (anders droogloop);
// de uitkomst van de controle staat altijd in de tab Loonheffing.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('23 6 * * 1', async () => {
  const rap = await SIG.draai('lh-model', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
