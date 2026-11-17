// ============================================================
// v0.51.0 /api/loonstroken — loonstroken uit Exact Online splitsen, koppelen, bekijken en mailen.
// Alleen voor personen met salarisinzage (_lib/salarisinzage.js).
//   GET  ?periode=YYYY-MM|alle                         -> { rijen, periodes, tellingen }
//   GET  ?shiftbaseId=<id>                              -> { rijen }  alle stroken van één medewerker (dossier, v0.51.1)
//   POST { actie:'start', naam, bytes }                -> { pad, token, bucket }   getekende upload-URL voor het origineel
//   POST { actie:'verwerk', pad, naam }                -> { stroken, waarschuwingen, ... }  knippen + koppelen + opslaan
//   POST { actie:'koppel', id, shiftbaseId }           -> handmatig koppelen (leeg = ontkoppelen); onthoudt Exact-nr -> Shiftbase
//   POST { actie:'bevestig', ids }                     -> voorstellen bevestigen (worden vaste koppeling)
//   POST { actie:'open', id }                          -> { url } tijdelijke downloadlink (2 min)
//   POST { actie:'bundel', ids }                       -> { bestand:{filename, content(base64)} } één PDF met de gekozen stroken
//   POST { actie:'mail', ids, taal, preview? }         -> mail met PDF naar het e-mailadres uit Shiftbase (nooit een vrij adres)
//   POST { actie:'verwijder', id }                     -> strook + bestand weg (verkeerde upload)
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const L = require('./_lib/loonstroken');
const SI = require('./_lib/salarisinzage');
const SB = require('./_lib/shiftbase');
const M = require('./_lib/mail');
const T = require('./_lib/sjablonen');

const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAANDEN = { nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
const periodeTekst = (p, taal) => { const m = String(p || '').match(/^(\d{4})-(\d{2})$/); return m ? MAANDEN[taal === 'en' ? 'en' : 'nl'][+m[2] - 1] + ' ' + m[1] : p; };
const ONTBREEKT = /hr_loonstroken|hr_exact_koppeling|schema cache/;
const ontbreektMelding = 'Tabel hr_loonstroken ontbreekt nog: draai supabase/migrations/0026_loonstroken.sql in Supabase (SLA HR Manager).';

// parallel met maximaal n tegelijk
async function parallel(lijst, n, fn) {
  const uit = new Array(lijst.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lijst.length) }, async () => { while (i < lijst.length) { const k = i++; uit[k] = await fn(lijst[k], k); } }));
  return uit;
}

function mailInhoud(voornaam, periodes, taal) {
  const en = taal === 'en';
  const lijst = periodes.map(p => periodeTekst(p, taal));
  const wat = lijst.length === 1 ? lijst[0] : lijst.slice(0, -1).join(', ') + (en ? ' and ' : ' en ') + lijst[lijst.length - 1];
  const subject = en ? 'Your payslip' + (lijst.length > 1 ? 's' : '') + ' – ' + wat : 'Je salarisspecificatie' + (lijst.length > 1 ? 's' : '') + ' – ' + wat;
  const alinea = en
    ? ['Hi ' + voornaam + ',', 'As requested, attached you will find your payslip' + (lijst.length > 1 ? 's' : '') + ' for ' + wat + ' (one PDF).', 'Payslips contain personal data such as your salary and bank account. Keep this email safe and do not forward it to others than the organisation that asked for it (e.g. DUO).', 'You can also find your payslips in the Exact Online app. Can\'t log in? Just reply to this email.', 'Kind regards,<br>SLA HR Team']
    : ['Hoi ' + voornaam + ',', 'Zoals gevraagd vind je in de bijlage je salarisspecificatie' + (lijst.length > 1 ? 's' : '') + ' over ' + wat + ' (één PDF).', 'Loonstroken bevatten persoonsgegevens zoals je salaris en rekeningnummer. Bewaar deze mail goed en stuur hem alleen door naar de instantie die erom vraagt (bijv. DUO).', 'Je loonstroken staan ook in de Exact Online-app. Lukt inloggen niet? Beantwoord dan gewoon deze mail.', 'Groet,<br>SLA HR Team'];
  const F = 'font-family:Arial,sans-serif;font-size:14px;color:#333d3a;line-height:1.6;margin:0 0 14px';
  const html = T.slaWrap(T.slaHead('#009f4b', en ? 'Payslips' : 'Loonstroken') + '<tr><td style="padding:30px 36px 18px">' + alinea.map(a => '<p style="' + F + '">' + a + '</p>').join('') + '</td></tr>' + T.slaFoot());
  const text = alinea.map(a => a.replace(/<br>/g, '\n')).join('\n\n');
  return { subject, html, text };
}

