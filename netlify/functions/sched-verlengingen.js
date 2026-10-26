// Scheduled function (fase 4c): contractverlengingen — status per aflopend contract voor de takenlijst (geen mail).
// Cron in UTC: '5 6 * * *' = dagelijks 10:05 zomertijd / 09:05 wintertijd.
// v0.32.3: vervroegd naar UTC '5 6 * * *' (07:xx winter / 08:xx zomer), zodat het in het HR-dagoverzicht van 09:00 staat.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('5 6 * * *', async () => {
  const rap = await SIG.draai('verlengingen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, gevonden: rap.gevonden.length, afgerond: rap.afgerond, fouten: rap.fouten }));
  return { statusCode: 200 };
});
