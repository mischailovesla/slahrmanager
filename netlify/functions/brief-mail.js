// ============================================================
// POST /api/brief-mail  (port van stuurVrijeBrief in VrijeBrief.gs v1.2)
// { naam, email, bv?, categorie?, onderwerp, tekst, metPdf?, datum? }
//   -> mail in SLA-huisstijl (HTML + plain) via Resend, optioneel met PDF-brief
//      als bijlage (Brief_<Naam>.pdf), logging in tab 'Brieven' (A..I) + hr_mails + hr_acties.
// { ..., preview:true }  -> { subject, text, html } en, als metPdf, de PDF als base64
//                            (voor voorvertonen/downloaden). Verstuurt niets.
// { ..., alleenPdf:true } -> alleen { pdf (base64), bestandsnaam }, verstuurt en logt niets.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const C = require('./_lib/config');

function stempel() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute');
}

exports.handler = beveiligd('brief-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim();
  const email = String(p.email || '').trim();
  const bv = String(p.bv || '').trim() || C.BEDRIJFSNAAM;
  const categorie = String(p.categorie || '').trim() || 'Personeelszaken';
  const onderwerp = String(p.onderwerp || '').trim() || (categorie + ' - ' + naam);
  const tekst0 = String(p.tekst || '');
  const metPdf = !!p.metPdf;
  if (!naam) throw new Error('Vul de naam in.');
  if (!tekst0.trim()) throw new Error('De brief is nog leeg.');
  const tekst = await require('./_lib/allin').pasAan(tekst0, { email, naam }); // managers: geen all-in-tekst

  const brief = { naam, tekst };
  const maakPdf = async () => (await P.maakBriefPdf(brief, bv, categorie, onderwerp)).toString('base64');
  const bestandsnaam = P.pdfBestandsnaam(naam);

  if (p.alleenPdf) return { pdf: await maakPdf(), bestandsnaam };

  const subject = onderwerp;
  const text = T.briefPlain(brief, bv);
  const html = T.briefHtml(brief, bv, categorie);
  if (p.preview) return Object.assign({ subject, text, html, bestandsnaam }, metPdf ? { pdf: await maakPdf() } : {});

  if (!email || email.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const attachments = metPdf ? [{ filename: bestandsnaam, content: await maakPdf() }] : undefined;
  const resendId = await M.verstuur({ to: email, subject, text, html, attachments, tags: [{ name: 'bron', value: 'brief' }, { name: 'type', value: metPdf ? 'brief-pdf' : 'brief' }] });

  const nu = stempel();
  let rij = 0;
  try { rij = await S.logBrief({ naam, email, bv, categorie, onderwerp, tekst, metPdf }, nu); }
  catch (e) { console.warn('logBrief mislukt:', e.message); }
  await M.logMail({ door: g.email, bron: 'brief', type: metPdf ? 'brief-pdf' : 'brief', naar: email, naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'brief', veld: categorie, rij, naam, nieuw: email, details: subject + (metPdf ? ' (+PDF)' : '') });
  return { bericht: 'Brief' + (metPdf ? ' + PDF' : '') + ' verstuurd naar ' + email + (rij ? '' : ' (let op: loggen in tab Brieven is mislukt)'), rij, resendId };
});
