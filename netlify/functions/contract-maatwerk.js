// ============================================================
// v0.33.0: Contract op maat (afwijkende arbeidsovereenkomst die niet in Shiftbase kan)
// GET  /api/contract-maatwerk                         -> { rijen (verstuurde contracten), winkels [{code,naam,bv,adres}] }
// POST { actie:'controle', ...formulier }             -> { fouten, let_op, samenvatting }
// POST { actie:'pdf', ...formulier }                  -> { pdf (base64), bestandsnaam }  — verstuurt en logt niets
// POST { actie:'formulier', rij }                    -> { formulier, winkel } — v0.35.0: verstuurd contract terug in het formulier (zonder BSN/IBAN)
// POST { actie:'versturen', email, ...formulier }     -> mail met PDF + link om digitaal te ondertekenen,
//      log in hr_brieven (categorie 'Contract op maat', zonder BSN/IBAN) + hr_ondertekening + hr_mails + hr_acties
// Tekst en bouwstenen: _lib/contractmaatwerk.js
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const CM = require('./_lib/contractmaatwerk');

const CATEGORIE = 'Contract op maat';
const F = 'font-family:Arial,sans-serif;', P14 = F + 'font-size:14px;color:#333d3a;';

function mailHtml(naam, functie, bv, link) {
  const vn = T.esc(String(naam).trim().split(/\s+/)[0] || naam);
  return T.slaWrap(T.slaHead('#009f4b', 'Je arbeidsovereenkomst') + '<tr><td style="padding:32px 36px 28px">'
    + '<p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">Beste ' + vn + ',</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 16px">In de bijlage vind je jouw arbeidsovereenkomst als <strong>' + T.esc(functie) + '</strong> bij <strong>' + T.esc(bv) + '</strong>, met de huisregels als bijlage.</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 20px">Lees het contract rustig door. Klopt alles? Dan kun je het hieronder digitaal ondertekenen. Je ontvangt daarna automatisch een ondertekende kopie.</p>'
    + '<table cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="background:#009f4b;border-radius:8px"><a href="' + T.esc(link) + '" style="display:inline-block;padding:13px 26px;' + F + 'font-size:15px;font-weight:700;color:#fff;text-decoration:none">&rarr; Contract ondertekenen</a></td></tr></table>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 6px">Vragen of klopt er iets niet? Mail ons gerust op <a href="mailto:' + C.HR_EMAIL + '" style="color:#009f4b">' + C.HR_EMAIL + '</a>.</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:18px 0 0">Hartelijke groet,<br><strong>SLA HR Team</strong></p></td></tr>' + T.slaFoot());
}
const mailPlain = (naam, functie, bv, link) => 'Beste ' + (String(naam).trim().split(/\s+/)[0] || naam) + ',\n\nIn de bijlage vind je jouw arbeidsovereenkomst als ' + functie + ' bij ' + bv + ', met de huisregels als bijlage.\n\nLees het contract rustig door. Klopt alles? Dan kun je het hier digitaal ondertekenen:\n' + link + '\n\nVragen? Mail ons op ' + C.HR_EMAIL + '.\n\nHartelijke groet,\nSLA HR Team';

exports.handler = beveiligd('contract-maatwerk', async (event, g) => {
  if (event.httpMethod !== 'POST') {
    const rijen = (await S.getBrieven()).filter(r => r.categorie === CATEGORIE).map(r => ({ rij: r.rij, naam: r.naam, email: r.email, bv: r.bv, onderwerp: r.onderwerp, verzenddatum: r.verzenddatum, status: r.status }));
    const winkels = Object.keys(C.WINKEL_BV_MAP).map(k => Object.assign({ code: k }, C.WINKEL_BV_MAP[k]));
    return { rijen, winkels };
  }
  const p = body(event), actie = String(p.actie || 'controle');
  if (actie === 'formulier') {   // v0.35.0: verstuurd contract terugzetten in het formulier ("Opnieuw gebruiken")
    const r = (await S.getBrieven()).find(x => String(x.rij) === String(p.rij) && x.categorie === CATEGORIE);
    if (!r) throw new Error('Dit contract staat niet (meer) in het logboek.');
    const f = CM.terugLezen(r.tekst);
    const codes = Object.keys(C.WINKEL_BV_MAP), w = codes.find(k => C.WINKEL_BV_MAP[k].bv === f.bv && C.WINKEL_BV_MAP[k].adres === f.bvAdres) || codes.find(k => C.WINKEL_BV_MAP[k].bv === f.bv) || '';
    return { formulier: Object.assign(f, { email: r.email }), winkel: w, verstuurd: r.verzenddatum };
  }
  if (actie !== 'controle') p._huisregels = await require('./_lib/shiftbasetemplates').huisregels();   // v0.34.0: centrale huisregels
  const b = CM.bouw(p);
  if (actie === 'controle') return { fouten: b.fouten, let_op: b.let_op, samenvatting: b.samenvatting };
  if (b.fouten.length) throw new Error(b.fouten.join(' '));
  const pdf = await P.maakOpgemaakteBrief(b.tekst, { titel: b.titel });
  const bestandsnaam = 'Arbeidsovereenkomst_' + D.veiligeNaam(b.c.naam) + '.pdf';
  if (actie === 'pdf') {
    await logActie({ door: g.email, actie: 'document', bron: 'contract-maatwerk', veld: 'pdf', naam: b.c.naam, details: 'Contract op maat (concept-PDF): ' + b.samenvatting });
    return { pdf: pdf.toString('base64'), bestandsnaam, let_op: b.let_op };
  }
  if (actie !== 'versturen') throw new Error('Onbekende actie: ' + actie);

  const to = String(p.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Vul een geldig e-mailadres van de medewerker in.');
  const link = require('./_lib/uploads').uploadLink('contract', b.c.naam);
  const subject = 'Je arbeidsovereenkomst bij ' + b.c.bv + ' - graag ondertekenen';
  const resendId = await M.verstuur({ to, subject, text: mailPlain(b.c.naam, b.c.functie, b.c.bv, link), html: mailHtml(b.c.naam, b.c.functie, b.c.bv, link),
    attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'contract-maatwerk' }] });
  const nu = D.stempel();
  const rij = await S.logBrief({ naam: b.c.naam, email: to, bv: b.c.bv, categorie: CATEGORIE, onderwerp: b.titel + ' (' + b.samenvatting + ')', tekst: CM.redigeer(b.tekst), metPdf: true }, nu);
  try { await require('./_lib/ondertekening').aanmaken({ soort: 'contract', type: 'contract-maatwerk', titel: b.titel, naam: b.c.naam, email: to, rij, taal: 'NL', pdf, door: g.email }); }
  catch (e) { console.warn('ondertekening aanmaken:', e.message); }
  await M.logMail({ door: g.email, bron: 'contract-maatwerk', type: 'contract', naar: to, naam: b.c.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'contract-maatwerk', veld: 'contract', rij, naam: b.c.naam, nieuw: to, details: b.samenvatting });
  return { bericht: 'Contract verstuurd naar ' + to + ' (met link om digitaal te ondertekenen).', rij, let_op: b.let_op };
});
