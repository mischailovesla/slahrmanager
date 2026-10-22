// GET /api/ontslag - alle ontslag/aanzegging-dossiers (voor de tab) + templates
// POST /api/ontslag { rij, opzegging?, einddatum?, bedrijf?, adres?, email? } - v0.27.1: gegevens van een dossier corrigeren
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const C = require('./_lib/config');
// veld → 1-based kolom in hr_ontslag (zelfde volgorde als getOntslag)
const VELDEN = { email: 2, opzegging: 3, einddatum: 4, bedrijf: 6, adres: 7 };
const DATUM = /^\d{2}-\d{2}-\d{4}$/;
async function wijzig(p, g) {
  const rij = parseInt(p.rij, 10); if (!rij || rij < 2) throw new Error('Ongeldige rij');
  const alle = await S.getOntslag(true), r = alle.find(x => x.rij === rij); if (!r) throw new Error('Dossier niet gevonden (rij ' + rij + ')');
  const gewijzigd = [];
  for (const veld of Object.keys(VELDEN)) {
    if (p[veld] === undefined) continue;
    let w = String(p[veld] || '').trim();
    if ((veld === 'opzegging' || veld === 'einddatum') && w) {
      const m = w.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (!m) throw new Error(veld + ': gebruik dd-mm-jjjj (bijv. 10-09-2026)');
      w = m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') + '-' + m[3];
      const d = new Date(+m[3], +m[2] - 1, +m[1]); if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1 || !DATUM.test(w)) throw new Error(veld + ': ' + w + ' is geen geldige datum');
    }
    if (veld === 'einddatum' && !w) throw new Error('Einddatum mag niet leeg zijn');
    if (veld === 'email' && w && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)) throw new Error('Ongeldig e-mailadres');
    if (w === String(r[veld] || '').trim()) continue;
    await S.zetCel(C.SHEETS.ontslag.id, null, rij, VELDEN[veld], w);
    await logActie({ door: g.email, actie: 'wijzig', bron: 'ontslag', veld, rij, naam: r.naam, oud: r[veld] || '', nieuw: w });
    gewijzigd.push(veld);
  }
  return { bericht: r.naam + ': ' + (gewijzigd.length ? gewijzigd.join(', ') + ' aangepast' : 'niets gewijzigd'), gewijzigd };
}
exports.handler = beveiligd('ontslag', async (event, g) => {
  if (event.httpMethod === 'POST') return wijzig(body(event), g);
  const rijen = await S.getOntslag();
  // v0.27.2: dossiercontrole tegen Shiftbase (lopende dossiers); bij een Shiftbase-storing gewoon zonder
  try { const ctl = await require('./_lib/dossiercontrole').laad(rijen); rijen.forEach(r => { if (ctl[r.rij]) r.controle = ctl[r.rij]; }); } catch (e) { console.warn('dossiercontrole:', e.message); }
  return {
    rijen, redenen: C.UITSTROOMREDENEN,
    templates: T.ONTSLAG_TEMPLATES.map(x => ({ key: x.key, label: x.label, taal: x.taal, type: x.type, pdf: x.pdf, subject: x.subject }))
  };
});
