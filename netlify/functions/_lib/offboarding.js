// ============================================================
// v0.27.3: offboarding-checklist automatisch
//   start(p, door)              bij een ontslagbevestiging / aanzegging: checklist starten (niet dubbel)
//   vink(p, key, door, opm)     punt automatisch afvinken (alleen als het nog open staat; handmatig blijft leidend)
//   syncShiftbase(rijen, med)   'laatstedag' afvinken zodra de uitdienstdatum in Shiftbase gelijk is aan de einddatum
// p = { naam, email, medewerker_id|mid, winkel }. Fouten worden gelogd, nooit gegooid (mag het versturen niet blokkeren).
// ============================================================
const C = require('./config');
const { normNaam } = require('./util');
const SYSTEEM = 'systeem (automatisch)';
const stempel = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 16);
const db = () => require('./auth').admin();

function zelfde(c, p) {
  const mid = String(p.medewerker_id || p.mid || ''), em = String(p.email || '').trim().toLowerCase();
  return (mid && String(c.medewerker_id || '') === mid) || (em && String(c.email || '').toLowerCase() === em) || normNaam(c.naam) === normNaam(p.naam);
}
async function openLijsten() {
  const { data, error } = await db().from('hr_checklists').select('*').eq('type', 'offboarding').is('afgerond_op', null).limit(500);
  if (error) throw new Error(error.message);
  return data || [];
}

async function start(p, door) {
  try {
    if (!p || !String(p.naam || '').trim()) return null;
    const open = await openLijsten(), bestaand = open.find(c => zelfde(c, p));
    if (bestaand) return bestaand.id;
    const rec = { type: 'offboarding', naam: String(p.naam).trim(), email: String(p.email || ''), winkel: String(p.winkel || ''), medewerker_id: String(p.medewerker_id || p.mid || '') || null,
      items: C.CHECKLIST_OFFBOARDING.map(i => ({ key: i.key, label: i.label, klaar: false })), gestart_door: door || SYSTEEM, gestart_op: new Date().toISOString() };
    const { data, error } = await db().from('hr_checklists').insert(rec).select('id').single(); if (error) throw new Error(error.message);
    await require('./auth').logActie({ door: door || SYSTEEM, actie: 'checklist-start', bron: 'offboarding', naam: rec.naam, details: 'automatisch bij het versturen van de brief' });
    return data.id;
  } catch (e) { console.warn('offboarding start:', e.message); return null; }
}

async function vink(p, key, door, opmerking, lijsten) {
  try {
    const open = lijsten || await openLijsten(), c = open.find(x => zelfde(x, p)); if (!c) return false;
    const it = (c.items || []).find(i => i.key === key); if (!it || it.klaar) return false;
    const items = c.items.map(i => i.key === key ? Object.assign({}, i, { klaar: true, door: door || SYSTEEM, op: stempel(), opmerking: opmerking || i.opmerking || '' }) : i);
    // automatisch afvinken rondt de lijst niet af: de laatste handeling blijft bij HR
    const { error } = await db().from('hr_checklists').update({ items }).eq('id', c.id); if (error) throw new Error(error.message);
    c.items = items;
    await require('./auth').logActie({ door: door || SYSTEEM, actie: 'checklist-vink', bron: 'offboarding', veld: key, naam: c.naam, nieuw: 'klaar', details: opmerking || 'automatisch' });
    return true;
  } catch (e) { console.warn('offboarding vink:', e.message); return false; }
}

// rijen = getOntslag(), med = verloop.laadMedewerkers (met eind)
async function syncShiftbase(rijen, med) {
  let n = 0;
  try {
    // lopende dossiers zonder checklist (van vóór v0.27.3, of brief buiten het dashboard om): alsnog starten
    const { data: recent } = await db().from('hr_checklists').select('naam,email,medewerker_id,gestart_op').eq('type', 'offboarding').gte('gestart_op', new Date(Date.now() - 120 * 864e5).toISOString()).limit(1000);
    const vandaagIso = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
    const isoE = s => { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    for (const r of rijen || []) {
      if (!/^(Verzonden|Verstuurd)/.test(String(r.status || '')) || r.mahdia === 'Ja' || r.gearchiveerd) continue;
      const e = isoE(r.einddatum); if (!e || e < vandaagIso) continue;   // alleen wie nog moet vertrekken
      const p = { naam: r.naam, email: r.email, mid: r.mid };
      if ((recent || []).some(c => zelfde(c, p))) continue;
      const m = (r.mid && (med || []).find(x => String(x.id) === String(r.mid))) || null;
      if (await start({ naam: r.naam, email: r.email, medewerker_id: r.mid || '', winkel: m ? m.winkel : '' }, SYSTEEM)) { (recent || []).push({ naam: r.naam, email: r.email, medewerker_id: r.mid }); n++; }
    }
    const open = await openLijsten(); if (!open.length) return n;
    const perId = {}, perNaam = {}; (med || []).forEach(m => { perId[String(m.id)] = m; perNaam[normNaam(m.naam)] = m; });
    const iso = s => { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    for (const c of open) {
      const r = (rijen || []).find(x => zelfde(c, { naam: x.naam, email: x.email, mid: x.mid }) && /^(Verzonden|Verstuurd)/.test(String(x.status || '')));
      if (!r) continue;
      const m = (c.medewerker_id && perId[String(c.medewerker_id)]) || (r.mid && perId[String(r.mid)]) || perNaam[normNaam(c.naam)];
      if (m && m.eind && m.eind === iso(r.einddatum) && await vink(c, 'laatstedag', SYSTEEM, 'Uitdienstdatum in Shiftbase = einddatum dossier', open)) n++;
      if (r.ondertekend === 'Ja' && await vink(c, 'bevestiging', SYSTEEM, 'Brief ondertekend retour', open)) n++;
      if (r.salaris && await vink(c, 'salaris', SYSTEEM, 'Naar salaris gestuurd op ' + r.salaris, open)) n++;
    }
  } catch (e) { console.warn('offboarding sync:', e.message); }
  return n;
}

module.exports = { start, vink, syncShiftbase, zelfde };
