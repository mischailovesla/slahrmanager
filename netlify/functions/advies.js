// ============================================================
// v0.28.0: publieke endpoint voor het advies van de store manager over verlengen (geen login;
// beveiligd met de persoonlijke link uit de winkelmail, 21 dagen geldig).
//   POST { t }                             -> { advies: { naam, winkel, einddatum, huidig, besloten } }
//   POST { t, advies, opmerking }          -> opslaan in hr_sm_advies (overschrijft een eerder advies)
// ============================================================
const { json, body, admin, logActie } = require('./_lib/auth');
const WM = require('./_lib/winkelmail');
const VL = require('./_lib/verlenging');
const nl = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : s; };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event), tok = WM.leesAdviesToken(p.t), db = admin();
    const [{ data: adv }, { data: bes }] = await Promise.all([
      db.from('hr_sm_advies').select('advies,opmerking,gegeven_op').eq('medewerker_id', tok.m).eq('contract_eind', tok.e).maybeSingle(),
      db.from('hr_verlenging').select('besluit').eq('medewerker_id', tok.m).eq('contract_eind', tok.e).maybeSingle()
    ]);
    const besloten = bes ? (VL.BESLUITEN[bes.besluit] || bes.besluit) : '';
    if (!p.advies) return json(200, { success: true, advies: { naam: tok.n, winkel: tok.w, einddatum: nl(tok.e), huidig: adv || null, besloten } });
    if (!['verlengen', 'niet', 'twijfel'].includes(p.advies)) throw new Error('Kies verlengen, niet verlengen of twijfel.');
    if (besloten) throw new Error('HR heeft al een besluit genomen (' + besloten.toLowerCase() + '). Neem bij vragen contact op met HR.');
    const opmerking = String(p.opmerking || '').trim().slice(0, 600);
    if ((p.advies === 'niet' || p.advies === 'twijfel') && opmerking.length < 5) throw new Error('Licht je advies kort toe: waarom niet, of waar twijfel je over?');
    const h = event.headers || {}, ip = h['x-nf-client-connection-ip'] || String(h['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const { error } = await db.from('hr_sm_advies').upsert({ medewerker_id: tok.m, contract_eind: tok.e, naam: tok.n, winkel: tok.w, advies: p.advies, opmerking, gegeven_op: new Date().toISOString(), ip }, { onConflict: 'medewerker_id,contract_eind' });
    if (error) throw new Error('Opslaan mislukt' + (/relation|does not exist/i.test(error.message) ? ' (migratie 0021 nog niet gedraaid)' : ': ' + error.message));
    await logActie({ door: 'winkelmail:' + (tok.w || '?'), actie: 'sm-advies', bron: 'verlenging', naam: tok.n, veld: tok.e, nieuw: p.advies, details: opmerking.slice(0, 200) });
    return json(200, { success: true, bericht: 'Dank je! HR neemt je advies mee in het besluit.', advies: VL.ADVIES[p.advies] });
  } catch (e) { return json(e.verlopen ? 410 : 400, { success: false, bericht: e.message }); }
};
