// ============================================================
// v0.46.0 Fooiverdeling per maand.
// 1. Fooi per pot (uit de mail van Jop): één pot per BV. Ceintuur BV (Ceintuurbaan + Westerstraat)
//    en Midden BV (Middenweg + Haarlemmerdijk) delen één pot over twee winkels.
// 2. Een gedeelde pot gaat naar de winkels met de sleutel 50% urenaandeel + 50% omzetaandeel
//    (zelfde formule als het Excel-template "Fooi Verdeelsleutel (50% uren / 50% omzet)").
// 3. Binnen een winkel krijgt iedereen fooi naar rato van zijn geklokte uren in die winkel
//    (Shiftbase timesheets, alle functies, ook store managers — keuze Mischa 05-11-2026).
// Omzet = SLA-Supabase omzet_dag (netto ex btw, excl. fees — dezelfde definitie als het omzetdashboard),
// gelezen met OMZET_SUPABASE_URL + OMZET_SUPABASE_KEY (alleen server-side). Ontbreekt die koppeling,
// dan vult HR de omzet van de gedeelde winkels zelf in.
// Bedragen in centen afgerond met de grootste-rest-methode, zodat elke pot en elke winkel exact optelt.
// ============================================================
const { SB_DEPT_CODE, SB_UITGESLOTEN_NAMEN, WINKEL_BV_MAP } = require('./config');
const { normNaam } = require('./util');

const POTTEN = [
  { id: 'ceintuur', naam: 'Ceintuur BV', winkels: ['CB', 'WS'], herken: /ceintuur|westerstraat/i },
  { id: 'midden', naam: 'Midden BV', winkels: ['MW', 'HD'], herken: /middenweg|haarlemmerdijk/i },
  { id: 'AW', naam: 'Amstelveenseweg', winkels: ['AW'], herken: /amstelveen/i },
  { id: 'US', naam: 'Utrechtsestraat', winkels: ['US'], herken: /utrechtsestraat/i },
  { id: 'HC', naam: 'Hoog Catharijne', winkels: ['HC'], herken: /catharijne/i },
  { id: 'KP', naam: 'Den Haag (Kerkplein)', winkels: ['KP'], herken: /den\s*haag|kerkplein/i },
  { id: 'VS', naam: 'Utrecht (Voorstraat)', winkels: ['VS'], herken: /voorstraat/i },
  { id: 'AD', naam: 'Admiraal de Ruijterweg', winkels: ['AD'], herken: /admiraal/i },
  { id: 'ZA', naam: 'Zuidas', winkels: ['ZA'], herken: /zuidas/i }
];
// Regels uit de mail die niet in het HR-dashboard horen (franchise) of geen pot zijn
const NEGEER = /franchise|stoppels|groningen|amersfoort|\bhaarlem\b|totaal|^winkel\b/i;
// Vita Mojo-winkelnaam (omzet_dag.winkel) -> winkelcode
const OMZET_WINKEL = { 'Ceintuurbaan': 'CB', 'Westerstraat': 'WS', 'Middenweg': 'MW', 'Haarlemmerdijk': 'HD', 'Zuidas': 'ZA', 'Utrechtsestraat': 'US',
  'Amstelveenseweg': 'AW', 'Admiraal de Ruijterweg': 'AD', 'Voorstraat': 'VS', 'Hoog Catharijne': 'HC', 'Den Haag': 'KP' };
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const UITGESLOTEN = new Set(SB_UITGESLOTEN_NAMEN.map(normNaam));

const pad2 = n => String(n).padStart(2, '0');
const r2 = x => Math.round(x * 100) / 100;
const winkelNaam = c => (WINKEL_BV_MAP[c] && WINKEL_BV_MAP[c].naam) || c;

function periode(jaar, maand) {
  jaar = Number(jaar); maand = Number(maand);
  if (!(jaar >= 2024 && jaar <= 2100) || !(maand >= 1 && maand <= 12)) throw new Error('Kies een geldige maand.');
  const laatste = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  return { jaar, maand, label: MAANDEN[maand - 1] + ' ' + jaar, van: jaar + '-' + pad2(maand) + '-01', tot: jaar + '-' + pad2(maand) + '-' + pad2(laatste) };
}

// '1.142,05' / '1142.05' / '€ 1 142,05' / '7,145.89' -> 1142.05
function bedrag(s) {
  let t = String(s == null ? '' : s).replace(/[€\s ]/g, '');
  if (!t) return null;
  const k = t.lastIndexOf(','), p = t.lastIndexOf('.');
  if (k > -1 && p > -1) t = k > p ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (k > -1) t = t.split(',').length > 2 ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (p > -1 && (t.split('.').length > 2 || /^-?\d{1,3}\.\d{3}$/.test(t))) t = t.replace(/\./g, ''); // 1.142 = duizendtal
  const n = Number(t);
  return isFinite(n) ? n : null;
}

