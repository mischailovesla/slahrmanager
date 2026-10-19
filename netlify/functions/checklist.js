// ============================================================
// /api/checklist — fase 1: on-/offboarding-checklist per medewerker (hr_checklists, migratie 0007)
//   GET  ?id=<uuid>                      één checklist
//   GET  ?naam=&email=[&id=<shiftbase>]  alle checklists van een persoon (dossier)
//   GET  (zonder params)                 alle open checklists
//   POST {actie:'start', type, naam, email, winkel, medewerker_id}   nieuwe checklist uit het sjabloon (config.js)
//   POST {actie:'vink', id, key, klaar, opmerking}                   punt af-/aanvinken (door + tijdstip)
//   POST {actie:'afronden', id} / {actie:'heropen', id}
// Alles wordt gelogd in hr_acties. Items zijn jsonb: [{key,label,klaar,door,op,opmerking}].
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const C = require('./_lib/config');
const { normNaam } = require('./_lib/util');

const stempel = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 16);
function fout(e) { throw new Error('hr_checklists: ' + e.message + (/relation|does not exist/i.test(e.message) ? ' (migratie 0007 gedraaid?)' : '')); }
const samenvatting = c => { const items = c.items || [], klaar = items.filter(i => i.klaar).length; return Object.assign({}, c, { totaal: items.length, klaar, open: items.length - klaar }); };

exports.handler = beveiligd('checklist', async (event, g) => {
  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};
    if (qs.id && /^[0-9a-f-]{36}$/.test(qs.id)) {
      const { data, error } = await admin().from('hr_checklists').select('*').eq('id', qs.id).maybeSingle(); if (error) fout(error);
      if (!data) throw new Error('Checklist niet gevonden.');
      return { checklist: samenvatting(data), sjablonen: { onboarding: C.CHECKLIST_ONBOARDING.length, offboarding: C.CHECKLIST_OFFBOARDING.length } };
    }
    let q = admin().from('hr_checklists').select('*').order('gestart_op', { ascending: false }).limit(500);
    if (qs.naam || qs.email || qs.id) { /* per persoon: ruim ophalen, hieronder filteren */ } else q = q.is('afgerond_op', null);
    const { data, error } = await q; if (error) fout(error);
    let lijst = data || [];
    if (qs.naam || qs.email || qs.id) {
      const em = String(qs.email || '').toLowerCase(), nn = normNaam(qs.naam || ''), mid = String(qs.id || '');
      lijst = lijst.filter(c => (mid && c.medewerker_id === mid) || (em && String(c.email || '').toLowerCase() === em) || (nn && normNaam(c.naam) === nn));
    }
    return { checklists: lijst.map(samenvatting) };
  }
  if (event.httpMethod !== 'POST') throw new Error('Gebruik GET of POST');
  const p = body(event);
  if (p.actie === 'start') {
    const type = p.type === 'offboarding' ? 'offboarding' : 'onboarding';
    const naam = String(p.naam || '').trim(); if (!naam) throw new Error('Naam ontbreekt.');
    // niet dubbel: bestaat er al een open checklist van dit type voor deze persoon?
    const { data: bestaand } = await admin().from('hr_checklists').select('id,naam,email,medewerker_id').eq('type', type).is('afgerond_op', null).limit(500);
    const em = String(p.email || '').toLowerCase(), nn = normNaam(naam), mid = String(p.medewerker_id || '');
    const dubbel = (bestaand || []).find(c => (mid && c.medewerker_id === mid) || (em && String(c.email || '').toLowerCase() === em) || normNaam(c.naam) === nn);
    if (dubbel) return { id: dubbel.id, bericht: 'Er loopt al een ' + type + '-checklist voor ' + naam + '.', bestaand: true };
    const sjabloon = type === 'offboarding' ? C.CHECKLIST_OFFBOARDING : C.CHECKLIST_ONBOARDING;
    const rec = { type, naam, email: String(p.email || ''), winkel: String(p.winkel || ''), medewerker_id: mid || null, items: sjabloon.map(i => ({ key: i.key, label: i.label, klaar: false })), gestart_door: g.email, gestart_op: new Date().toISOString() };
    const { data, error } = await admin().from('hr_checklists').insert(rec).select('id').single(); if (error) fout(error);
    await logActie({ door: g.email, actie: 'checklist-start', bron: type, naam, details: sjabloon.length + ' punten' });
    return { id: data.id, bericht: type === 'onboarding' ? 'Onboarding-checklist gestart voor ' + naam : 'Offboarding-checklist gestart voor ' + naam };
  }
  const id = String(p.id || ''); if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Ongeldige checklist-id.');
  const { data: c, error } = await admin().from('hr_checklists').select('*').eq('id', id).maybeSingle(); if (error) fout(error);
  if (!c) throw new Error('Checklist niet gevonden.');
  if (p.actie === 'vink') {
    const items = (c.items || []).map(i => i.key === p.key ? Object.assign({}, i, { klaar: !!p.klaar, door: p.klaar ? g.email : null, op: p.klaar ? stempel() : null, opmerking: p.opmerking != null ? String(p.opmerking).slice(0, 300) : i.opmerking }) : i);
    if (!items.some(i => i.key === p.key)) throw new Error('Onbekend punt: ' + p.key);
    const alles = items.every(i => i.klaar);
    const upd = { items, afgerond_op: alles ? new Date().toISOString() : null };
    const { error: e2 } = await admin().from('hr_checklists').update(upd).eq('id', id); if (e2) fout(e2);
    const item = items.find(i => i.key === p.key);
    await logActie({ door: g.email, actie: p.klaar ? 'checklist-vink' : 'checklist-ontvink', bron: c.type, naam: c.naam, veld: p.key, details: item.label });
    return { checklist: samenvatting(Object.assign({}, c, upd)), bericht: (p.klaar ? '✓ ' : '↩ ') + item.label + (alles ? ' — checklist compleet!' : '') };
  }
  if (p.actie === 'afronden' || p.actie === 'heropen') {
    const upd = { afgerond_op: p.actie === 'afronden' ? new Date().toISOString() : null };
    const { error: e3 } = await admin().from('hr_checklists').update(upd).eq('id', id); if (e3) fout(e3);
    await logActie({ door: g.email, actie: 'checklist-' + p.actie, bron: c.type, naam: c.naam });
    return { checklist: samenvatting(Object.assign({}, c, upd)), bericht: p.actie === 'afronden' ? 'Checklist afgerond (open punten blijven zichtbaar in het dossier).' : 'Checklist heropend.' };
  }
  throw new Error('Onbekende actie: ' + p.actie);
});
