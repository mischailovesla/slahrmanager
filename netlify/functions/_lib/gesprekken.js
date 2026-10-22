// ============================================================
// Fase 3b: gesprekken vastleggen (tabel hr_gesprekken, migratie 0012).
// - opslaan(g, wie, opties): nieuw of bewerken; opties.checkinId zet die check-in op opgevolgd, opties.vervolgVan rondt het vervolg van een eerder gesprek af
// - vervolgAf(id, notitie, wie): vervolg afvinken zonder nieuw gesprek
// - voorPersoon({ mid, naam }) / lijst({ dagen, soort, winkel }) / openVervolgen()
// Gesprekken worden niet verwijderd (dossier); bewerken wordt gelogd door het endpoint.
// ============================================================
const C = require('./config');
const { admin } = require('./auth');
const { normNaam } = require('./util');

const SOORT_KEYS = C.GESPREK_SOORTEN.map(s => s.key);
const label = k => (C.GESPREK_SOORTEN.find(s => s.key === k) || {}).label || k;
const vandaagIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const kort = (s, n) => String(s || '').trim().slice(0, n);

// Verzuim: { duur, werk, arts, contact } (labels uit config.VERZUIM_VELDEN) -> 'Verwachte duur: … · Werken mogelijk?: …'
function verzuimSamenvatting(v) {
  v = v || {};
  const delen = [];
  for (const f of C.VERZUIM_VELDEN) {
    const w = String(v[f.key] || '');
    if (!w) continue;
    if (!f.opties.includes(w)) throw new Error('Ongeldige keuze bij ' + f.label + '.');
    delen.push(f.label + ': ' + w);
  }
  if (!delen.length) throw new Error('Kies bij een verzuimgesprek minimaal de verwachte duur of of werken mogelijk is.');
  return delen.join(' · ');
}
function valideer(g) {
  const naam = kort(g.naam, 200); if (!naam) throw new Error('Kies of vul de medewerker in.');
  const soort = SOORT_KEYS.includes(g.soort) ? g.soort : null; if (!soort) throw new Error('Kies het soort gesprek.');
  const datum = isIso(g.datum) ? g.datum : null; if (!datum) throw new Error('Vul de datum van het gesprek in.');
  if (datum > vandaagIso()) throw new Error('De gespreksdatum ligt in de toekomst. Plan een gesprek als vervolgdatum bij een eerder gesprek, of vul de datum in waarop het gesprek is gevoerd.');
  const aanleiding = kort(g.aanleiding, 4000), afspraken = kort(g.afspraken, 4000); let besproken = kort(g.besproken, 8000);
  // v0.27.0: verzuim = vaste keuzes i.p.v. vrije tekst; nergens medische woorden (AVG art. 9)
  if (soort === 'verzuim') besproken = verzuimSamenvatting(g.verzuim);
  require('./medisch').controleer([aanleiding, besproken, afspraken]);
  if (!aanleiding && !besproken && !afspraken) throw new Error('Vul minimaal de aanleiding, wat er besproken is of de afspraken in.');
  let vervolg = g.vervolg_datum ? String(g.vervolg_datum) : null;
  if (vervolg && !isIso(vervolg)) throw new Error('Ongeldige vervolgdatum.');
  if (vervolg && vervolg < datum) throw new Error('De vervolgdatum ligt vóór de gespreksdatum.');
  return { medewerker_id: g.medewerker_id ? String(g.medewerker_id) : null, naam, email: kort(g.email, 200).toLowerCase(), winkel: kort(g.winkel, 100), soort, datum,
    kanaal: C.GESPREK_KANALEN.includes(g.kanaal) ? g.kanaal : '', gevoerd_door: kort(g.gevoerd_door, 200), aanleiding, besproken, afspraken, vervolg_datum: vervolg || null };
}

