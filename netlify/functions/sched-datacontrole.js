// Scheduled function (v0.26.0, v0.32.2 maandelijks): datacontrole op de 1e van de maand (09:40 zomertijd / 08:40 wintertijd)
// Als aparte mail aan HR, niet in het dagoverzicht. Cron in UTC: '40 7 1 * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('40 7 1 * *', async () => {
  const rap = await SIG.draai('datacontrole', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
