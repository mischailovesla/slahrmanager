// ============================================================
// Fase 3a: check-in na 30 en 60 dagen in dienst — vroege uitstroom voor zijn.
// - Eén rij in hr_checkin per uitnodiging (medewerker × moment); de link verwijst naar die rij (token {s:'checkin', i:id}).
// - actief(): schakelaar 'checkin_actief' in hr_instellingen (migratie 0011 zet hem uit). Uit = geen uitnodigingen, pagina dicht.
// - vragenConfig(): 'checkin_vragen' in hr_instellingen, anders config.CHECKIN_VRAGEN (zelfde editor als de exit-survey).
// - kandidaten(): wie vandaag (binnen het venster) een uitnodiging zou moeten krijgen; komende(): wie binnenkort aan de beurt is.
// - opslaan(): antwoorden bewaren, score = gemiddelde van de schaalvragen; laag = een schaalantwoord ≤ CHECKIN_LAAG_SCHAAL
//   of een alarm-optie (bijv. "Zie je jezelf over een halfjaar nog bij SLA?" → Nee) → direct een mail aan HR + taak op het Overzicht.
// Niet anoniem (HR volgt op), en de Store Manager ziet de antwoorden niet — zo staat het ook op de pagina.
// ============================================================
const C = require('./config');
const U = require('./uploads');
const I = require('./instellingen');
const V = require('./vragenlijst');
const T = require('./sjablonen');
const M = require('./mail');
const { admin } = require('./auth');
const { parseNLDatum, normNaam } = require('./util');

const vandaagIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const vandaag0 = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); d.setHours(0, 0, 0, 0); return d; };
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const ddmm = d => String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
const ontvangers = () => (C.SIGNALERING_ONTVANGERS.checkin || C.HR_EMAIL).split(',').map(s => s.trim()).filter(Boolean);

async function actief() { return (await I.lees('checkin_actief', false)) === true; }
async function vragenConfig() {
  const v = await I.lees('checkin_vragen', null);
  return Array.isArray(v) && v.length ? v : C.CHECKIN_VRAGEN;
}

function link(id) { return U.site() + '/checkin.html?t=' + U.tekenToken({ s: 'checkin', i: String(id), d: vandaagIso() }); }
function leesToken(t) {
  const d = U.leesGetekend(t, 'Ongeldige link.');
  if (d.s !== 'checkin' || !d.i) throw new Error('Ongeldige link.');
  const verstuurd = dag(d.d); if (!verstuurd) throw new Error('Ongeldige link.');
  if (d.i !== 'voorbeeld' && (Date.now() - verstuurd.getTime()) / 864e5 > C.CHECKIN_GELDIG_DAGEN) throw new Error('Deze link is verlopen. / This link has expired.');
  return d;
}

// Bestaande uitnodigingen als set 'medewerker_id|moment'
async function bestaande() {
  const { data, error } = await admin().from('hr_checkin').select('id,medewerker_id,naam,moment');
  if (error) throw new Error(error.message + ' (migratie 0011 gedraaid?)');
  const s = new Set();
  (data || []).forEach(r => { s.add(String(r.medewerker_id || '') + '|' + r.moment); s.add('n:' + normNaam(r.naam) + '|' + r.moment); });
  return s;
}
function heeftAl(set, m, moment) { return set.has(String(m.id) + '|' + moment) || set.has('n:' + normNaam(m.naam) + '|' + moment); }

