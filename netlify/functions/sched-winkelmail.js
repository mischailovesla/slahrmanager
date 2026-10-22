// Scheduled function (v0.28.0): weekoverzicht per winkel aan de store managers — maandag 07:50 zomertijd / 06:50 wintertijd
// Cron in UTC: '50 5 * * 1'. Alleen als Beheer → Winkelmail aan staat én SIGNALERINGEN_ACTIEF=1. Proefstand: alles naar Mischa.
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
exports.handler = schedule('50 5 * * 1', async () => {
  const rap = await SIG.draai('winkelmail', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, proef: rap.proef, verstuurd: rap.verstuurd.length, fouten: rap.fouten }));
  return { statusCode: 200 };
});
