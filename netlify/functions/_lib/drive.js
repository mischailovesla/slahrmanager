// ============================================================
// Google Drive lezen via het service account (Drive API v3, scope drive.readonly).
// Gebruikt voor Documenten → salarisadministratie: de formulier-uploads
// (Google Forms zet ze in een Drive-map van de formuliereigenaar).
// VEREIST: Drive API aan in het GCP-project + upload-map gedeeld met het
// service account (Lezer). Zonder dat: HTTP 403/404 met duidelijke melding.
// ============================================================
const { jwt } = require('./sheets');

function fileIdVanUrl(url) {
  if (!url) return '';
  const s = String(url);
  let m = s.match(/[?&]id=([-\w]{25,})/); if (m) return m[1];
  m = s.match(/\/d\/([-\w]{25,})/); return m ? m[1] : '';
}
async function driveFetch(pad, raw) {
  const { token } = await jwt().getAccessToken();
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + pad + (pad.indexOf('?') > -1 ? '&' : '?') + 'supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg += ' - ' + ((j.error && j.error.message) || ''); } catch (e) { /* noop */ }
    if (r.status === 403 && /not been used|disabled/i.test(msg)) msg += ' (Drive API staat uit in het Google Cloud-project: APIs & Services → Enable "Google Drive API")';
    else if (r.status === 403 || r.status === 404) msg += ' (is de upload-map van het formulier gedeeld met het service account als Lezer?)';
    throw new Error('Drive API: ' + msg);
  }
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}
// Bestand ophalen + nette naam voor de salarisadministratie (blobMetLabel in Code.gs)
async function bestandMetLabel(fileId, label, naam) {
  const meta = await driveFetch(encodeURIComponent(fileId) + '?fields=name,mimeType,size');
  const orig = String(meta.name || ''), ext = orig.lastIndexOf('.') > -1 ? orig.substring(orig.lastIndexOf('.')) : '';
  const buf = await driveFetch(encodeURIComponent(fileId) + '?alt=media', true);
  return { filename: label + '_' + String(naam || '').trim().replace(/\s+/g, '_') + ext, content: buf.toString('base64'), mime: meta.mimeType || '', bytes: buf.length };
}
module.exports = { fileIdVanUrl, bestandMetLabel, driveFetch };