async function opslaan(g, wie, opties) {
  opties = opties || {};
  const rij = valideer(g), db = admin(), nu = new Date().toISOString();
  if (!rij.gevoerd_door) rij.gevoerd_door = wie;
  let id = g.id || null;
  if (id) {
    const { data: oud, error: e0 } = await db.from('hr_gesprekken').select('id,vervolg_datum,vervolg_afgerond_op').eq('id', id).limit(1);
    if (e0) throw new Error(e0.message);
    if (!oud || !oud.length) throw new Error('Gesprek niet gevonden.');
    // nieuwe vervolgdatum → vervolg weer open
    const upd = Object.assign({}, rij, { bijgewerkt_op: nu, bijgewerkt_door: wie });
    if (oud[0].vervolg_afgerond_op && rij.vervolg_datum && rij.vervolg_datum !== oud[0].vervolg_datum) Object.assign(upd, { vervolg_afgerond_op: null, vervolg_afgerond_door: '', vervolg_notitie: '' });
    const { error } = await db.from('hr_gesprekken').update(upd).eq('id', id);
    if (error) throw new Error('Opslaan mislukt: ' + error.message);
  } else {
    const bron = opties.checkinId ? 'checkin:' + opties.checkinId : opties.vervolgVan ? 'vervolg:' + opties.vervolgVan : '';
    const { data, error } = await db.from('hr_gesprekken').insert(Object.assign({}, rij, { bron_ref: bron, aangemaakt_door: wie })).select('id');
    if (error) throw new Error('Opslaan mislukt: ' + error.message + ' (migratie 0012 gedraaid?)');
    id = data[0].id;
  }
  const samenvatting = label(rij.soort) + ' ' + rij.datum.split('-').reverse().join('-') + (rij.afspraken ? ': ' + rij.afspraken : rij.besproken ? ': ' + rij.besproken : '');
  if (opties.checkinId) {
    const { error } = await db.from('hr_checkin').update({ opgevolgd_op: nu, opgevolgd_door: wie, opvolg_notitie: kort(samenvatting, 1000) }).eq('id', opties.checkinId);
    if (error) throw new Error('Gesprek opgeslagen, maar check-in niet afgevinkt: ' + error.message);
  }
  if (opties.vervolgVan) {
    const { error } = await db.from('hr_gesprekken').update({ vervolg_afgerond_op: nu, vervolg_afgerond_door: wie, vervolg_notitie: kort('Vervolggesprek ' + rij.datum.split('-').reverse().join('-'), 1000) }).eq('id', opties.vervolgVan);
    if (error) throw new Error('Gesprek opgeslagen, maar vorig vervolg niet afgerond: ' + error.message);
  }
  return { id, rij };
}

async function vervolgAf(id, notitie, wie) {
  if (!id) throw new Error('Geen gesprek opgegeven.');
  const { data, error } = await admin().from('hr_gesprekken').update({ vervolg_afgerond_op: new Date().toISOString(), vervolg_afgerond_door: wie, vervolg_notitie: kort(notitie, 1000) }).eq('id', id).select('naam,soort');
  if (error) throw new Error(error.message);
  return (data || [])[0] || {};
}

const fmtNL = s => s ? String(s).slice(0, 10).split('-').reverse().join('-') : '';
function toon(r) {
  const vandaag = vandaagIso(), open = !!(r.vervolg_datum && !r.vervolg_afgerond_op);
  return { id: r.id, medewerker_id: r.medewerker_id, naam: r.naam, email: r.email, winkel: r.winkel, soort: r.soort, soortLabel: label(r.soort), datum: r.datum, datumNL: fmtNL(r.datum), kanaal: r.kanaal, gevoerdDoor: r.gevoerd_door,
    aanleiding: r.aanleiding, besproken: r.besproken, afspraken: r.afspraken, vervolgDatum: r.vervolg_datum || '', vervolgNL: fmtNL(r.vervolg_datum), vervolgOpen: open, vervolgTeLaat: open && r.vervolg_datum < vandaag,
    vervolgAfgerond: fmtNL(r.vervolg_afgerond_op), vervolgAfgerondDoor: r.vervolg_afgerond_door, vervolgNotitie: r.vervolg_notitie, bron: r.bron_ref,
    aangemaakt: fmtNL(r.aangemaakt_op), aangemaaktDoor: r.aangemaakt_door, bijgewerkt: fmtNL(r.bijgewerkt_op), bijgewerktDoor: r.bijgewerkt_door };
}
async function voorPersoon(q) {
  const { data, error } = await admin().from('hr_gesprekken').select('*').order('datum', { ascending: false }).limit(3000);
  if (error) throw new Error(error.message + ' (migratie 0012 gedraaid?)');
  const nn = normNaam(q.naam || '');
  return (data || []).filter(r => (q.mid && r.medewerker_id && String(r.medewerker_id) === String(q.mid)) || (nn && normNaam(r.naam) === nn)).map(toon);
}
async function lijst(q) {
  const dagen = Math.min(Math.max(parseInt(q.dagen, 10) || 90, 7), 730);
  const van = new Date(Date.now() - dagen * 864e5).toLocaleDateString('sv-SE');
  const { data, error } = await admin().from('hr_gesprekken').select('*').gte('datum', van).order('datum', { ascending: false }).limit(3000);
  if (error) throw new Error(error.message + ' (migratie 0012 gedraaid?)');
  return (data || []).map(toon);
}
async function openVervolgen() {
  const { data, error } = await admin().from('hr_gesprekken').select('*').not('vervolg_datum', 'is', null).is('vervolg_afgerond_op', null).order('vervolg_datum', { ascending: true }).limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(toon);
}
module.exports = { SOORT_KEYS, label, valideer, verzuimSamenvatting, opslaan, vervolgAf, voorPersoon, lijst, openVervolgen, toon };