// Wie moet er vandaag een uitnodiging krijgen: dagen in dienst ∈ [moment, moment + venster)
function kandidaten(med, set, vandaag) {
  vandaag = vandaag || vandaag0();
  const uit = [];
  for (const m of med || []) {
    const start = parseNLDatum(m.indienst); if (!start) continue;
    const dagen = Math.floor((vandaag - start) / 864e5);
    for (const moment of C.CHECKIN_MOMENTEN) {
      if (dagen < moment || dagen >= moment + C.CHECKIN_VENSTER_DAGEN) continue;
      if (heeftAl(set, m, moment)) continue;
      uit.push({ medewerker_id: String(m.id), naam: m.naam, email: String(m.email || '').trim().toLowerCase(), winkel: m.winkelNaam || '', bv: m.winkelBv || '', indienst: m.indienst, moment, dagen, zonderEmail: !m.email });
    }
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}
// Wie is er de komende `dagenVooruit` dagen aan de beurt
function komende(med, set, vandaag, dagenVooruit) {
  vandaag = vandaag || vandaag0(); dagenVooruit = dagenVooruit || 14;
  const uit = [];
  for (const m of med || []) {
    const start = parseNLDatum(m.indienst); if (!start) continue;
    const dagen = Math.floor((vandaag - start) / 864e5);
    for (const moment of C.CHECKIN_MOMENTEN) {
      const over = moment - dagen;
      if (over <= 0 || over > dagenVooruit || heeftAl(set, m, moment)) continue;
      const op = new Date(start.getTime()); op.setDate(op.getDate() + moment);
      uit.push({ medewerker_id: String(m.id), naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '', indienst: m.indienst, moment, over, op: ddmm(op) });
    }
  }
  return uit.sort((a, b) => a.over - b.over);
}

// Gemist: moment (dag 30/60) viel in de laatste `dagenTerug` dagen (t/m vandaag) maar er is nog geen uitnodiging —
// bijv. omdat de check-in toen nog uit stond. Voor handmatig nasturen vanuit het dashboard.
function gemist(med, set, vandaag, dagenTerug) {
  vandaag = vandaag || vandaag0(); dagenTerug = dagenTerug || 31;
  const uit = [];
  for (const m of med || []) {
    const start = parseNLDatum(m.indienst); if (!start) continue;
    const dagen = Math.floor((vandaag - start) / 864e5);
    for (const moment of C.CHECKIN_MOMENTEN) {
      const geleden = dagen - moment; // 0 = vandaag
      if (geleden < 0 || geleden > dagenTerug || heeftAl(set, m, moment)) continue;
      const op = new Date(start.getTime()); op.setDate(op.getDate() + moment);
      uit.push({ medewerker_id: String(m.id), naam: m.naam, email: String(m.email || '').trim().toLowerCase(), winkel: m.winkelNaam || '', indienst: m.indienst, moment, geleden, op: ddmm(op), zonderEmail: !m.email });
    }
  }
  return uit.sort((a, b) => a.geleden - b.geleden || a.naam.localeCompare(b.naam, 'nl'));
}

// Uitnodigen: rij aanmaken (id = token), mail sturen; mislukt de mail, dan rij weer weg
async function uitnodigen(k, door, bron) {
  if (!k.email || k.email.indexOf('@') === -1) throw new Error('Geen geldig e-mailadres voor ' + k.naam);
  const db = admin();
  const { data, error } = await db.from('hr_checkin').insert({ medewerker_id: k.medewerker_id || null, naam: k.naam, email: k.email, winkel: k.winkel || '', bv: k.bv || '', indienst: k.indienst || '', moment: k.moment, bron: bron || 'schedule', verstuurd_door: door || 'signalering' }).select('id');
  if (error) throw new Error('Uitnodiging registreren mislukt: ' + error.message);
  const id = data[0].id, url = link(id);
  try {
    const resendId = await M.verstuur({ to: k.email, subject: T.checkinOnderwerp(false), text: T.checkinPlain(k.naam, url, false), html: T.checkinHtml(k.naam, url, false), tags: [{ name: 'bron', value: 'checkin' }, { name: 'type', value: 'dag' + k.moment }] });
    await M.logMail({ door: door || 'signalering', bron: 'checkin', type: 'dag' + k.moment, naar: k.email, naam: k.naam, onderwerp: T.checkinOnderwerp(false), taal: 'NL/EN', rij: 0, resend_id: resendId });
  } catch (e) { await db.from('hr_checkin').delete().eq('id', id); throw e; }
  return { id, link: url };
}
async function herinneren(r, door) {
  const url = link(r.id);
  const resendId = await M.verstuur({ to: r.email, subject: T.checkinOnderwerp(true), text: T.checkinPlain(r.naam, url, true), html: T.checkinHtml(r.naam, url, true), tags: [{ name: 'bron', value: 'checkin' }, { name: 'type', value: 'herinnering' }] });
  await admin().from('hr_checkin').update({ herinnerd_op: new Date().toISOString() }).eq('id', r.id);
  await M.logMail({ door: door || 'signalering', bron: 'checkin', type: 'herinnering', naar: r.email, naam: r.naam, onderwerp: T.checkinOnderwerp(true), taal: 'NL/EN', rij: 0, resend_id: resendId });
}

async function rijVoor(tok) {
  const { data, error } = await admin().from('hr_checkin').select('*').eq('id', tok.i).limit(1);
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Ongeldige link.');
  return data[0];
}
// Antwoorden opslaan; geeft { laag, score, rij }
async function opslaan(tok, antwoorden, taal) {
  const r = await rijVoor(tok);
  if (r.ingevuld_op) throw new Error(String(taal).toUpperCase() === 'EN' ? 'You have already filled in this check-in. Thank you!' : 'Je hebt deze check-in al ingevuld. Bedankt!');
  const lijst = await vragenConfig();
  const { uit, opmerking, schalen, alarmen } = V.valideer(antwoorden, lijst);
  const score = schalen.length ? Math.round(schalen.reduce((a, x) => a + x.n, 0) / schalen.length * 10) / 10 : null;
  const laagSchaal = schalen.filter(x => x.n <= C.CHECKIN_LAAG_SCHAAL);
  const laag = laagSchaal.length > 0 || alarmen.length > 0;
  const reden = alarmen.map(a => a.vraag + ' → ' + a.label).concat(laagSchaal.map(x => x.vraag + ' → ' + x.n + '/5')).join(' · ');
  const upd = { antwoorden: uit, ingevuld_op: new Date().toISOString(), taal: String(taal || 'NL').toUpperCase() === 'EN' ? 'EN' : 'NL', score, laag, laag_reden: reden.slice(0, 1000), opmerking };
  const { error } = await admin().from('hr_checkin').update(upd).eq('id', r.id);
  if (error) throw new Error('Opslaan mislukt: ' + error.message);
  const rij = Object.assign({}, r, upd);
  if (laag) { try { await meldLaag(rij); } catch (e) { console.warn('checkin meldLaag:', e.message); } }
  return { laag, score, rij };
}
// Direct een mail aan HR bij een lage check-in (geen dagelijkse digest)
async function meldLaag(r) {
  const F = 'font-family:Arial,sans-serif;', esc = T.esc;
  const regels = String(r.laag_reden || '').split(' · ').filter(Boolean);
  const html = T.slaWrap(T.slaHead('#c0392b', 'HR &middot; Check-in: even bellen') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 16px"><strong>' + esc(r.naam) + '</strong> (' + esc(r.winkel || '-') + ', in dienst sinds ' + esc(r.indienst || '?') + ') vulde de check-in van dag ' + r.moment + ' in met een lage score' + (r.score != null ? ' (gemiddeld ' + String(r.score).replace('.', ',') + ' / 5)' : '') + ':</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="padding:14px 16px;background:#fdecea;border-radius:8px;border-left:4px solid #c0392b">' + regels.map(x => '<p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 4px">' + esc(x) + '</p>').join('') + (r.opmerking ? '<p style="' + F + 'font-size:13px;color:#333d3a;margin:8px 0 0"><em>&ldquo;' + esc(r.opmerking) + '&rdquo;</em></p>' : '') + '</td></tr></table>'
    + '<p style="' + F + 'font-size:14px;color:#333d3a;margin:0">Neem contact op en zet daarna in het dashboard op <strong>Opgevolgd</strong> (Overzicht &rarr; takenlijst, of Instroom &rarr; Check-in 30/60).</p></td></tr>' + T.slaFoot());
  const text = r.naam + ' (' + (r.winkel || '-') + ') vulde de check-in van dag ' + r.moment + ' in met een lage score.\n' + regels.join('\n') + (r.opmerking ? '\n"' + r.opmerking + '"' : '') + '\n\nNeem contact op en zet daarna op Opgevolgd in het dashboard.';
  const subject = 'Check-in dag ' + r.moment + ': lage score — ' + r.naam + ' (' + (r.winkel || '-') + ')';
  const naar = /keuken/i.test(String(r.winkel || '')) && C.KEUKEN_EMAIL ? String(C.KEUKEN_EMAIL).split(',').map(x => x.trim()) : ontvangers(); // v0.25.7: keuken -> Jop
  const resendId = await M.verstuur({ to: naar, subject, text, html, tags: [{ name: 'bron', value: 'checkin' }, { name: 'type', value: 'laag' }] });
  await M.logMail({ door: 'checkin', bron: 'checkin', type: 'laag', naar: naar.join(','), naam: r.naam, onderwerp: subject, taal: 'NL', rij: 0, resend_id: resendId });
}

module.exports = { actief, vragenConfig, link, leesToken, bestaande, kandidaten, komende, gemist, uitnodigen, herinneren, rijVoor, opslaan, meldLaag, vandaag0 };
