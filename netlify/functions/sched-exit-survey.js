// Scheduled function: exit-survey automatisch op de dag na de laatste werkdag (dagelijks 10:50 zomertijd / 09:50 wintertijd)
// Cron in UTC: '50 8 * * *'. Verstuurt alleen als SIGNALERINGEN_ACTIEF=1 én de exit-survey aan staat (Uitstroom → Exit-surveys).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('50 8 * * *', async () => {
  const rap = await SIG.draai('exit-survey', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
