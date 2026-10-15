// ============================================================
// POST /api/loonheffing-mail
// { template:'uitnodiging-nl'|..., to, naam, deadline?, rij?, subject?, body? }
// Verstuurt via Resend (SLA-huisstijl HTML + plain text) en logt in de
// loonheffing-sheet zoals Code.gs:
//   uitnodiging -> kolom D 'Verzonden op dd-MM-yyyy HH:mm' (groen) + E datum
//                  (nieuwe rij als de medewerker nog niet in de sheet staat)
//   herinnering -> kolom H laatste herinnering + I teller (zoals de automatische check)
// Alleen voorvertonen: { ..., preview:true } -> geeft subject/text/html terug, verstuurt niets.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const { SHEETS } = require('./_lib/config');

function stempel() {
  const d = new Date();
  const p = n => (n < 10 ? '0' : '') + n;
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return { datum: g('day') + '-' + g('month') + '-' + g('year'), tijd: g('hour') + ':' + g('minute'), p };
}

exports.handler = beveiligd('loonheffing-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const tpl = T.LOON_TEMPLATES.find(x => x.key === p.template);
  if (!tpl) throw new Error('Onbekend template: ' + p.template);
  const naam = String(p.naam || '').trim();
  const to = String(p.to || '').trim();
  const deadline = String(p.deadline || '').trim();
  const isEN = tpl.taal === 'EN';
  const subject = String(p.subject || tpl.subject).trim();
  const text = T.personaliseerUploadLinks(String(p.body || T.loonPlain(tpl.type, naam, deadline, isEN)), naam);
  const html = T.loonHtml(tpl.type, naam, deadline, isEN);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Naam ontbreekt.');
  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');

  const resendId = await M.verstuur({ to, subject, text, html, tags: [{ name: 'bron', value: 'loonheffing' }, { name: 'type', value: tpl.type }] });

  // --- sheet-logging ---
  const id = SHEETS.loonheffing.id;
  const st = stempel();
  const nu = st.datum + ' ' + st.tijd;
  let rij = parseInt(p.rij, 10) || 0;
  if (!rij) rij = await S.vindLoonRij(to);
  let nieuweRij = false;
  if (!rij) {
    rij = await S.eersteLegeLoonRij();
    nieuweRij = true;
    await S.zetCel(id, null, rij, 1, naam);
    await S.zetCel(id, null, rij, 2, to);
    if (deadline) await S.zetCel(id, null, rij, 3, deadline);
    await S.zetCel(id, null, rij, 7, tpl.taal);
  }
  if (tpl.type === 'uitnodiging') {
    await S.zetCel(id, null, rij, 4, 'Verzonden op ' + nu, S.KLEUR.groen);
    await S.zetCel(id, null, rij, 5, nu);
    if (deadline && !nieuweRij) await S.zetCel(id, null, rij, 3, deadline);
  } else {
    const teller = parseInt(await S.leesCel(id, null, rij, 9), 10) || 0;
    await S.zetCel(id, null, rij, 8, nu);
    await S.zetCel(id, null, rij, 9, String(teller + 1));
  }
  await M.logMail({ door: g.email, bron: 'loonheffing', type: tpl.type, naar: to, naam, onderwerp: subject, taal: tpl.taal, rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'loonheffing', veld: tpl.type, rij, naam, nieuw: to, details: subject });
  return { bericht: (tpl.type === 'uitnodiging' ? 'Uitnodiging' : 'Herinnering') + ' verstuurd naar ' + to + (nieuweRij ? ' (nieuwe rij ' + rij + ')' : ''), rij, resendId };
});
