// ============================================================
// Fase 4b: HR-maandrapport
// GET  /api/maandrapport?maand=JJJJ-MM[&ververs=1]   -> rapport als JSON (leeg = vorige maand) + lijst kiesbare maanden
// GET  /api/maandrapport?maand=JJJJ-MM&pdf=1         -> { pdf (base64), bestandsnaam }   (export gelogd in hr_acties)
// POST /api/maandrapport { maand, actie:'mail' }     -> rapport nu mailen naar Mischa/Jodi/Ymke (SIGNALERING_ONTVANGERS.maandrapport)
// Automatisch: check 'maandrapport' (sched-maandrapport, 1e van de maand).
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const MR = require('./_lib/maandrapport');
const C = require('./_lib/config');

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function kiesbaar() {
  const nu = require('./_lib/scorekaart').nuNL(), uit = [];
  for (let i = 0; i <= 12; i++) { const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1); uit.push({ sleutel: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: MAAND[d.getMonth()] + ' ' + d.getFullYear() + (i === 0 ? ' (lopend)' : '') }); }
  return uit;
}

exports.handler = beveiligd('maandrapport', async (event, g) => {
  const q = event.queryStringParameters || {};
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie !== 'mail') throw new Error('Onbekende actie.');
    const r = await MR.laad(p.maand, false, p.winkel || '');
    const naar = String(C.SIGNALERING_ONTVANGERS.maandrapport || C.HR_EMAIL);
    await MR.mail(r, naar, g.email);
    await logActie({ door: g.email, actie: 'mail', bron: 'maandrapport', veld: r.sleutel, naam: '', nieuw: naar, details: 'Maandrapport ' + r.label + ' handmatig gemaild' });
    return { bericht: 'Maandrapport ' + r.label + ' gemaild naar ' + naar.split(',').join(', ') + '.' };
  }
  const r = await MR.laad(q.maand, q.ververs === '1', q.winkel || '');
  if (q.pdf === '1') {
    const pdf = await require('./_lib/maandrapport-pdf').maakMaandrapportPdf(r, g.email);
    await logActie({ door: g.email, actie: 'export', bron: 'maandrapport', veld: 'pdf', naam: '', details: r.titel || ('Maandrapport ' + r.label) });
    return { pdf: pdf.toString('base64'), bestandsnaam: MR.bestandsnaam(r) };
  }
  r.kiesbaar = kiesbaar(); r.ontvangers = String(C.SIGNALERING_ONTVANGERS.maandrapport || C.HR_EMAIL).split(',');
  return r;
});
