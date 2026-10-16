// ============================================================
// Vastloners: maandmutaties salaris (port van Vastloners.gs v30.0)
// Per maand per vastloner (store managers): vakantie, ziekte (+ wachtdag),
// overige verlofsoorten met loonconsequentie, 4-wekenregel als tweede paar ogen.
// Bron: Shiftbase users/contracts (via shiftbase.js), absentees, absentee_options.
// ============================================================
const SB = require('./shiftbase');
const C = require('./config');
const D = require('./datum');
const { normNaam } = require('./util');

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dagenTussen = (a, b) => Math.round((b - a) / 864e5);
function parseDatum(s) {
  if (!s) return null;
  const t = String(s);
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const bevat = (tekst, woorden) => { const t = String(tekst || '').toLowerCase(); return !!t && woorden.some(w => t.indexOf(w) > -1); };
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// Wie telt als vastloner: functie-trefwoord OF handmatige namenlijst OF e-mail in EXTRA; UITSLUITEN wint
function bepaalVastloners(med) {
  const namen = new Set(C.VASTLONER_NAMEN.map(normNaam));
  return (med || []).filter(m => {
    const email = String(m.email || '').toLowerCase();
    let vast = bevat(m.functie, C.VASTLONER_TREFWOORDEN) || namen.has(normNaam(m.naam)) || (email && C.VASTLONER_EXTRA.indexOf(email) > -1);
    if (email && C.VASTLONER_UITSLUITEN.indexOf(email) > -1) vast = false;
    return vast;
  }).map(m => ({ id: m.id, naam: m.naam, email: m.email || '', functie: m.functie || 'Onbekend', type: m.contractType || '', locatie: m.winkelNaam || '-' }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}
// Verloftypes: vaste map op id, aangevuld met namen uit Shiftbase (onbekende id's → trefwoordherkenning)
async function verlofTypes() {
  const map = {};
  for (const id of Object.keys(C.VL_TYPE_MAP)) map[id] = Object.assign({}, C.VL_TYPE_MAP[id]);
  try {
    const lijst = await SB.sbGet('absentee_options');
    for (const o0 of lijst || []) {
      const o = (o0 && o0.AbsenteeOption) || o0 || {}; const id = String(o.id || ''); if (!id) continue;
      const naam = String(o.option || o.name || o.title || o.description || ('optie ' + id));
      if (map[id]) { if (!map[id].naam) map[id].naam = naam; continue; }
      const cat = bevat(naam, C.VL_ZIEKTE_WOORDEN) ? 'ziekte' : bevat(naam, C.VL_VERLOF_WOORDEN) ? 'vakantie' : 'onbekend';
      map[id] = { naam, cat, loon: cat === 'onbekend' ? 'ONBEKEND type - handmatig beoordelen' : '' , onbekend: cat === 'onbekend' };
    }
  } catch (e) { console.warn('absentee_options:', e.message); }
  return map;
}
// Pure rekenfunctie (testbaar): maandoverzicht
function berekenMaand(vastloners, absLijst, typeMap, jaar, maand) {
  const start = new Date(jaar, maand - 1, 1), eind = new Date(jaar, maand, 0);
  const perId = {};
  vastloners.forEach(v => { perId[v.id] = { naam: v.naam, email: v.email, functie: v.functie, locatie: v.locatie, verlofDagen: 0, verlofUren: 0, ziekDagen: 0, ziekUren: 0, verlofRegels: [], ziekteperiodes: [], overig: [], wachtdagen: [] }; });
  const waarschuwingen = [], ziekRuw = {};
  for (const a0 of absLijst || []) {
    const a = (a0 && a0.Absentee) || a0 || {};
    const uid = String(a.user_id || ''); if (!uid || !perId[uid]) continue;
    if (a.deleted === true || String(a.deleted) === '1') continue;
    const status = String(a.status || ''), sl = status.toLowerCase();
    if (sl.indexOf('declin') > -1 || sl.indexOf('reject') > -1) continue;
    const aStart = parseDatum(a.startdate); if (!aStart) continue;
    const aEind = parseDatum(a.enddate) || aStart;
    const loopt = !a.enddate || a.open_ended === true;
    const optieId = String(a.absentee_option_id || '');
    const type = typeMap[optieId] || { naam: 'optie ' + optieId, cat: 'onbekend', loon: 'ONBEKEND type - handmatig beoordelen', onbekend: true };
    const isZiek = type.cat === 'ziekte', isVerlof = type.cat === 'vakantie';
    const waitDagen = Number(a.wait_days) || 0, waitUren = Number(a.wait_hours) || 0;
    if (isZiek) (ziekRuw[uid] = ziekRuw[uid] || []).push({ start: aStart, eind: aEind, waitDagen });
    if (type.cat === 'negeren') continue;
    const oStart = aStart > start ? aStart : start, oEind = aEind < eind ? aEind : eind;
    if (oEind < oStart) continue;
    const dagenTotaal = dagenTussen(aStart, aEind) + 1, dagenInMaand = dagenTussen(oStart, oEind) + 1;
    const hpd = Number(a.hours_per_day) || 0, urenTotaal = Number(a.hours) || 0;
    const urenInMaand = hpd ? Math.round(hpd * dagenInMaand * 100) / 100 : (urenTotaal ? Math.round(urenTotaal * dagenInMaand / dagenTotaal * 100) / 100 : 0);
    const p = perId[uid];
    const regel = { type: type.naam, loon: type.loon || '', start: D.kort(aStart), eind: loopt ? 'loopt nog' : D.kort(aEind), dagen: dagenInMaand, uren: urenInMaand, deelDag: a.partial_day === true, status };
    if (sl.indexOf('pend') > -1 || sl.indexOf('open') > -1) waarschuwingen.push(p.naam + ': "' + type.naam + '" (' + regel.start + ') is nog niet goedgekeurd in Shiftbase.');
    if (isZiek) {
      p.ziekDagen += dagenInMaand; p.ziekUren += urenInMaand; p.ziekteperiodes.push(regel);
      if (loopt) waarschuwingen.push(p.naam + ': ziekmelding van ' + regel.start + ' is nog niet hersteld gemeld.');
      if (waitDagen > 0 && aStart >= start && aStart <= eind) p.wachtdagen.push({ datum: D.kort(aStart), dagen: waitDagen, uren: waitUren });
    } else if (isVerlof) { p.verlofDagen += dagenInMaand; p.verlofUren += urenInMaand; p.verlofRegels.push(regel); }
    else { p.overig.push(regel); if (type.onbekend) waarschuwingen.push(p.naam + ': type "' + type.naam + '" is niet ingedeeld (nieuw in Shiftbase?) - controleer handmatig en vul VL_TYPE_MAP aan.'); }
  }
  // 4-wekenregel (art. 7:629 lid 10 BW) als controle op de wachtdag die Shiftbase rekende
  for (const uid of Object.keys(ziekRuw)) {
    const perioden = ziekRuw[uid].sort((x, y) => x.start - y.start); let vorigeEind = null;
    for (const pr of perioden) {
      const nieuwGeval = !(vorigeEind && (dagenTussen(vorigeEind, pr.start) - 1) < C.VL_SAMENTEL_DAGEN);
      if (pr.start >= start && pr.start <= eind) {
        if (!nieuwGeval && pr.waitDagen > 0) waarschuwingen.push(perId[uid].naam + ': Shiftbase rekent een wachtdag op ' + D.kort(pr.start) + ', maar deze ziekmelding volgt binnen 4 weken op een eerdere - mogelijk hetzelfde ziektegeval, dus mogelijk onterecht.');
        if (nieuwGeval && pr.waitDagen === 0) waarschuwingen.push(perId[uid].naam + ': ziekmelding ' + D.kort(pr.start) + ' lijkt een nieuw ziektegeval, maar Shiftbase registreerde geen wachtdag - controleer dit.');
      }
      if (!vorigeEind || pr.eind > vorigeEind) vorigeEind = pr.eind;
    }
  }
  const tot = { verlofDagen: 0, verlofUren: 0, ziekDagen: 0, ziekUren: 0, wachtdagen: 0, metMutatie: 0 };
  const regels = vastloners.map(v => {
    const r = perId[v.id]; r.verlofUren = Math.round(r.verlofUren * 100) / 100; r.ziekUren = Math.round(r.ziekUren * 100) / 100;
    r.heeftMutatie = (r.verlofDagen + r.ziekDagen + r.overig.length) > 0;
    tot.verlofDagen += r.verlofDagen; tot.verlofUren += r.verlofUren; tot.ziekDagen += r.ziekDagen; tot.ziekUren += r.ziekUren; tot.wachtdagen += r.wachtdagen.length; if (r.heeftMutatie) tot.metMutatie++;
    return r;
  });
  tot.verlofUren = Math.round(tot.verlofUren * 100) / 100; tot.ziekUren = Math.round(tot.ziekUren * 100) / 100;
  return { periode: { jaar, maand, label: MAANDEN[maand - 1] + ' ' + jaar, start: D.kort(start), eind: D.kort(eind) }, aantalVastloners: vastloners.length, totalen: tot, regels, waarschuwingen };
}
async function getVastlonerMaand(jaar, maand) {
  jaar = Number(jaar); maand = Number(maand);
  if (!jaar || !maand || maand < 1 || maand > 12) throw new Error('Ongeldige maand.');
  const med = await SB.getMedewerkers(false);
  const vastloners = bepaalVastloners(med);
  if (!vastloners.length) throw new Error('Geen vastloners herkend. Controleer VASTLONER_TREFWOORDEN/VASTLONER_NAMEN in config.js.');
  const start = new Date(jaar, maand - 1, 1), eind = new Date(jaar, maand, 0), terug = plusDagen(start, -C.VL_TERUGKIJK_DAGEN);
  const [typeMap, abs] = await Promise.all([verlofTypes(), SB.sbGet('absentees?min_date=' + iso(terug) + '&max_date=' + iso(eind))]);
  const r = berekenMaand(vastloners, abs || [], typeMap, jaar, maand);
  r.vastloners = vastloners; r.typeMap = typeMap; r.opgehaald = D.stempel();
  return r;
}
module.exports = { bepaalVastloners, berekenMaand, verlofTypes, getVastlonerMaand };
