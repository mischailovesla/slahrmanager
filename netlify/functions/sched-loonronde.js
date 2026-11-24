// Scheduled function (v0.56.0): loonronde — herinnering aan de aanlevermomenten richting de salarisadministratie
// (uurloners: 6e, vastloners/uitdienst: 18e). Geen mail: de check zet open stappen als taak in de takenlijst
// (Overzicht) vanaf 3 werkdagen vooraf; afvinken in tab Loonadministratie haalt de taak weg.
// Cron in UTC: '10 5 * * 1-5' = werkdagen 07:10 zomertijd / 06:10 wintertijd (vóór het HR-dagoverzicht van 09:00).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('10 5 * * 1-5', async () => {
  const rap = await SIG.draai('loonronde', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, gevonden: rap.gevonden.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
