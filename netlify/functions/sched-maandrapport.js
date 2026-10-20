// Scheduled function (fase 4b): HR-maandrapport over de vorige maand als PDF naar Mischa, Jodi en Ymke.
// Cron in UTC: '30 6 1 * *' = 1e van de maand 08:30 zomertijd / 07:30 wintertijd. Mailt alleen als SIGNALERINGEN_ACTIEF=1
// en het rapport voor die maand nog niet verstuurd is (hr_mails bron 'maandrapport').
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('30 6 1 * *', async () => {
  const rap = await SIG.draai('maandrapport', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
