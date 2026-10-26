// Scheduled function (v0.32.0): HR-dagoverzicht — alle interne HR-meldingen van de afgelopen dag in één mail.
// Werkdagen 11:00 zomertijd / 10:00 wintertijd (na de ochtendchecks). Cron in UTC: '0 9 * * 1-5'. Maandag bevat ook het weekend.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('0 9 * * 1-5', async () => {
  const rap = await SIG.draai('dagoverzicht', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, groepen: rap.gevonden, fouten: rap.fouten }));
  return { statusCode: 200 };
});
