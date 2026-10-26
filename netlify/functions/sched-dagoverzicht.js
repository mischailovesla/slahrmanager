// Scheduled function (v0.32.0): HR-overzicht — alle interne HR-meldingen sinds het vorige overzicht in één mail.
// v0.32.3: wekelijks op maandag 09:00 Nederlandse tijd (na salaris 08:30 en de ochtendchecks).
const { schedule } = require('@netlify/functions');
const SIG = require('./_lib/signaleringen');
// v0.32.3: altijd 09:00 Nederlandse tijd. Netlify rekent in UTC: draait om 07:00 en 08:00 UTC en gaat alleen door als het in Amsterdam 9 uur is.
const uurNL = () => parseInt(new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }), 10);
exports.handler = schedule('0 7,8 * * 1', async () => {
  if (uurNL() !== 9) return { statusCode: 200 };
  const rap = await SIG.draai('dagoverzicht', false, 'schedule');
  console.log(JSON.stringify({ check: rap.naam, droog: rap.droog, gepauzeerd: rap.gepauzeerd, groepen: rap.gevonden, fouten: rap.fouten }));
  return { statusCode: 200 };
});