async function haalRijen(db, ids) {
  const lijst = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
  if (!lijst.length) throw new Error('Geen loonstroken gekozen.');
  const { data, error } = await db.from('hr_loonstroken').select('*').in('id', lijst);
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Loonstrook niet gevonden.');
  return data.sort((a, b) => (a.periode + a.run).localeCompare(b.periode + b.run));
}
async function downloadBytes(db, pad) {
  const { data, error } = await db.storage.from(L.BUCKET).download(pad);
  if (error) throw new Error('Opslag: ' + error.message);
  return new Uint8Array(await data.arrayBuffer());
}
async function bundelVan(db, rijen) {
  const delen = await parallel(rijen, 6, r => downloadBytes(db, r.pad));
  return delen.length === 1 ? delen[0] : await L.bundel(delen, 'Salarisspecificaties');
}
async function onthoudKoppeling(db, r, shiftbaseId, naam, door) {
  const { error } = await db.from('hr_exact_koppeling').upsert({ bv: r.bv, exact_nr: r.exact_nr, shiftbase_id: shiftbaseId, naam, door, bijgewerkt_op: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Origineel in de opslag (bron/...) knippen, koppelen en opslaan. Ook gebruikt door /api/loonstroken-import (mail van salaris).
async function verwerkBron(db, pad, bronNaam, door) {
  const p = { naam: bronNaam }, g = { email: door };
  const bron = await downloadBytes(db, pad);
  let res;
  try { res = await L.lees(bron, bronNaam); } catch (e) { throw new Error('Kon de PDF niet lezen: ' + e.message); }
  if (!res.stroken.length) throw new Error('Geen loonstroken gevonden in dit bestand. Is het de PDF met salarisspecificaties uit Exact Online?');
  const waarschuwingen = res.waarschuwingen.slice();
  if (!/exact/i.test(res.maker)) waarschuwingen.push('Dit bestand lijkt niet uit Exact Online te komen (maker: ' + (res.maker || 'onbekend') + '). Controleer de stroken.');
  // koppelen
  const [medewerkers, kop] = await Promise.all([SB.getMedewerkers(false).catch(e => { waarschuwingen.push('Shiftbase niet bereikbaar: koppelen alleen op eerdere koppelingen (' + e.message + ').'); return []; }),
    db.from('hr_exact_koppeling').select('*').in('bv', Array.from(new Set(res.stroken.map(s => s.bv))))]);
  if (kop.error && ONTBREEKT.test(kop.error.message)) throw new Error(ontbreektMelding);
  const koppelingen = {}; (kop.data || []).forEach(k => { koppelingen[k.bv + '|' + k.exact_nr] = k; });
  const lijst = medewerkers.map(m => ({ id: m.id, naam: m.naam, voornaam: m.voornaam, email: m.email, gebDatum: m.gebDatum || '' }));
  // bestaande rijen (zelfde run opnieuw geüpload): handmatige koppeling niet overschrijven
  const { data: bestaand } = await db.from('hr_loonstroken').select('bv,exact_nr,run,shiftbase_id,naam,email,koppeling,koppeling_reden').in('run', Array.from(new Set(res.stroken.map(s => s.run))));
  const oud = {}; (bestaand || []).forEach(b => { oud[b.bv + '|' + b.exact_nr + '|' + b.run] = b; });
  const nu = new Date().toISOString();
  const rijen = await parallel(res.stroken, 6, async s => {
    const bytes = await L.knip(res.doc, s.paginaIdx, 'Salarisspecificatie ' + s.naamStrook + ' ' + s.periode);
    const spad = L.opslagPad(s);
    const up = await db.storage.from(L.BUCKET).upload(spad, bytes, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new Error('Opslag (' + s.naamStrook + '): ' + up.error.message);
    const o = oud[s.bv + '|' + s.exactNr + '|' + s.run];
    const k = o && o.koppeling === 'handmatig' ? { shiftbaseId: o.shiftbase_id, naam: o.naam, email: o.email, zekerheid: 'handmatig', reden: o.koppeling_reden } : L.koppel(s, lijst, koppelingen);
    return { bv: s.bv, exact_nr: s.exactNr, periode: s.periode, run: s.run, naam_strook: s.naamStrook, afdeling: s.afdeling || null, functie: s.functie || null, documenten: s.documenten, paginas: s.paginaIdx.length,
      pad: spad, bron_pad: pad, bron_naam: String(p.naam || '').slice(0, 120), shiftbase_id: k.shiftbaseId || null, naam: k.naam || null, email: k.email || null, koppeling: k.zekerheid, koppeling_reden: k.reden,
      geupload_door: g.email, bijgewerkt_op: nu, _nieuw: !o };
  });
  const nieuw = rijen.filter(r => r._nieuw).length; rijen.forEach(r => delete r._nieuw);
  const { error } = await db.from('hr_loonstroken').upsert(rijen, { onConflict: 'bv,exact_nr,run' });
  if (error) throw new Error(ONTBREEKT.test(error.message) ? ontbreektMelding : error.message);
  // zekere koppelingen meteen onthouden (voorstellen pas na bevestigen)
  const zeker = rijen.filter(r => r.koppeling === 'zeker' && r.shiftbase_id).map(r => ({ bv: r.bv, exact_nr: r.exact_nr, shiftbase_id: r.shiftbase_id, naam: r.naam, door: g.email + ' (automatisch)', bijgewerkt_op: nu }));
  if (zeker.length) { const z = await db.from('hr_exact_koppeling').upsert(zeker, { ignoreDuplicates: true }); if (z.error) waarschuwingen.push('Koppelingen onthouden mislukt: ' + z.error.message); }
  const tel = { vast: 0, zeker: 0, voorstel: 0, handmatig: 0, '': 0 }; rijen.forEach(r => { tel[r.koppeling] = (tel[r.koppeling] || 0) + 1; });
  const bvs = Array.from(new Set(rijen.map(r => r.bv))), periodes = Array.from(new Set(rijen.map(r => r.periode)));
  await logActie({ door: g.email, actie: 'upload', bron: 'loonstroken', veld: 'verwerk', naam: bvs.join(', '), nieuw: periodes.join(', '),
    details: (p.naam || pad) + ': ' + res.paginas + ' pagina\'s → ' + rijen.length + ' loonstroken (' + nieuw + ' nieuw); gekoppeld ' + (tel.vast + tel.zeker + tel.handmatig) + ', voorstel ' + tel.voorstel + ', niet gekoppeld ' + tel[''] });
  return { bestand: p.naam || '', paginas: res.paginas, aantal: rijen.length, nieuw, vervangen: rijen.length - nieuw, tellingen: tel, bvs, periodes, waarschuwingen,
    nietGekoppeld: rijen.filter(r => !r.shiftbase_id || r.koppeling === 'voorstel').map(r => ({ naam_strook: r.naam_strook, exact_nr: r.exact_nr, voorstel: r.koppeling === 'voorstel' ? r.naam : '', reden: r.koppeling_reden })) };
}

exports.handler = beveiligd('loonstroken', async (event, g) => {
  await SI.eis(g.email, 'Loonstroken');
  const db = admin();

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    // v0.51.1: alle stroken van één medewerker (dossier)
    if (q.shiftbaseId) {
      const { data, error } = await db.from('hr_loonstroken').select('id,bv,exact_nr,periode,run,naam_strook,afdeling,documenten,paginas,koppeling,koppeling_reden').eq('shiftbase_id', String(q.shiftbaseId)).order('periode', { ascending: false }).limit(500);
      if (error) { if (ONTBREEKT.test(error.message)) return { ontbreekt: true, rijen: [] }; throw new Error(error.message); }
      return { rijen: data || [] };
    }
    const per = await db.from('hr_loonstroken').select('periode,koppeling').order('periode', { ascending: false }).limit(20000);
    if (per.error) { if (ONTBREEKT.test(per.error.message)) return { ontbreekt: true, melding: ontbreektMelding, rijen: [], periodes: [] }; throw new Error(per.error.message); }
    const periodes = Array.from(new Set((per.data || []).map(x => x.periode))).sort().reverse();
    const periode = q.periode || periodes[0] || '';
    let sel = db.from('hr_loonstroken').select('id,created_at,bv,exact_nr,periode,run,naam_strook,afdeling,functie,documenten,paginas,shiftbase_id,naam,email,koppeling,koppeling_reden,bron_naam,geupload_door').order('bv').order('naam_strook').limit(5000);
    if (q.open) sel = sel.neq('koppeling', 'vast').neq('koppeling', 'zeker').neq('koppeling', 'handmatig'); // v0.52.2: alleen te koppelen (alle periodes)
    else if (q.zoek) sel = sel.or('naam.ilike.%' + String(q.zoek).replace(/[%,()]/g, '') + '%,naam_strook.ilike.%' + String(q.zoek).replace(/[%,()]/g, '') + '%');
    else if (periode !== 'alle') sel = sel.eq('periode', periode);
    const { data, error } = await sel;
    if (error) throw new Error(error.message);
    const open = (per.data || []).filter(x => !x.koppeling || x.koppeling === 'voorstel').length;
    return { rijen: data || [], periodes, periode, open };
  }

  const p = body(event);

  if (p.actie === 'start') {
    const bytes = Number(p.bytes) || 0;
    if (!(bytes > 0) || bytes > L.MAX_BYTES) throw new Error('Bestand is leeg of te groot (max. 25 MB).');
    if (!/\.pdf$/i.test(String(p.naam || ''))) throw new Error('Alleen PDF-bestanden uit Exact Online.');
    const pad = 'bron/' + new Date().toISOString().slice(0, 10) + '/' + Date.now() + '_' + String(p.naam).replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const { data, error } = await db.storage.from(L.BUCKET).createSignedUploadUrl(pad);
    if (error) throw new Error('Opslag: ' + error.message + (/not found|bucket/i.test(error.message) ? ' (bestaat bucket "' + L.BUCKET + '"? zie migratie 0026)' : ''));
    return { pad, token: data.token, bucket: L.BUCKET };
  }

  if (p.actie === 'verwerk') {
    const pad = String(p.pad || '');
    if (!/^bron\/[\w\-/.]+\.pdf$/i.test(pad)) throw new Error('Ongeldig bestandspad.');
    return await verwerkBron(db, pad, p.naam, g.email);
  }

  if (p.actie === 'koppel') {
    const [r] = await haalRijen(db, p.id), sid = String(p.shiftbaseId || '');
    if (!sid) {
      await db.from('hr_loonstroken').update({ shiftbase_id: null, naam: null, email: null, koppeling: '', koppeling_reden: 'ontkoppeld door ' + g.email, bijgewerkt_op: new Date().toISOString() }).eq('bv', r.bv).eq('exact_nr', r.exact_nr);
      await db.from('hr_exact_koppeling').delete().eq('bv', r.bv).eq('exact_nr', r.exact_nr);
      await logActie({ door: g.email, actie: 'koppel', bron: 'loonstroken', veld: 'ontkoppeld', naam: r.naam || r.naam_strook, details: r.bv + ' · Exact ' + r.exact_nr });
      return { aantal: 1 };
    }
    const m = (await SB.getMedewerkers(false)).find(x => x.id === sid);
    if (!m) throw new Error('Medewerker niet gevonden in Shiftbase.');
    await onthoudKoppeling(db, r, sid, m.naam, g.email);
    // alle stroken met dit Exact-nr in deze BV (ook eerdere maanden) meteen mee
    const { data, error } = await db.from('hr_loonstroken').update({ shiftbase_id: sid, naam: m.naam, email: m.email || null, koppeling: 'handmatig', koppeling_reden: 'gekoppeld door ' + g.email, bijgewerkt_op: new Date().toISOString() })
      .eq('bv', r.bv).eq('exact_nr', r.exact_nr).select('id');
    if (error) throw new Error(error.message);
    await logActie({ door: g.email, actie: 'koppel', bron: 'loonstroken', veld: 'handmatig', naam: m.naam, details: r.naam_strook + ' · ' + r.bv + ' · Exact ' + r.exact_nr + ' → Shiftbase ' + sid });
    return { aantal: (data || []).length, naam: m.naam };
  }

  if (p.actie === 'bevestig') {
    const rijen = (await haalRijen(db, p.ids)).filter(r => r.koppeling === 'voorstel' && r.shiftbase_id);
    for (const r of rijen) {
      await onthoudKoppeling(db, r, r.shiftbase_id, r.naam, g.email);
      await db.from('hr_loonstroken').update({ koppeling: 'vast', koppeling_reden: 'voorstel bevestigd door ' + g.email, bijgewerkt_op: new Date().toISOString() }).eq('bv', r.bv).eq('exact_nr', r.exact_nr).eq('shiftbase_id', r.shiftbase_id);
      await logActie({ door: g.email, actie: 'koppel', bron: 'loonstroken', veld: 'bevestigd', naam: r.naam, details: r.naam_strook + ' · ' + r.bv + ' · Exact ' + r.exact_nr });
    }
    return { aantal: rijen.length };
  }

  if (p.actie === 'open') {
    const [r] = await haalRijen(db, p.id);
    const { data, error } = await db.storage.from(L.BUCKET).createSignedUrl(r.pad, 120, { download: L.bestandsnaam(r.naam || r.naam_strook, r.periode) });
    if (error) throw new Error('Opslag: ' + error.message);
    await logActie({ door: g.email, actie: 'inzage', bron: 'loonstroken', veld: 'open', naam: r.naam || r.naam_strook, details: r.periode + ' · ' + r.bv });
    return { url: data.signedUrl };
  }

  if (p.actie === 'bundel') {
    const rijen = await haalRijen(db, p.ids);
    const pdf = await bundelVan(db, rijen);
    const namen = Array.from(new Set(rijen.map(r => r.naam || r.naam_strook)));
    const per = rijen.map(r => r.periode);
    const filename = namen.length === 1 ? L.bestandsnaam(namen[0], per[0] === per[per.length - 1] ? per[0] : per[0] + '_tm_' + per[per.length - 1]) : 'Salarisspecificaties_' + rijen.length + '.pdf';
    await logActie({ door: g.email, actie: 'export', bron: 'loonstroken', veld: 'bundel', naam: namen.join(', ').slice(0, 200), details: rijen.length + ' strook/stroken: ' + Array.from(new Set(per)).join(', ') });
    return { bestand: { filename, content: Buffer.from(pdf).toString('base64') } };
  }

  if (p.actie === 'mail') {
    const rijen = await haalRijen(db, p.ids);
    const ids = Array.from(new Set(rijen.map(r => r.shiftbase_id || '')));
    if (ids.length !== 1 || !ids[0]) throw new Error('Kies loonstroken van één medewerker die aan Shiftbase gekoppeld is.');
    if (rijen.some(r => r.koppeling === 'voorstel')) throw new Error('Bevestig eerst de koppeling (voorstel) voordat je loonstroken mailt.');
    // e-mailadres altijd vers uit Shiftbase: nooit naar een adres dat iemand zelf opgeeft
    const m = (await SB.getMedewerkers(true)).find(x => x.id === ids[0]);
    if (!m) throw new Error('Medewerker niet (meer) actief in Shiftbase. Download de PDF en stuur hem zelf naar het adres dat bij de salarisadministratie bekend is.');
    const to = String(m.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Geen geldig e-mailadres in Shiftbase voor ' + m.naam + '.');
    const taal = p.taal === 'en' ? 'en' : 'nl', periodes = Array.from(new Set(rijen.map(r => r.periode)));
    const inhoud = mailInhoud(m.voornaam || String(m.naam).split(' ')[0], periodes, taal);
    if (p.preview) return { to, naam: m.naam, subject: inhoud.subject, text: inhoud.text, aantal: rijen.length };
    const pdf = await bundelVan(db, rijen);
    const filename = L.bestandsnaam(m.naam, periodes.length === 1 ? periodes[0] : periodes[0] + '_tm_' + periodes[periodes.length - 1]);
    const id = await M.verstuur({ to, subject: inhoud.subject, text: inhoud.text, html: inhoud.html, attachments: [{ filename, content: Buffer.from(pdf).toString('base64') }], tags: [{ name: 'bron', value: 'loonstroken' }] });
    await M.logMail({ door: g.email, bron: 'loonstroken', type: 'loonstroken', naar: to, naam: m.naam, onderwerp: inhoud.subject, taal: taal.toUpperCase(), resend_id: id });
    await logActie({ door: g.email, actie: 'mail', bron: 'loonstroken', veld: 'mail', naam: m.naam, nieuw: to, details: rijen.length + ' strook/stroken: ' + periodes.join(', ') });
    return { to, naam: m.naam, aantal: rijen.length };
  }

  if (p.actie === 'verwijder') {
    const [r] = await haalRijen(db, p.id);
    await db.storage.from(L.BUCKET).remove([r.pad]);
    const { error } = await db.from('hr_loonstroken').delete().eq('id', r.id);
    if (error) throw new Error(error.message);
    await logActie({ door: g.email, actie: 'verwijder', bron: 'loonstroken', veld: 'strook', naam: r.naam || r.naam_strook, details: r.periode + ' · ' + r.bv + ' · ' + r.run });
    return {};
  }
  throw new Error('Onbekende actie');
});
exports._mailInhoud = mailInhoud;
exports.verwerkBron = verwerkBron;
