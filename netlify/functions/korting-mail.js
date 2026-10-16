// ============================================================
// POST /api/korting-mail  (port van stuurKortingMail, Korting.gs v1.5)
// { naam, email, keuze:'Aanzetten'|'Uitzetten'|'Wijzigen', ingangsdatum?, deadline?, taal, rij?, preview? }
//  - mail in SLA-huisstijl met 3 stappen (download Belastingdienst-formulier, invullen, uploaden)
//  - log in tab 'Korting' A–M; bestaande rij = opnieuw versturen (dossier weer open)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const D = require('./_lib/datum');

// dd-mm-jjjj normaliseren naar dd-MM-yyyy (kortNetteDatum_); anders ongewijzigd
function netteDatum(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (!m) return String(s || '').trim();
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return String(s).trim();
  return String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0') + '-' + m[3];
}

exports.handler = beveiligd('korting-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim(), email = String(p.email || '').trim();
  const keuze = T.KORT_KEUZES.indexOf(p.keuze) > -1 ? p.keuze : 'Wijzigen';
  const isEN = String(p.taal || 'NL').toUpperCase() === 'EN';
  const ingang = netteDatum(p.ingangsdatum), deadline = netteDatum(p.deadline);
  const subject = T.kortSubject(keuze, isEN, false);
  const text = T.kortingPlain(naam, keuze, ingang, deadline, isEN, false), html = T.kortingHtml(naam, keuze, ingang, deadline, isEN, false);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Vul de naam van de medewerker in.');
  if (!email || email.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to: email, subject, text, html, tags: [{ name: 'bron', value: 'korting' }, { name: 'type', value: keuze.toLowerCase() }] });
  const nu = D.stempel();
  const rij = await S.logKorting({ naam, email, keuze, ingangsdatum: ingang, deadline, taal: isEN ? 'EN' : 'NL', rij: p.rij }, nu);
  await M.logMail({ door: g.email, bron: 'korting', type: keuze.toLowerCase(), naar: email, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'korting', veld: keuze, rij, naam, nieuw: email, details: subject });
  return { bericht: 'Formulier loonheffingskorting (' + keuze.toLowerCase() + ') verstuurd naar ' + email, rij, resendId };
});
