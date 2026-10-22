// Scheduled function (v0.27.4): mail niet aangekomen — elk uur van 08:20 tot 22:20 (zomertijd; een uur eerder in de wintertijd)
// Cron in UTC: '20 6-20 * * *'. Droogloop tot env SIGNALERINGEN_ACTIEF=1 (de status-update bij Resend loopt wel altijd).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('20 6-20 * * *', async () => {
  const rap = await SIG.draai('mail-bounces', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gecontroleerd: rap.gecontroleerd, nieuw: (rap.nieuw || []).length, gevonden: rap.gevonden.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
