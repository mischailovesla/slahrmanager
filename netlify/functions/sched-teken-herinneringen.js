// Scheduled function (v0.53.2): herinnering om een waarschuwing voor gezien te tekenen.
// Cron in UTC: '25 8 * * *' = 09:25 wintertijd / 10:25 zomertijd. Draait in droogloop tot env SIGNALERINGEN_ACTIEF=1.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('25 8 * * *', async () => {
  const rap = await SIG.draai('teken-herinneringen', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
