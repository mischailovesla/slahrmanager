// ============================================================
// Fase 4c: contractverlenging als proces
// GET  /api/verlenging                 -> { lijst, tabelOk } alle tijdelijke contracten die binnen 60 dagen aflopen + status
// GET  /api/verlenging?mid=…           -> { besluiten } alle besluiten van één medewerker (dossier)
// POST /api/verlenging { mid, eindIso, besluit, nieuweEind?, advies?, adviesOpmerking?, notitie?, bevestigVol? }  -> besluit opslaan
// POST /api/verlenging { actie:'wissen', mid, eindIso }  -> besluit intrekken
// Het besluit wordt gekoppeld aan medewerker × einddatum van het huidige contract (hr_verlenging, migratie 0014).
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const VL = require('./_lib/verlenging');

exports.handler = beveiligd('verlenging', async (event, g) => {
  const SIG = require('./_lib/signaleringen');
  if (event.httpMethod !== 'POST') {
    const q = event.queryStringParameters || {};
    if (q.mid) {
      const { data, error } = await admin().from('hr_verlenging').select('*').eq('medewerker_id', String(q.mid)).order('contract_eind', { ascending: false });
      if (error) return { besluiten: [], fout: error.message };
      return { besluiten: (data || []).map(b => Object.assign({ label: VL.BESLUITEN[b.besluit] || b.besluit, adviesLabel: VL.ADVIES[b.advies_sm || ''] || '' }, b)) };
    }
    const r = await SIG.laadVerlengingen();
    return { lijst: r.lijst, tabelOk: r.tabelOk, venster: VL.VENSTER, deadlineDagen: VL.DEADLINE, besluitLabels: VL.BESLUITEN, adviesLabels: VL.ADVIES };
  }
  const p = body(event), mid = String(p.mid || '').trim(), eindIso = String(p.eindIso || '').trim();
  if (!mid || !/^\d{4}-\d{2}-\d{2}$/.test(eindIso)) throw new Error('Medewerker of einddatum ontbreekt.');
  if (p.actie === 'wissen') {
    const { error } = await admin().from('hr_verlenging').delete().eq('medewerker_id', mid).eq('contract_eind', eindIso);
    if (error) throw new Error('hr_verlenging: ' + error.message);
    await logActie({ door: g.email, actie: 'verlenging-besluit', bron: 'verlenging', naam: String(p.naam || ''), veld: eindIso, nieuw: 'ingetrokken' });
    return { bericht: 'Besluit ingetrokken.' };
  }
  const { lijst } = await SIG.laadVerlengingen();
  const item = lijst.find(x => x.mid === mid && x.eindIso === eindIso);
  try { VL.controleer(p, item); } catch (e) { if (e.ketenVol) return { success: false, ketenVol: true, bericht: e.message }; throw e; }
  const rec = {
    medewerker_id: mid, naam: (item && item.naam) || String(p.naam || ''), email: (item && item.email) || String(p.email || ''), winkel: (item && item.winkel) || String(p.winkel || ''),
    contract_start: (item && item.startIso) || String(p.startIso || ''), contract_eind: eindIso, besluit: p.besluit,
    nieuwe_eind: p.besluit === 'verlengen-tijdelijk' ? String(p.nieuweEind || '') : '', advies_sm: String(p.advies || ''), advies_opmerking: String(p.adviesOpmerking || '').slice(0, 500),
    notitie: String(p.notitie || '').slice(0, 1000), keten_aantal: item ? item.keten.aantal : null, keten_maanden: item ? item.keten.maanden : null,
    besloten_door: g.email, besloten_op: new Date().toISOString(), bijgewerkt_op: new Date().toISOString()
  };
  const { error } = await admin().from('hr_verlenging').upsert(rec, { onConflict: 'medewerker_id,contract_eind' });
  if (error) throw new Error('Besluit opslaan mislukt: ' + error.message + (/does not exist/.test(error.message) ? ' (migratie 0014 nog draaien)' : ''));
  await logActie({ door: g.email, actie: 'verlenging-besluit', bron: 'verlenging', naam: rec.naam, veld: eindIso, nieuw: p.besluit + (rec.nieuwe_eind ? ' t/m ' + rec.nieuwe_eind : ''), details: (p.advies ? 'Advies SM: ' + p.advies + (rec.advies_opmerking ? ' (' + rec.advies_opmerking + ')' : '') + '. ' : '') + rec.notitie + (p.bevestigVol ? ' [bewust tijdelijk bij volle keten]' : '') });
  const vervolg = { 'verlengen-tijdelijk': 'Maak het nieuwe contract in Shiftbase aan en laat het tekenen; de taak verdwijnt zodra het er staat.', 'verlengen-vast': 'Maak het vaste contract in Shiftbase aan en laat het tekenen; de taak verdwijnt zodra het er staat.', 'niet-verlengen': 'Verstuur nu de aanzegging.', 'zelf-opgezegd': 'Verstuur nu de ontslagbevestiging.' }[p.besluit];
  return { bericht: 'Besluit opgeslagen: ' + VL.BESLUITEN[p.besluit] + '. ' + vervolg, besluit: p.besluit, item };
});
