// ============================================================
// Publieke upload-endpoint voor medewerkers (geen login; beveiligd met het
// getekende token uit de mail). Vervangt de Google Forms + Drive-uploads.
//   POST { t }                               -> { soort, naam, label, bestanden:[{key,label,verplicht}] }
//   POST { t, stap:'start', key, naam, mime, bytes } -> { pad, token, bucket }  (getekende upload-URL)
//   POST { t, stap:'klaar', email?, bestanden:[{key,pad,naam_orig,bytes,mime}] }
//        -> registreert in hr_uploads, zet het vinkje in de sheet, logt hr_acties
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const { normNaam } = require('./_lib/util');

async function zetVinkje(tok, refs) {
  const nn = normNaam(tok.n);
  const match = r => normNaam(r.naam) === nn;
  if (tok.s === 'loon') {
    const r = (await S.getLoonheffing()).find(match); if (!r) return 0;
    if (r.ontvangen !== 'Ja') await S.zetCel(C.SHEETS.loonheffing.id, null, r.rij, 6, 'Ja', S.KLEUR.groen);
    return r.rij;
  }
  if (tok.s === 'ontslag') {
    const r = (await S.getOntslag()).find(match); if (!r) return 0;
    if (r.ondertekend !== 'Ja') await S.zetCel(C.SHEETS.ontslag.id, null, r.rij, 10, 'Ja', S.KLEUR.groen);
    return r.rij;
  }
  if (tok.s === 'korting') {
    const open = (await S.getKorting()).filter(r => match(r) && r.retour !== 'Ja'); // nieuwste open dossier (lijst is nieuwste-eerst)
    const r = open[0]; if (!r) return 0;
    await S.zetCel(C.SHEETS.loonheffing.id, C.TAB_KORTING, r.rij, 9, 'Ja', S.KLEUR.groen);
    await S.zetCel(C.SHEETS.loonheffing.id, C.TAB_KORTING, r.rij, 10, refs.korting || '');
    return r.rij;
  }
  if (tok.s === 'oproep') {
    const open = (await S.getOproepaanbod()).filter(r => match(r) && !r.reactie); const r = open[0]; if (!r) return 0;
    await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 14, 'Ontvangen (document)'); await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 15, new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 16).replace('T', ' '));
    await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 16, refs.oproep || '');
    return r.rij;
  }
  return 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = U.leesToken(p.t);
    const soort = U.SOORTEN[tok.s];
    if (!p.stap) return json(200, { success: true, soort: tok.s, naam: tok.n, label: soort.label, labelEN: soort.labelEN, bestanden: soort.bestanden });
    if (p.stap === 'start') return json(200, Object.assign({ success: true }, await U.startUpload(tok, p.key, { naam: p.naam, mime: p.mime, bytes: p.bytes })));
    if (p.stap === 'klaar') {
      const ip = (event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['client-ip'] || null;
      const email = String(p.email || '').trim().toLowerCase() || null;
      const reg = await U.registreer(tok, p.bestanden, { email, ip });
      let rij = 0, sheetFout = '';
      try { rij = await zetVinkje(tok, reg.refs); } catch (e) { sheetFout = e.message; console.warn('upload vinkje:', e.message); }
      await logActie({ door: 'upload:' + (email || tok.n), actie: 'upload', bron: tok.s, veld: Object.keys(reg.refs).join('+'), rij, naam: tok.n, nieuw: reg.id, details: reg.bestanden.map(b => b.label + ' (' + Math.round(b.bytes / 1024) + ' kB)').join(', ') + (sheetFout ? ' | sheet: ' + sheetFout : '') });
      return json(200, { success: true, id: reg.id, aantal: reg.bestanden.length });
    }
    return json(400, { success: false, bericht: 'Onbekende stap' });
  } catch (e) {
    console.warn('upload:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
