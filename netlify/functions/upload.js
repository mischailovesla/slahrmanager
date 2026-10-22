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
const { zetVinkje } = require('./_lib/vinkje');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = U.leesToken(p.t);
    const soort = U.SOORTEN[tok.s];
    if (!p.stap) {
      let teken = false; try { if (['ontslag', 'overplaatsing', 'oproep', 'waarschuwing', 'beschikbaarheid'].includes(tok.s)) { const o = await require('./_lib/ondertekening').openVoor(tok); teken = !!o; } } catch (e) { /* migratie 0017 nog niet gedraaid */ }
      return json(200, { success: true, soort: tok.s, naam: tok.n, label: soort.label, labelEN: soort.labelEN, bestanden: soort.bestanden, teken });
    }
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
