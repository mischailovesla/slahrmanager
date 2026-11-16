// ============================================================
// v0.49.0 POST /api/declaratie-app — aangeroepen door SLA Academy (sla-academy.netlify.app), niet door het dashboard.
// Beveiliging: de Academy-sessie van de medewerker (Authorization: Bearer <Academy access token>), gecontroleerd bij
// Academy zelf. Een medewerker ziet en wijzigt alleen zijn eigen declaraties.
//   { actie:'mijn' }                                   -> { profiel, iban, declaraties[] }
//   { actie:'start', naam, mime, bytes }               -> { pad, uploadUrl }   (bonnetje rechtstreeks naar de opslag)
//   { actie:'indienen', datum, leverancier, bedrag, omschrijving, iban, iban_naam, akkoord, bewaarIban, bon:{pad,naam_orig,mime,bytes} }
//   { actie:'bon', id }                                -> { url }            (eigen bonnetje bekijken)
//   { actie:'intrekken', id }                          -> alleen zolang de status 'ingediend' is
// ============================================================
const { admin, body, logActie } = require('./_lib/auth');
const D = require('./_lib/declaraties');

function antwoord(event, status, b) {
  return { statusCode: status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, D.cors(event)), body: JSON.stringify(b) };
}
const zichtbaar = r => ({ id: r.id, ingediend: r.created_at, datum: r.aankoop_datum, leverancier: r.leverancier, bedrag: Number(r.bedrag), omschrijving: r.omschrijving, status: r.status, betaald_op: r.betaald_op, reden: r.afgewezen_reden || '' });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: D.cors(event), body: '' };
  if (event.httpMethod !== 'POST') return antwoord(event, 405, { success: false, bericht: 'Gebruik POST' });
  try {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const m = await D.academyGebruiker(auth.startsWith('Bearer ') ? auth.slice(7) : '');
    if (m.franchise) return antwoord(event, 403, { success: false, bericht: 'Declaraties van franchisewinkels lopen via je eigen winkel, niet via SLA HR. · Expenses for franchise stores are handled by your own store.' });
    const p = body(event), db = admin();

    if (p.actie === 'mijn') {
      const [d, i] = await Promise.all([
        db.from('hr_declaraties').select('*').eq('email', m.email).order('created_at', { ascending: false }).limit(50),
        db.from('hr_declaratie_iban').select('iban,iban_naam').eq('email', m.email).maybeSingle()
      ]);
      if (d.error) throw new Error(/hr_declaraties/.test(d.error.message) ? 'Declaraties staan nog niet aan (migratie 0025). · Expenses are not available yet.' : d.error.message);
      return antwoord(event, 200, { success: true, profiel: { naam: m.naam, winkel: m.winkel }, iban: i.data ? { iban: D.ibanMooi(i.data.iban), iban_naam: i.data.iban_naam } : null, declaraties: (d.data || []).map(zichtbaar) });
    }

    if (p.actie === 'start') {
      const mime = String(p.mime || '').split(';')[0].toLowerCase();
      if (!D.MIME[mime]) return antwoord(event, 400, { success: false, bericht: 'Alleen een foto (JPG/PNG/HEIC) of PDF. · Only a photo or PDF.' });
      if (!(Number(p.bytes) > 0) || Number(p.bytes) > D.MAX_BYTES) return antwoord(event, 400, { success: false, bericht: 'Bestand is te groot (max. 10 MB). · File too large (max 10 MB).' });
      const pad = D.padVoor(m.academy_id, p.naam, mime);
      const { data, error } = await db.storage.from(D.BUCKET).createSignedUploadUrl(pad);
      if (error) throw new Error('Opslag: ' + error.message + (/not found|bucket/i.test(error.message) ? ' (migratie 0025 nog niet gedraaid?)' : ''));
      return antwoord(event, 200, { success: true, pad, uploadUrl: data.signedUrl });
    }

    if (p.actie === 'indienen') {
      const c = D.controleerInvoer(p);
      if (!c.ok) return antwoord(event, 400, { success: false, bericht: c.fouten.join('\n'), fouten: c.fouten });
      const bon = p.bon || {}, pad = String(bon.pad || '');
      if (pad.indexOf(m.academy_id + '/') !== 0) return antwoord(event, 400, { success: false, bericht: 'Voeg een foto of scan van het bonnetje toe. · Please add a photo or scan of the receipt.' });
      const map = pad.substring(0, pad.lastIndexOf('/')), naam = pad.substring(pad.lastIndexOf('/') + 1);
      const ls = await db.storage.from(D.BUCKET).list(map, { search: naam });
      const obj = !ls.error && ls.data ? ls.data.find(o => o.name === naam) : null;
      const grootte = obj && obj.metadata && obj.metadata.size != null ? Number(obj.metadata.size) : null;
      if (!obj || grootte === 0) return antwoord(event, 400, { success: false, bericht: 'Het bonnetje is niet goed aangekomen. Probeer de foto opnieuw. · The receipt did not upload correctly. Please try again.' });
      const rec = Object.assign({ email: m.email, naam: m.naam, academy_id: m.academy_id, shiftbase_id: m.shiftbase_id, winkel: m.winkel, winkel_code: m.winkel_code, taal: m.taal,
        bon: { pad, naam_orig: String(bon.naam_orig || '').slice(0, 120), mime: String(bon.mime || ''), bytes: grootte || Number(bon.bytes) || 0 } }, c.waarde);
      const { data, error } = await db.from('hr_declaraties').insert(rec).select('*').single();
      if (error) throw new Error(error.message);
      if (p.bewaarIban !== false) await db.from('hr_declaratie_iban').upsert({ email: m.email, iban: c.waarde.iban, iban_naam: c.waarde.iban_naam, bijgewerkt_op: new Date().toISOString() });
      await logActie({ door: 'academy:' + m.email, actie: 'declaratie', bron: 'declaraties', veld: 'ingediend', naam: m.naam, nieuw: data.id, details: '€ ' + c.waarde.bedrag.toFixed(2) + ' · ' + c.waarde.leverancier + ' · ' + c.waarde.aankoop_datum });
      return antwoord(event, 200, { success: true, declaratie: zichtbaar(data) });
    }

    if (p.actie === 'bon' || p.actie === 'intrekken') {
      const { data: r } = await db.from('hr_declaraties').select('*').eq('id', String(p.id || '')).eq('email', m.email).maybeSingle();
      if (!r) return antwoord(event, 404, { success: false, bericht: 'Declaratie niet gevonden. · Not found.' });
      if (p.actie === 'bon') {
        const { data, error } = await db.storage.from(D.BUCKET).createSignedUrl(r.bon.pad, 300);
        if (error) throw new Error('Opslag: ' + error.message);
        return antwoord(event, 200, { success: true, url: data.signedUrl });
      }
      if (r.status !== 'ingediend') return antwoord(event, 400, { success: false, bericht: 'Deze declaratie is al verwerkt door HR. · This expense has already been processed.' });
      const { error } = await db.from('hr_declaraties').delete().eq('id', r.id).eq('status', 'ingediend');
      if (error) throw new Error(error.message);
      try { await db.storage.from(D.BUCKET).remove([r.bon.pad]); } catch (e) { console.warn('bon verwijderen:', e.message); }
      await logActie({ door: 'academy:' + m.email, actie: 'declaratie', bron: 'declaraties', veld: 'ingetrokken', naam: m.naam, oud: r.id, details: '€ ' + Number(r.bedrag).toFixed(2) + ' · ' + r.leverancier });
      return antwoord(event, 200, { success: true });
    }
    return antwoord(event, 400, { success: false, bericht: 'Onbekende actie' });
  } catch (e) {
    console.warn('declaratie-app:', e.message);
    return antwoord(event, e.status || 500, { success: false, bericht: e.message || String(e) });
  }
};