// Plaktekst (tabel uit de mail van Jop) -> { potten: {id: bedrag}, genegeerd: [regel], onbekend: [regel] }
function leesPlaktekst(tekst) {
  const potten = {}, genegeerd = [], onbekend = [];
  for (const ruw of String(tekst || '').split(/\r?\n/)) {
    const regel = ruw.replace(/\s+/g, ' ').trim(); if (!regel) continue;
    const m = regel.match(/€?\s?(\d[\d.,]*\d|\d)\s*$/);
    if (!m || !regel.slice(0, m.index).trim()) continue; // kopregel of losse getallen
    const naamDeel = regel.slice(0, m.index).trim();
    const pot = POTTEN.find(p => p.herken.test(naamDeel));
    if (!pot) { (NEGEER.test(naamDeel) ? genegeerd : onbekend).push(regel); continue; }
    const b = bedrag(m[1]); if (b == null) { onbekend.push(regel); continue; }
    potten[pot.id] = r2((potten[pot.id] || 0) + b);
  }
  return { potten, genegeerd, onbekend };
}

// Grootste-rest: verdeel 'totaalCent' over gewichten; som klopt exact.
function verdeelCenten(totaalCent, gewichten) {
  const som = gewichten.reduce((a, b) => a + b, 0);
  if (!(som > 0)) return gewichten.map(() => 0);
  const ruw = gewichten.map(w => totaalCent * w / som), basis = ruw.map(Math.floor);
  let rest = totaalCent - basis.reduce((a, b) => a + b, 0);
  ruw.map((x, i) => [x - basis[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (rest > 0) { basis[i]++; rest--; } });
  return basis;
}

// Timesheet-uren: 'total' (decimale uren excl. pauze) of zelf uitrekenen uit start/eind min pauze (minuten)
function urenVan(t) {
  const tot = Number(t.total);
  if (t.total != null && t.total !== '' && isFinite(tot)) return tot;
  const s = String(t.clocked_in || t.starttime || ''), e = String(t.clocked_out || t.endtime || '');
  const ms = x => { const m = x.match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const a = ms(s), b = ms(e); if (a == null || b == null) return 0;
  let min = b - a; if (min < 0) min += 1440;
  return Math.max(0, (min - (Number(t.break) || 0)) / 60);
}

// Shiftbase-timesheets -> { regels: [{userId, naam, code, uren}], openUren, openAantal, afgewezen }
function verwerkTimesheets(lijst, users, teams, van, tot) {
  const namen = {}, teamDept = {};
  for (const rec of users || []) {
    const u = (rec && rec.User) || rec || {};
    if (u.id != null) namen[String(u.id)] = ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim();
  }
  for (const rec of teams || []) { const t = (rec && rec.Team) || rec || {}; if (t.id != null) teamDept[String(t.id)] = String(t.department_id || ''); }
  const per = {}; let openUren = 0, openAantal = 0, afgewezen = 0;
  for (const rec of lijst || []) {
    const t = (rec && rec.Timesheet) || rec || {};
    const datum = String(t.date || '').slice(0, 10);
    if (!datum || datum < van || datum > tot) continue;
    if (t.deleted === true || t.deleted === '1' || t.deleted === 1) continue;
    const st = String(t.status || '').toLowerCase();
    if (/declin|reject|afgewez/.test(st)) { afgewezen++; continue; }
    const dept = String(t.department_id || teamDept[String(t.team_id || '')] || '');
    const code = SB_DEPT_CODE[dept]; if (!code) continue; // HQ, keuken, franchise: geen fooi
    const uid = String(t.user_id || ''); if (!uid) continue;
    const u = (rec && rec.User) || {};
    const naam = namen[uid] || ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || ('Medewerker #' + uid);
    if (UITGESLOTEN.has(normNaam(naam))) continue;
    const uren = urenVan(t); if (!(uren > 0)) continue;
    if (/pend|open|wacht/.test(st)) { openUren += uren; openAantal++; }
    const k = uid + '|' + code;
    (per[k] || (per[k] = { userId: uid, naam, code, uren: 0 })).uren += uren;
  }
  const regels = Object.values(per).map(x => Object.assign(x, { uren: r2(x.uren) }));
  return { regels, openUren: r2(openUren), openAantal, afgewezen };
}

// omzet_dag-rijen -> { code: netto }
function omzetPerCode(rijen) {
  const uit = {};
  for (const r of rijen || []) { const c = OMZET_WINKEL[String(r.winkel || '').trim()]; if (c) uit[c] = (uit[c] || 0) + (Number(r.netto) || 0); }
  for (const c in uit) uit[c] = r2(uit[c]);
  return uit;
}

// Kern (puur, getest): potten {id: bedrag}, regels [{userId,naam,code,uren}], omzet {code: netto}, handmatig {code: netto}
function bereken({ potten, regels, omzet, handmatig }) {
  potten = potten || {}; regels = regels || []; omzet = omzet || {}; handmatig = handmatig || {};
  const waarschuwingen = [], perCode = {};
  for (const r of regels) (perCode[r.code] || (perCode[r.code] = [])).push(r);
  const uit = [];
  let totaalCent = 0, verdeeldCent = 0;
  for (const p of POTTEN) {
    const bedragP = Number(potten[p.id]) || 0, cent = Math.round(bedragP * 100);
    const winkels = p.winkels.map(c => {
      const mw = (perCode[c] || []).slice().sort((a, b) => b.uren - a.uren || a.naam.localeCompare(b.naam, 'nl'));
      const h = handmatig[c] != null && handmatig[c] !== '' ? bedrag(handmatig[c]) : null;
      return { code: c, naam: winkelNaam(c), bv: (WINKEL_BV_MAP[c] || {}).bv || '', uren: r2(mw.reduce((a, b) => a + b.uren, 0)), omzet: h != null ? h : (omzet[c] != null ? omzet[c] : null), omzetBron: h != null ? 'handmatig' : (omzet[c] != null ? 'omzetdashboard' : ''), mw };
    });
    const pot = { id: p.id, naam: p.naam, bedrag: r2(bedragP), gedeeld: p.winkels.length > 1, status: 'ok', melding: '', winkels: [] };
    totaalCent += cent;
    const urenTot = winkels.reduce((a, w) => a + w.uren, 0), omzetTot = winkels.reduce((a, w) => a + (w.omzet || 0), 0);
    let sleutels;
    if (!pot.gedeeld) sleutels = [1];
    else if (winkels.some(w => w.omzet == null)) {
      sleutels = null; pot.status = 'omzet'; pot.melding = 'Omzet ontbreekt voor ' + winkels.filter(w => w.omzet == null).map(w => w.naam).join(' en ') + ' — vul die in om deze pot te verdelen.';
    } else if (!(urenTot > 0) || !(omzetTot > 0)) {
      sleutels = null; pot.status = 'leeg'; pot.melding = 'Geen uren of omzet gevonden in deze maand.';
    } else sleutels = winkels.map(w => (w.uren / urenTot + w.omzet / omzetTot) / 2);
    const winkelCent = sleutels ? verdeelCenten(cent, sleutels) : winkels.map(() => null);
    winkels.forEach((w, i) => {
      const fc = winkelCent[i];
      const rij = { code: w.code, naam: w.naam, bv: w.bv, uren: w.uren, omzet: w.omzet, omzetBron: w.omzetBron,
        urenAandeel: pot.gedeeld && urenTot > 0 ? w.uren / urenTot : null, omzetAandeel: pot.gedeeld && omzetTot > 0 && w.omzet != null ? w.omzet / omzetTot : null,
        sleutel: sleutels ? sleutels[i] : null, fooi: fc == null ? null : fc / 100, perUur: fc != null && w.uren > 0 ? r2(fc / 100 / w.uren) : null, medewerkers: [] };
      if (fc != null && fc > 0 && !(w.uren > 0)) { waarschuwingen.push(w.naam + ': er is € ' + (fc / 100).toFixed(2).replace('.', ',') + ' fooi, maar geen geklokte uren — dit bedrag wordt niet verdeeld.'); }
      else if (fc != null) {
        const mc = verdeelCenten(fc, w.mw.map(m => m.uren));
        rij.medewerkers = w.mw.map((m, j) => ({ userId: m.userId, naam: m.naam, uren: m.uren, aandeel: w.uren > 0 ? m.uren / w.uren : 0, fooi: mc[j] / 100 }));
        verdeeldCent += mc.reduce((a, b) => a + b, 0);
      }
      pot.winkels.push(rij);
    });
    if (!(bedragP > 0) && winkels.some(w => w.uren > 0)) { pot.status = pot.status === 'ok' ? 'geenfooi' : pot.status; }
    if (pot.status === 'omzet' && bedragP > 0) waarschuwingen.push(p.naam + ': ' + pot.melding);
    uit.push(pot);
  }
  // Per medewerker (iemand kan in twee winkels gewerkt hebben)
  const perMw = {};
  for (const pot of uit) for (const w of pot.winkels) for (const m of w.medewerkers) {
    const x = perMw[m.userId] || (perMw[m.userId] = { userId: m.userId, naam: m.naam, uren: 0, fooiCent: 0, delen: [] });
    x.uren += m.uren; x.fooiCent += Math.round(m.fooi * 100); x.delen.push({ code: w.code, winkel: w.naam, bv: w.bv, uren: m.uren, fooi: m.fooi });
  }
  const medewerkers = Object.values(perMw).map(x => ({ userId: x.userId, naam: x.naam, uren: r2(x.uren), fooi: x.fooiCent / 100, delen: x.delen }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const meerdere = medewerkers.filter(m => m.delen.length > 1).length;
  return { potten: uit, medewerkers, totaal: { fooi: totaalCent / 100, verdeeld: verdeeldCent / 100, nietVerdeeld: (totaalCent - verdeeldCent) / 100, medewerkers: medewerkers.length, uren: r2(regels.reduce((a, b) => a + b.uren, 0)), meerdereWinkels: meerdere }, waarschuwingen };
}

// ---------- Bronnen ----------
async function laadOmzet(van, tot) {
  const url = process.env.OMZET_SUPABASE_URL, key = process.env.OMZET_SUPABASE_KEY;
  if (!url || !key) return { omzet: {}, bron: 'ontbreekt', melding: 'Omzetkoppeling (OMZET_SUPABASE_URL / OMZET_SUPABASE_KEY) is nog niet ingesteld in Netlify — vul de omzet van de gedeelde winkels zelf in.' };
  const rijen = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/omzet_dag?select=winkel,netto&datum=gte.' + van + '&datum=lte.' + tot + '&order=datum.asc,winkel.asc,kanaal.asc&limit=1000&offset=' + offset,
      { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } });
    if (!r.ok) return { omzet: {}, bron: 'fout', melding: 'Omzet ophalen mislukt (HTTP ' + r.status + ') — vul de omzet van de gedeelde winkels zelf in.' };
    const deel = await r.json(); rijen.push(...deel);
    if (deel.length < 1000) break;
  }
  return { omzet: omzetPerCode(rijen), bron: 'omzetdashboard', melding: '' };
}

const _cache = {};
async function laadUren(van, tot, ververs) {
  const k = van + '|' + tot;
  if (!ververs && _cache[k] && _cache[k].t > Date.now()) return _cache[k].v;
  const SB = require('./shiftbase');
  const [ts, users, teams] = await Promise.all([
    SB.sbGet('timesheets?min_date=' + van + '&max_date=' + tot),
    SB.sbGet('users').catch(e => { console.warn('fooi users:', e.message); return []; }),
    SB.sbGet('teams').catch(e => { console.warn('fooi teams:', e.message); return []; })
  ]);
  const v = verwerkTimesheets((ts && ts.data) || ts || [], users, teams, van, tot);
  _cache[k] = { t: Date.now() + 10 * 60000, v };
  return v;
}

// ---------- Opslag (migratie 0024: hr_fooi) ----------
async function laadRonde(jaar, maand) {
  const { admin } = require('./auth');
  const { data, error } = await admin().from('hr_fooi').select('*').eq('jaar', jaar).eq('maand', maand).maybeSingle();
  if (error) { if (/hr_fooi/.test(error.message)) return { ontbreekt: true }; throw new Error('hr_fooi: ' + error.message); }
  return data || null;
}

async function maakOverzicht(jaar, maand, potten, handmatig, ververs) {
  const p = periode(jaar, maand);
  const [om, ur] = await Promise.all([laadOmzet(p.van, p.tot), laadUren(p.van, p.tot, ververs)]);
  const r = bereken({ potten, regels: ur.regels, omzet: om.omzet, handmatig });
  if (om.melding) r.waarschuwingen.unshift(om.melding);
  if (ur.openAantal) r.waarschuwingen.push(ur.openAantal + ' timesheet(s) met ' + String(ur.openUren).replace('.', ',') + ' uur zijn nog niet goedgekeurd in Shiftbase; ze tellen wel mee. Keur ze eerst goed (of af) voor je de verdeling vastlegt.');
  r.periode = p; r.invoer = { potten: potten || {}, handmatig: handmatig || {} };
  r.bronnen = { omzet: om.bron, uren: 'Shiftbase timesheets (geklokt, excl. pauze)', opgehaald: require('./datum').stempel() };
  r.pottenConfig = POTTEN.map(x => ({ id: x.id, naam: x.naam, winkels: x.winkels.map(winkelNaam) }));
  return r;
}

// GET: vastgelegde ronde (definitief = bevroren momentopname) of live berekening met de laatst bewaarde invoer
async function getFooi(jaar, maand, ververs) {
  const p = periode(jaar, maand);
  const rd = await laadRonde(p.jaar, p.maand);
  if (rd && rd.status === 'definitief' && rd.resultaat) return Object.assign({}, rd.resultaat, { opslag: { status: rd.status, door: rd.opgeslagen_door, op: rd.opgeslagen_op } });
  const r = await maakOverzicht(p.jaar, p.maand, rd && rd.potten, rd && rd.omzet_handmatig, ververs);
  r.opslag = rd && rd.ontbreekt ? { ontbreekt: true } : rd ? { status: rd.status, door: rd.opgeslagen_door, op: rd.opgeslagen_op } : null;
  return r;
}

function schoonPotten(potten) {
  const uit = {};
  for (const p of POTTEN) { const b = bedrag(potten && potten[p.id]); if (b != null && b >= 0) uit[p.id] = r2(b); }
  return uit;
}
function schoonHandmatig(h) {
  const uit = {};
  for (const c of ['CB', 'WS', 'MW', 'HD']) { const b = bedrag(h && h[c]); if (b != null && b > 0) uit[c] = r2(b); }
  return uit;
}

async function opslaan(jaar, maand, potten, handmatig, definitief, gebruiker) {
  const p = periode(jaar, maand);
  const rd = await laadRonde(p.jaar, p.maand);
  if (rd && rd.ontbreekt) throw new Error('Tabel hr_fooi bestaat nog niet: voer eerst migratie 0024_fooi.sql uit in de Supabase SQL Editor.');
  if (rd && rd.status === 'definitief') throw new Error('Deze maand is al definitief vastgelegd. Heropen hem eerst.');
  potten = schoonPotten(potten); handmatig = schoonHandmatig(handmatig);
  const r = await maakOverzicht(p.jaar, p.maand, potten, handmatig, !!definitief);
  if (definitief) {
    const fout = r.potten.find(x => x.bedrag > 0 && x.status !== 'ok' && x.status !== 'geenfooi');
    if (fout) throw new Error(fout.naam + ': ' + fout.melding);
    if (r.totaal.nietVerdeeld > 0.004) throw new Error('Er blijft € ' + r.totaal.nietVerdeeld.toFixed(2).replace('.', ',') + ' onverdeeld (winkel met fooi maar zonder uren). Los dat eerst op.');
  }
  const status = definitief ? 'definitief' : 'concept', nu = new Date().toISOString();
  r.opslag = { status, door: gebruiker.naam || gebruiker.email, op: nu };
  const { admin, logActie } = require('./auth');
  const { error } = await admin().from('hr_fooi').upsert({ jaar: p.jaar, maand: p.maand, potten, omzet_handmatig: handmatig, resultaat: definitief ? r : null,
    status, opgeslagen_door: gebruiker.naam || gebruiker.email, opgeslagen_op: nu }, { onConflict: 'jaar,maand' });
  if (error) throw new Error('Opslaan mislukt: ' + error.message);
  await logActie({ door: gebruiker.email, actie: definitief ? 'fooi-definitief' : 'fooi-concept', bron: 'fooi', naam: p.label, details: 'totaal € ' + r.totaal.fooi.toFixed(2) + ' · ' + r.totaal.medewerkers + ' medewerkers' });
  return r;
}

async function heropen(jaar, maand, gebruiker) {
  const p = periode(jaar, maand);
  const { admin, logActie } = require('./auth');
  const { error } = await admin().from('hr_fooi').update({ status: 'concept', resultaat: null, opgeslagen_door: gebruiker.naam || gebruiker.email, opgeslagen_op: new Date().toISOString() }).eq('jaar', p.jaar).eq('maand', p.maand);
  if (error) throw new Error('Heropenen mislukt: ' + error.message);
  await logActie({ door: gebruiker.email, actie: 'fooi-heropend', bron: 'fooi', naam: p.label, details: '' });
  return getFooi(p.jaar, p.maand, true);
}

module.exports = { POTTEN, OMZET_WINKEL, periode, bedrag, leesPlaktekst, verdeelCenten, urenVan, verwerkTimesheets, omzetPerCode, bereken, getFooi, opslaan, heropen, schoonPotten, schoonHandmatig, maakOverzicht };
