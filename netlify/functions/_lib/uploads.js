// ============================================================
// Documenten van medewerkers (loonheffingsverklaring, indienstformulier,
// ondertekende ontslagbevestiging, kortingsformulier) — ZONDER Google Drive.
// De mail bevat een persoonlijke upload-link (/upload.html?t=<token>); het
// bestand gaat rechtstreeks vanuit de browser naar Supabase Storage (privé
// bucket 'hr-documenten'), de registratie staat in tabel hr_uploads en het
// dashboard zet het vinkje in de sheet. Documentverwijzing in het dashboard:
// 'sb:<upload-id>:<key>' (oude Google-Forms-uploads blijven gewone Drive-links).
// Token = base64url(JSON{s,n,d}) + '.' + HMAC-SHA256 (sleutel afgeleid van de
// service key) — stateless, geen tabelrij nodig bij het versturen van de mail.
// ============================================================
const crypto = require('crypto');
const { admin } = require('./auth');
const { normNaam } = require('./util');

const BUCKET = 'hr-documenten';
const MAX_BYTES = 15 * 1024 * 1024;
const TOEGESTAAN = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/heif': '.heif', 'image/webp': '.webp',
  // v0.25.5: ingevulde formulieren komen soms als Excel of Word terug
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx', 'application/vnd.ms-excel': '.xls', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'application/msword': '.doc' };
const SOORTEN = {
  loon:    { label: 'Loonheffingsverklaring en indiensttredingsformulier', labelEN: 'Payroll tax form and onboarding form', bestanden: [{ key: 'loon', label: 'Loonheffingsverklaring (model opgaaf gegevens voor de loonheffingen)', labelEN: 'Payroll tax statement (model opgaaf gegevens voor de loonheffingen)', verplicht: true }, { key: 'indienst', label: 'Indiensttredingsformulier', labelEN: 'Onboarding form', verplicht: false }] },
  ontslag: { label: 'Ondertekende ontslagbevestiging', labelEN: 'Signed confirmation', bestanden: [{ key: 'ontslag', label: 'Ondertekend document', labelEN: 'Signed document', verplicht: true }] },
  oproep:  { label: 'Ondertekend aanbod vaste arbeidsomvang', labelEN: 'Signed offer of fixed working hours', bestanden: [{ key: 'oproep', label: 'Ondertekende brief (akkoord of niet akkoord aangekruist)', labelEN: 'Signed letter (accept or decline ticked)', verplicht: true }] },
  overplaatsing: { label: 'Ondertekende overplaatsing / standplaatswijziging', labelEN: 'Signed transfer / change of workplace', bestanden: [{ key: 'overplaatsing', label: 'Ondertekende brief', labelEN: 'Signed letter', verplicht: true }] },
  korting: { label: 'Formulier loonheffingskorting', labelEN: 'Payroll tax credit form', bestanden: [{ key: 'korting', label: 'Ondertekend formulier loonheffingskorting', labelEN: 'Signed payroll tax credit form', verplicht: true }] }
};
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function sleutel() {
  const basis = process.env.UPLOAD_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!basis) throw new Error('UPLOAD_SECRET/SUPABASE_SERVICE_KEY ontbreekt');
  return crypto.createHash('sha256').update('hr-upload|' + basis).digest();
}
const hmac = p => b64u(crypto.createHmac('sha256', sleutel()).update(p).digest()).slice(0, 32);
// Generiek getekend token (ook gebruikt door de exit-survey, _lib/exit.js)
function tekenToken(obj) { const p = b64u(JSON.stringify(obj)); return p + '.' + hmac(p); }
function leesGetekend(t, foutmelding) {
  const [p, sig] = String(t || '').split('.');
  if (!p || !sig || sig.length !== 32) throw new Error(foutmelding);
  const goed = hmac(p);
  if (goed.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(goed), Buffer.from(sig))) throw new Error(foutmelding);
  return JSON.parse(unb64u(p).toString('utf8'));
}
function maakToken(soort, naam) {
  if (!SOORTEN[soort]) throw new Error('Onbekende upload-soort: ' + soort);
  return tekenToken({ s: soort, n: String(naam || '').trim(), d: new Date().toISOString().slice(0, 10) });
}
function leesToken(t) {
  const d = leesGetekend(t, 'Ongeldige upload-link.');
  if (!SOORTEN[d.s]) throw new Error('Ongeldige upload-link.');
  return d;
}
const site = () => (process.env.UPLOAD_SITE || process.env.URL || 'https://slahrmanager.netlify.app').replace(/\/$/, '');
const uploadLink = (soort, naam) => site() + '/upload.html?t=' + maakToken(soort, naam);

