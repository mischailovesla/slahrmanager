// ============================================================
// GET /api/scorekaart?maanden=3|6|12[&ververs=1]                 -> scorekaart alle winkels + SLA-totaal (fase 3c)
// GET /api/scorekaart?maanden=6&winkel=Zuidas&pdf=1              -> { pdf (base64), bestandsnaam } voor het overleg met de Store Manager
// Alleen-lezen; de PDF-export wordt gelogd (hr_acties).
// ============================================================
const { beveiligd, logActie } = require('./_lib/auth');
const SK = require('./_lib/scorekaart');

exports.handler = beveiligd('scorekaart', async (event, g) => {
  const q = event.queryStringParameters || {};
  const sk = await SK.getScorekaart(q.maanden, q.ververs === '1');
  try { const VK = require('./_lib/verloopkosten'), { p: kp, standaard } = await VK.params(); sk.kosten = VK.bereken(sk, kp, sk.maandenAantal); sk.kostenStandaard = standaard; sk.kostenTarieven = VK.TARIEVEN; }
  catch (e) { sk.kostenFout = 'Kosten van verloop: ' + e.message; }
  try { sk.mto = await require('./_lib/mto').samenvatting(); } catch (e) { sk.mto = null; }
  if (q.pdf === '1') {
    if (!q.winkel) throw new Error('Kies een winkel.');
    const pdf = await require('./_lib/scorekaart-pdf').maakScorekaartPdf(sk, q.winkel, g.email);
    await logActie({ door: g.email, actie: 'export', bron: 'scorekaart', veld: 'pdf', naam: q.winkel, details: 'Scorekaart ' + q.winkel + ' · ' + sk.periode });
    return { pdf: pdf.toString('base64'), bestandsnaam: 'Scorekaart_' + String(q.winkel).replace(/[^\w]+/g, '_') + '_' + sk.maanden[sk.maanden.length - 1].replace(/\s+/g, '') + '.pdf' };
  }
  return sk;
});
