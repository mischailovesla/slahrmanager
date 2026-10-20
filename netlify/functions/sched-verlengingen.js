// Scheduled function (fase 4c): contractverlengingen — status per aflopend contract voor de takenlijst (geen mail).
// Cron in UTC: '5 8 * * *' = dagelijks 10:05 zomertijd / 09:05 wintertijd.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('5 8 * * *', async () => {
  const rap = await SIG.draai('verlengingen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, gevonden: rap.gevonden.length, afgerond: rap.afgerond, fouten: rap.fouten }));
  return { statusCode: 200 };
});