const slug = s => normNaam(s).replace(/\s+/g, '_').slice(0, 40) || 'medewerker';
const veiligeBestandsnaam = s => String(s || 'bestand').replace(/[^\w.\-]+/g, '_').slice(0, 80);
function controleer(bestand) {
  if (!TOEGESTAAN[bestand.mime]) throw new Error('Alleen PDF, foto (JPG/PNG/HEIC), Excel of Word. (' + bestand.mime + ')');
  if (!(bestand.bytes > 0) || bestand.bytes > MAX_BYTES) throw new Error('Bestand is te groot (max. 15 MB).');
}
// Stap 1: getekende upload-URL voor de browser (bestand gaat niet door de function heen)
async function startUpload(tok, key, bestand) {
  const soort = SOORTEN[tok.s], spec = soort.bestanden.find(b => b.key === key);
  if (!spec) throw new Error('Onbekend bestandstype: ' + key);
  controleer(bestand);
  const pad = tok.s + '/' + slug(tok.n) + '/' + Date.now() + '_' + key + '_' + veiligeBestandsnaam(bestand.naam);
  const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(pad);
  if (error) throw new Error('Storage: ' + error.message + (/not found|bucket/i.test(error.message) ? ' (bestaat bucket "' + BUCKET + '"? zie migratie 0005)' : ''));
  return { pad, token: data.token, bucket: BUCKET };
}
// Stap 2: registreren (na de upload); controleert dat de objecten bestaan
async function registreer(tok, bestanden, meta) {
  const soort = SOORTEN[tok.s];
  const lijst = [];
  for (const b of bestanden || []) {
    const spec = soort.bestanden.find(x => x.key === b.key); if (!spec) continue;
    const pad = String(b.pad || ''); if (pad.indexOf(tok.s + '/' + slug(tok.n) + '/') !== 0) throw new Error('Ongeldig bestandspad.');
    const map = pad.substring(0, pad.lastIndexOf('/')), naam = pad.substring(pad.lastIndexOf('/') + 1);
    const { data, error } = await admin().storage.from(BUCKET).list(map, { search: naam });
    if (error || !data || !data.some(o => o.name === naam)) throw new Error('Upload van "' + spec.label + '" niet gevonden in de opslag.');
    lijst.push({ key: b.key, label: spec.label, pad, naam_orig: String(b.naam_orig || '').slice(0, 120), bytes: Number(b.bytes) || 0, mime: String(b.mime || '') });
  }
  if (!lijst.length) throw new Error('Geen bestanden ontvangen.');
  if (!(meta && meta.handmatig)) for (const spec of soort.bestanden) if (spec.verplicht && !lijst.some(x => x.key === spec.key)) throw new Error('"' + spec.label + '" ontbreekt.');
  const { data, error } = await admin().from('hr_uploads').insert({ soort: tok.s, naam: tok.n, email: (meta && meta.email) || null, rij: (meta && meta.rij) || null, bestanden: lijst, ip: (meta && meta.ip) || null }).select('id').single();
  if (error) throw new Error('hr_uploads: ' + error.message + (/soort_check/.test(error.message) ? ' (migratie 0013 nog draaien in Supabase)' : ''));
  return { id: data.id, bestanden: lijst, refs: Object.fromEntries(lijst.map(x => [x.key, 'sb:' + data.id + ':' + x.key])) };
}
// Alle uploads van een soort → { byNaam: {norm: {key: ref}}, byEmail }, nieuwste wint
async function vindUploads(soort) {
  const byNaam = {}, byEmail = {};
  const { data, error } = await admin().from('hr_uploads').select('id,naam,email,bestanden,created_at').eq('soort', soort).order('created_at', { ascending: false }).limit(2000);
  if (error) { console.warn('hr_uploads:', error.message); return { byNaam, byEmail }; }
  for (const u of data || []) {
    const refs = {}; (u.bestanden || []).forEach(b => { refs[b.key] = 'sb:' + u.id + ':' + b.key; });
    const n = normNaam(u.naam), e = String(u.email || '').toLowerCase();
    if (n) byNaam[n] = Object.assign({}, refs, byNaam[n] || {});
    if (e) byEmail[e] = Object.assign({}, refs, byEmail[e] || {});
  }
  return { byNaam, byEmail };
}
const isRef = s => /^sb:[0-9a-f-]{36}:\w+$/.test(String(s || ''));
async function zoekBestand(ref) {
  const m = String(ref || '').match(/^sb:([0-9a-f-]{36}):(\w+)$/); if (!m) throw new Error('Geen Supabase-documentverwijzing: ' + ref);
  const { data, error } = await admin().from('hr_uploads').select('id,naam,bestanden').eq('id', m[1]).single();
  if (error || !data) throw new Error('Document niet gevonden (' + m[1] + ').');
  const b = (data.bestanden || []).find(x => x.key === m[2]); if (!b) throw new Error('Bestand "' + m[2] + '" niet gevonden in upload ' + m[1]);
  return Object.assign({ upload: data }, b);
}
// Tijdelijke downloadlink (dashboard)
async function signedUrl(ref, seconden) {
  const b = await zoekBestand(ref);
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(b.pad, seconden || 120, { download: b.naam_orig || undefined });
  if (error) throw new Error('Storage: ' + error.message);
  return { url: data.signedUrl, bestand: b };
}
// Bestand als bijlage (salarisadministratie): { filename, content(base64) }
async function bestandMetLabel(ref, label, naam) {
  const b = await zoekBestand(ref);
  const { data, error } = await admin().storage.from(BUCKET).download(b.pad);
  if (error) throw new Error('Storage download: ' + error.message);
  const buf = Buffer.from(await data.arrayBuffer());
  const ext = (b.naam_orig && b.naam_orig.lastIndexOf('.') > -1 ? b.naam_orig.substring(b.naam_orig.lastIndexOf('.')) : TOEGESTAAN[b.mime]) || '';
  return { filename: label + '_' + String(naam || '').trim().replace(/\s+/g, '_') + ext.toLowerCase(), content: buf.toString('base64'), bytes: buf.length };
}
module.exports = { site, SOORTEN, BUCKET, tekenToken, leesGetekend, maakToken, leesToken, uploadLink, startUpload, registreer, vindUploads, isRef, zoekBestand, signedUrl, bestandMetLabel };
