// ============================================================
// POST /api/overplaatsing-mail  (port van stuurOverplaatsing uit Code.gs v29.5)
// { naam, to, adres?, huidigeWinkel, nieuweWinkel, datumIndienst?, ingangsdatum?, functie?, taal?, rij?, preview?, alleenPdf? }
//  - zelfde BV voor beide winkels -> standplaatswijziging (art. 7:613 BW), anders overplaatsing (art. 6:159 BW)
//  - PDF uit _lib/brieftemplates.js (tekst 1-op-1 uit de Docs-templates), mail in huisstijl via Resend
//  - logging in tab 'Overplaatsing' (A..L, P = type), bestaande rij -> alleen K/L
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');

function stempel() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute');
}
function briefDatum(isEN) {
  const d = new Date();
  if (isEN) return d.toLocaleDateString('en-US', { timeZone: 'Europe/Amsterdam', month: 'long', day: 'numeric', year: 'numeric' });
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: 'long', year: 'numeric' }).formatToParts(d);
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + ' ' + g('month') + ' ' + g('year');
}
const veiligeNaam = n => String(n || 'medewerker').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

exports.handler = beveiligd('overplaatsing-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const huidig = C.WINKEL_BV_MAP[p.huidigeWinkel], nieuw = C.WINKEL_BV_MAP[p.nieuweWinkel];
  if (!huidig || !nieuw) throw new Error('Selecteer huidige en nieuwe winkel.');
  if (p.huidigeWinkel === p.nieuweWinkel) throw new Error('Van en naar zijn dezelfde winkel.');
  const isStandpl = huidig.bv === nieuw.bv, isEN = p.taal === 'EN';
  const naam = String(p.naam || '').trim(), to = String(p.to || '').trim(), ingangsdatum = String(p.ingangsdatum || '').trim();
  const subject = T.overplaatsingSubject(naam, isStandpl, isEN);
  const text = T.personaliseerUploadLinks(T.overplaatsingPlain(naam, huidig, nieuw, ingangsdatum, isStandpl, isEN), naam);
  const html = T.overplaatsingHtml(naam, huidig, nieuw, ingangsdatum, isStandpl, isEN);
  if (p.preview) return { subject, text, html, isStandpl };
  if (!naam) throw new Error('Vul de naam in.');

  const sjabloon = isStandpl ? (isEN ? B.STANDPL_EN : B.STANDPL_NL) : (isEN ? B.OVERPL_EN : B.OVERPL_NL);
  const tekst = B.vul(sjabloon, {
    '{{Naam}}': naam, '{{HuidigeBV}}': huidig.bv, '{{NieuweBV}}': nieuw.bv, '{{DatumIndiensttreding}}': String(p.datumIndienst || '').trim(),
    '{{IngangsdatumOverplaatsing}}': ingangsdatum, '{{Functie}}': String(p.functie || '').trim(),
    '{{HuidigeStandplaats}}': huidig.naam + ' (' + huidig.adres + ')', '{{Standplaats}}': nieuw.naam + ' (' + nieuw.adres + ')', '{{HuidigeDatum}}': briefDatum(isEN)
  });
  const typeLabel = isStandpl ? 'Standplaatswijziging' : 'Overplaatsing';
  const bestandsnaam = (isStandpl ? (isEN ? 'Change_of_workplace_' : 'Standplaatswijziging_') : (isEN ? 'Transfer_' : 'Overplaatsing_')) + veiligeNaam(naam) + '.pdf';
  const pdf = await P.maakOpgemaakteBrief(tekst, { titel: typeLabel + ' - ' + naam });
  if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam, isStandpl };

  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to, subject, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'overplaatsing' }, { name: 'type', value: isStandpl ? 'standplaats' : 'overplaatsing' }] });
  const rij = await S.logOverplaatsing({ rij: p.rij, naam, to, adres: p.adres, datumIndienst: p.datumIndienst, ingangsdatum, functie: p.functie, taal: isEN ? 'EN' : 'NL' }, huidig, nieuw, isStandpl, stempel());
  try { await require('./_lib/ondertekening').aanmaken({ soort: 'overplaatsing', type: isStandpl ? 'standplaats' : 'overplaatsing', titel: typeLabel + ' - ' + naam, naam, email: to, rij, taal: isEN ? 'EN' : 'NL', pdf, door: g.email }); } catch (e) { console.warn('ondertekening aanmaken:', e.message); }
  await M.logMail({ door: g.email, bron: 'overplaatsing', type: isStandpl ? 'standplaats-pdf' : 'overplaatsing-pdf', naar: to, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'overplaatsing', veld: typeLabel, rij, naam, nieuw: to, details: subject + ' (+PDF) ' + huidig.naam + ' → ' + nieuw.naam });
  return { bericht: typeLabel + (isEN ? ' (EN)' : '') + ' + PDF verstuurd naar ' + to + ' (rij ' + rij + ')', rij, resendId, isStandpl };
});
