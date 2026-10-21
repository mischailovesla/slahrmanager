// Scheduled function (fase 5): MTO — restant uitnodigingen, herinneringen na 7 en 14 dagen, ronde dicht na 21 dagen,
// en in februari/september één herinnering aan HR om een ronde te starten. Dagelijks 10:20 zomertijd / 09:20 wintertijd.
// Verstuurt alleen als SIGNALERINGEN_ACTIEF=1 (anders droog: alleen rapporteren).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('20 8 * * *', async () => {
  const rap = await SIG.draai('mto', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
