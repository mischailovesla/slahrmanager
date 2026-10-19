// Scheduled function (fase 3a): check-in na 30/60 dagen — uitnodigingen + herinneringen (dagelijks 10:40 zomertijd / 09:40 wintertijd)
// Cron in UTC: '40 8 * * *'. Verstuurt alleen als SIGNALERINGEN_ACTIEF=1 én de check-in aan staat (Instroom → Check-in 30/60).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('40 8 * * *', async () => {
  const rap = await SIG.draai('checkin', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
