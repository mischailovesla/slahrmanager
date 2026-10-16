// ============================================================
// GET /api/contract[?ververs=1]  (port van getContractOverzicht, Contract.gs v3.0)
// Starters uit Shiftbase (startdatum ≥ 90 dagen geleden, incl. toekomst, max 40):
//  - contract-PDF in Shiftbase (users/{id}/files) — intern, gaat NIET mee naar salaris (afspraak Mahdia 07-04-2026)
//  - loonheffing + indienstformulier gematcht op e-mail → volledige naam → eerste+laatste naamdeel
//  - loonRij + salaris-tijdstempel voor de knop "→ Salaris" (zelfde flow als /api/salaris-mail)
// ============================================================
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const SB = require('./_lib/shiftbase');
const C = require('./_lib/config');
const { normNaam } = require('./_lib/util');
const D = require('./_lib/datum');

const kortNaam = s => { const d = normNaam(s).split(' '); return d.length < 2 ? d.join(' ') : d[0] + ' ' + d[d.length - 1]; };
const parseIso = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const UIT = new Set(C.SB_UITGESLOTEN_NAMEN.map(normNaam));
let _cache = { t: 0, v: null };

function loonIndex(rows) {
  const idx = { byEmail: {}, byNaam: {}, byKort: {} };
  for (const r of rows) {
    const e = { loonUrl: r.docUrl || '', indienstUrl: r.docUrl2 || '', rij: r.rij, salaris: r.salaris || '' };
    if (!e.loonUrl && !e.indienstUrl) continue;
    const em = String(r.email || '').toLowerCase(), nn = normNaam(r.naam), kn = kortNaam(r.naam);
    if (em && !idx.byEmail[em]) idx.byEmail[em] = e;
    if (nn && !idx.byNaam[nn]) idx.byNaam[nn] = e;
    if (kn && !idx.byKort[kn]) idx.byKort[kn] = e;
  }
  return idx;
}
function zoekLoon(idx, email, naam) {
  const em = String(email || '').toLowerCase();
  if (em && idx.byEmail[em]) return { entry: idx.byEmail[em], via: 'e-mail' };
  const nn = normNaam(naam); if (nn && idx.byNaam[nn]) return { entry: idx.byNaam[nn], via: 'naam' };
  const kn = kortNaam(naam); if (kn && idx.byKort[kn]) return { entry: idx.byKort[kn], via: 'roepnaam' };
  return null;
}
function bouwKandidaten(users, vandaag) {
  const cutoff = new Date(vandaag.getTime() - C.CONTRACT_DAGEN_TERUG * 864e5);
  const out = [];
  for (const u0 of users || []) {
    const u = (u0 && u0.User) || u0; if (!u || !u.id) continue;
    if (u.anonymized === true || u.anonymized === 'true') continue;
    const naam = (String(u.first_name || '').trim() + ' ' + (String(u.prefix || '').trim() ? String(u.prefix).trim() + ' ' : '') + String(u.last_name || '').trim()).replace(/\s+/g, ' ').trim();
    if (UIT.has(normNaam(naam))) continue;
    const start = parseIso(u.startdate); if (!start || start < cutoff) continue;
    out.push({ userId: String(u.id), naam, email: String(u.email || '').trim(), start });
  }
  out.sort((a, b) => b.start - a.start);
  return out;
}
function kiesContract(fdata) {
  const files = [];
  for (const f0 of fdata || []) {
    const att = (f0 && f0.Attachment) || f0; if (!att || !att.id) continue;
    const titel = String(att.title || att.file_name || 'Document');
    files.push({ id: String(att.id), titel, isPdf: String(att.content_type || '').indexOf('pdf') > -1, isContract: titel.toLowerCase().indexOf('contract') > -1, ontvangen: att.created ? String(att.created).substring(0, 10).split('-').reverse().join('-') : '' });
  }
  return files.find(f => f.isContract && f.isPdf) || files.find(f => f.isPdf) || null;
}

exports.handler = beveiligd('contract', async (event) => {
  const ververs = (event.queryStringParameters || {}).ververs === '1';
  if (!ververs && _cache.v && _cache.t > Date.now()) return Object.assign({}, _cache.v, { uitCache: true });
  const vandaag = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); vandaag.setHours(0, 0, 0, 0);
  const [users, loon] = await Promise.all([SB.sbGet('users?active=true'), S.getLoonheffing().catch(() => null)]);
  let kandidaten = bouwKandidaten(users, vandaag);
  const capped = kandidaten.length > C.CONTRACT_MAX_USERS;
  if (capped) kandidaten = kandidaten.slice(0, C.CONTRACT_MAX_USERS);
  const idx = loonIndex(loon || []);
  const rows = [];
  for (const kd of kandidaten) {
    let contract = null;
    try { contract = kiesContract(await SB.sbGet('users/' + kd.userId + '/files')); } catch (e) { console.warn('files', kd.userId, e.message); }
    const m = zoekLoon(idx, kd.email, kd.naam);
    rows.push({ userId: kd.userId, naam: kd.naam, email: kd.email, startdatum: D.kort(kd.start), contract, loonUrl: m ? m.entry.loonUrl : '', indienstUrl: m ? m.entry.indienstUrl : '', loonRij: m ? m.entry.rij : 0, verzonden: m ? m.entry.salaris : '', matchVia: m ? m.via : '' });
  }
  const result = { rows, capped, loonBron: !!loon, dagenTerug: C.CONTRACT_DAGEN_TERUG, bijgewerkt: D.stempel(), uitCache: false };
  _cache = { t: Date.now() + 10 * 60000, v: result };
  return result;
});
exports._test = { bouwKandidaten, kiesContract, loonIndex, zoekLoon };
