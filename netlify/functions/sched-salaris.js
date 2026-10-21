// Scheduled function: alles wat klaar is automatisch naar de salarisadministratie (Mahdia) — maandag en donderdag 09:00
// Cron in UTC: '0 7 * * 1,4' = 09:00 zomertijd / 08:00 wintertijd. Alleen als SIGNALERINGEN_ACTIEF=1 én de schakelaar
// 'Automatisch naar salaris' aan staat (tab Loonheffing).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 7 * * 1,4', async () => {
  const rap = await SIG.draai('salaris', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, handmatig: (rap.handmatig || []).length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
