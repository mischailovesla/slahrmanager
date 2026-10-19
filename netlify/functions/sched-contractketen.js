// Scheduled function (fase 2): contractketen (dagelijks 10:00 zomertijd / 09:00 wintertijd)
// Cron in UTC: '0 8 * * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 8 * * *', async () => {
  const rap = await SIG.draai('contractketen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
