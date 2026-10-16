// ============================================================
// POST /api/sommatie-mail  (port van stuurSommatie / stuurSommatieMetEigenTekst)
// { type, naam, email, bv, storeManager?, datumAfwezig?, datumAfspraak?, eigenTekst?, preview? }
//  - mail in SLA-huisstijl (kleur per type), eigen tekst als extra alinea's vóór de groet
//  - logging in de sommatie-sheet: nieuwe rij A..H + J (eigen tekst), status 'Verstuurd'
//    met de kleur per type (#d9ead3 / #fff2cc / #fce5cd / #f4cccc), plus hr_mails/hr_acties
//  De printbare (aangetekende) brief wordt in de browser gemaakt, zoals in Apps Script.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');

function stempel() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute');
}

exports.handler = beveiligd('sommatie-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  if (T.SOM_TYPES.indexOf(p.type) === -1) throw new Error('Onbekend type sommatie: ' + p.type);
  const d = {
    type: p.type, naam: String(p.naam || '').trim(), email: String(p.email || '').trim(), bv: String(p.bv || '').trim(),
    storeManager: String(p.storeManager || '').trim(), datumAfwezig: String(p.datumAfwezig || '').trim(), datumAfspraak: String(p.datumAfspraak || '').trim(),
    eigenTekst: String(p.eigenTekst || '').trim()
  };
  const subject = T.sommatieSubject(d), text = T.sommatiePlain(d), html = T.sommatieHtml(d);
  if (p.preview) return { subject, text, html };
  if (!d.naam) throw new Error('Vul de naam in.');
  if (!d.email || d.email.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');

  const resendId = await M.verstuur({ to: d.email, subject, text, html, tags: [{ name: 'bron', value: 'sommatie' }, { name: 'type', value: d.type.replace(/[^a-z0-9]+/gi, '-') }] });
  const rij = await S.logSommatie(d, stempel(), T.SOM_SHEETKLEUR[d.type] || S.KLEUR.groen);
  await M.logMail({ door: g.email, bron: 'sommatie', type: d.type, naar: d.email, naam: d.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'sommatie', veld: d.type, rij, naam: d.naam, nieuw: d.email, details: subject + (d.eigenTekst ? ' (+eigen tekst)' : '') });
  return { bericht: d.type + ' verstuurd naar ' + d.email + ' (rij ' + rij + ')', rij, resendId };
});
