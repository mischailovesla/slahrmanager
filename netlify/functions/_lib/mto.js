// ============================================================
// Fase 5: medewerkertevredenheidsonderzoek (MTO) — 2x per jaar een ronde voor iedereen in dienst.
// - start(): HR drukt op "Ronde starten" → uitnodiging per actieve medewerker uit Shiftbase (niet: wie al bij ontslag staat,
//   wie geen e-mailadres heeft). Groep 'manager' = functie met "manager" erin ((junior) store manager), anders 'medewerker'.
// - versturenDeel(): verstuurt openstaande uitnodigingen in blokken van 100 (Resend batch); het dashboard roept dit herhaald
//   aan tot alles weg is, sched-mto pakt een eventuele rest op.
// - sched-mto (dagelijks): herinnering na 7 en 14 dagen aan wie nog niet invulde, ronde dicht na 21 dagen, en in februari en
//   september één mail aan HR dat het tijd is voor een nieuwe ronde.
// - ANONIEM: een reactie wordt opgeslagen met alleen winkel + groep (geen medewerker, uitnodiging of tijdstip). Op de
//   uitnodiging komt alleen ingevuld = true. Rapporten tonen een groep pas vanaf MTO_MIN_N reacties.
// ============================================================
const C = require('./config');
const U = require('./uploads');
const T = require('./sjablonen');
const M = require('./mail');
const I = require('./instellingen');
const Q = require('./mto-vragen');
const { admin } = require('./auth');

const MIN_N = C.MTO_MIN_N || 4;
const LOOPTIJD = C.MTO_LOOPTIJD_DAGEN || 21;
const HERINNER = C.MTO_HERINNERING_DAGEN || [7, 14];
const MAANDEN = C.MTO_MAANDEN || [2, 9];
const F = 'font-family:Arial,sans-serif;', P14 = F + 'font-size:14px;color:#333d3a;';
const esc = T.esc;
const isoNL = d => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const fmt = d => d ? new Date(d).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtLang = (d, en) => new Date(d).toLocaleDateString(en ? 'en-GB' : 'nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' });
const voornaam = n => String(n || '').trim().split(/\s+/)[0] || '';
const ontvangers = () => ((C.SIGNALERING_ONTVANGERS || {}).mto || C.HR_EMAIL).split(',').map(s => s.trim()).filter(Boolean);
const isManager = functie => /manager/i.test(String(functie || ''));
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const fout = (e, wat) => { if (e) throw new Error(wat + ': ' + e.message + (/relation|does not exist/i.test(e.message) ? ' (migratie 0015 gedraaid?)' : '')); };

function rondeNaam(d) {
  const m = Number(isoNL(d).slice(5, 7)), j = isoNL(d).slice(0, 4);
  return 'MTO ' + (m <= 6 ? 'voorjaar ' : 'najaar ') + j;
}
function link(id) { return U.site() + '/mto.html?t=' + U.tekenToken({ s: 'mto', i: String(id) }); }
function leesToken(t) {
  const d = U.leesGetekend(t, 'Ongeldige link. / Invalid link.');
  if (d.s !== 'mto' || !d.i) throw new Error('Ongeldige link. / Invalid link.');
  return d;
}

// ---------- Mails (tweetalig: de taal van de medewerker kennen we niet) ----------
function onderwerp(soort) {
  if (soort === 'herinnering2') return 'Laatste kans: jouw mening over SLA / Last chance: your opinion about SLA';
  if (soort === 'herinnering1') return 'Herinnering: hoe tevreden ben jij bij SLA? / Reminder: how happy are you at SLA?';
  return 'Hoe tevreden ben jij bij SLA? / How happy are you at SLA?';
}
function teksten(soort, sluit) {
  const nl = soort === 'herinnering2' ? 'Nog een paar dagen: het tevredenheidsonderzoek sluit op <strong>' + fmtLang(sluit) + '</strong>. Heb je hem nog niet ingevuld? We horen graag van jou, ook als je weinig tijd hebt.'
    : soort === 'herinnering1' ? 'Vorige week vroegen we je mening over het werken bij SLA. Heb je hem nog niet ingevuld? Het kan nog tot en met <strong>' + fmtLang(sluit) + '</strong>.'
      : 'Twee keer per jaar vragen we iedereen bij SLA hoe het werken bij ons bevalt. Wat gaat goed, en wat kan beter? Met jouw antwoorden kiezen we waar we de komende maanden aan gaan werken, per winkel en voor heel SLA.';
  const en = soort === 'herinnering2' ? 'Just a few days left: the survey closes on <strong>' + fmtLang(sluit, true) + '</strong>. Not filled it in yet? We would love to hear from you, even if you are short on time.'
    : soort === 'herinnering1' ? 'Last week we asked for your opinion about working at SLA. Not filled it in yet? You can until <strong>' + fmtLang(sluit, true) + '</strong>.'
      : 'Twice a year we ask everyone at SLA how they like working with us. What is going well, and what could be better? Your answers help us choose what to work on in the coming months, per store and for all of SLA.';
  return { nl, en };
}
const knop = (url, txt) => '<a href="' + url + '" style="display:inline-block;background:#009f4b;color:#fff;' + F + 'font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">' + txt + '</a>';
function mailHtml(naam, url, soort, sluit) {
  const v = esc(voornaam(naam)), t = teksten(soort, sluit);
  const anon = (nl) => '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0">' + (nl ? '<strong>Anoniem.</strong> Je antwoorden worden opgeslagen zonder je naam. We kijken alleen naar groepen van minstens ' + MIN_N + ' collega’s, dus niemand (ook je leidinggevende niet) kan zien wat jij hebt ingevuld. Ongeveer 7 minuten.' : '<strong>Anonymous.</strong> Your answers are stored without your name. We only look at groups of at least ' + MIN_N + ' colleagues, so nobody (not even your manager) can see what you answered. About 7 minutes.') + '</p></td></tr></table>';
  const blok = (groet, tekst, nl, knopTxt) => '<p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 14px">' + groet + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 18px">' + tekst + '</p>' + anon(nl) + '<p style="margin:0 0 28px">' + knop(url, knopTxt) + '</p>';
  return T.slaWrap(T.slaHead('#009f4b', 'Tevredenheidsonderzoek &middot; Employee survey') + '<tr><td style="padding:32px 36px 28px">'
    + blok('Hoi ' + v + ',', t.nl, true, '&rarr; Vragenlijst invullen')
    + '<hr style="border:0;border-top:1px solid #e8e2de;margin:0 0 22px">'
    + blok('Hi ' + v + ',', t.en, false, '&rarr; Fill in the survey')
    + '<p style="' + P14 + 'margin:0">Bedankt / Thank you!<br><strong>Het HR-team van SLA</strong></p></td></tr>' + T.slaFoot());
}
function mailPlain(naam, url, soort, sluit) {
  const v = voornaam(naam), t = teksten(soort, sluit), strip = s => s.replace(/<[^>]+>/g, '');
  return 'Hoi ' + v + ',\n\n' + strip(t.nl) + '\n\nAnoniem: je antwoorden worden opgeslagen zonder je naam. We kijken alleen naar groepen van minstens ' + MIN_N + ' collega’s. Ongeveer 7 minuten.\n\nInvullen: ' + url + '\n\n---\n\nHi ' + v + ',\n\n' + strip(t.en) + '\n\nAnonymous: your answers are stored without your name. We only look at groups of at least ' + MIN_N + ' colleagues. About 7 minutes.\n\nFill in: ' + url + '\n\nBedankt / Thank you!\nHet HR-team van SLA';
}

// ---------- Rondes ----------
async function rondes() {
  const db = admin();
  const { data, error } = await db.from('hr_mto_ronde').select('*').order('gestart_op', { ascending: false });
  fout(error, 'MTO-rondes lezen');
  const ids = (data || []).map(r => r.id); if (!ids.length) return [];
  const [u, re] = await Promise.all([db.from('hr_mto_uitnodiging').select('ronde_id,verstuurd_op,ingevuld,herinnerd_1,herinnerd_2,fout').in('ronde_id', ids), db.from('hr_mto_reactie').select('ronde_id').in('ronde_id', ids)]);
  fout(u.error, 'MTO-uitnodigingen lezen'); fout(re.error, 'MTO-reacties lezen');
  return data.map(r => {
    const ui = (u.data || []).filter(x => x.ronde_id === r.id), n = (re.data || []).filter(x => x.ronde_id === r.id).length;
    return { id: r.id, naam: r.naam, bron: r.bron, status: r.status, gestart: fmt(r.gestart_op), gestartIso: r.gestart_op, gestartDoor: r.gestart_door, sluit: fmt(r.sluit_op), sluitIso: r.sluit_op, gesloten: fmt(r.gesloten_op), opmerking: r.opmerking,
      uitgenodigd: ui.length, verstuurd: ui.filter(x => x.verstuurd_op).length, teVersturen: ui.filter(x => !x.verstuurd_op && !x.fout).length, mislukt: ui.filter(x => x.fout).length,
      ingevuld: ui.filter(x => x.ingevuld).length, herinnerd1: ui.filter(x => x.herinnerd_1).length, herinnerd2: ui.filter(x => x.herinnerd_2).length, reacties: n,
      respons: ui.length ? Math.round(ui.filter(x => x.ingevuld).length / ui.length * 100) : null,
      dagOpen: r.status === 'open' ? Math.floor((Date.now() - new Date(r.gestart_op).getTime()) / 864e5) : null };
  });
}
async function openRonde() {
  const { data, error } = await admin().from('hr_mto_ronde').select('*').eq('status', 'open').order('gestart_op', { ascending: false }).limit(1);
  fout(error, 'MTO-ronde lezen');
  return (data || [])[0] || null;
}

// Wie krijgt een uitnodiging: iedereen in dienst (Shiftbase), behalve vertrekkers en wie geen e-mailadres heeft
async function kandidaten() {
  const SB = require('./shiftbase'), SIG = require('./signaleringen');
  const med = await SB.getMedewerkers(true);
  let vertrek = new Set(); try { vertrek = await SIG.vertrekkers(); } catch (e) { console.warn('mto vertrekkers:', e.message); }
  const uit = [], zonder = [], weg = [];
  for (const m of med) {
    const email = String(m.email || '').trim().toLowerCase();
    const k = { medewerker_id: String(m.id), naam: m.naam, email, winkel: m.winkelNaam || '', groep: isManager(m.functie) ? 'manager' : 'medewerker', functie: m.functie || '' };
    if (SIG.vertrekt(vertrek, k)) { weg.push(k); continue; }
    if (email.indexOf('@') === -1) { zonder.push(k); continue; }
    uit.push(k);
  }
  return { uit: uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl')), zonderEmail: zonder, vertrekkers: weg };
}

async function start(door, naam) {
  if (await openRonde()) throw new Error('Er loopt al een MTO-ronde. Sluit die eerst (of wacht tot hij na ' + LOOPTIJD + ' dagen vanzelf sluit).');
  const k = await kandidaten();
  if (!k.uit.length) throw new Error('Geen medewerkers met een e-mailadres gevonden in Shiftbase.');
  const db = admin(), nu = new Date();
  const sluit = new Date(nu.getTime() + LOOPTIJD * 864e5); sluit.setHours(23, 59, 0, 0);
  const { data, error } = await db.from('hr_mto_ronde').insert({ naam: String(naam || '').trim() || rondeNaam(nu), gestart_door: door || '', sluit_op: sluit.toISOString(), opmerking: k.zonderEmail.length ? k.zonderEmail.length + ' medewerker(s) zonder e-mailadres overgeslagen' : '' }).select('*');
  fout(error, 'Ronde aanmaken');
  const ronde = data[0];
  for (let i = 0; i < k.uit.length; i += 200) {
    const { error: e2 } = await db.from('hr_mto_uitnodiging').insert(k.uit.slice(i, i + 200).map(x => ({ ronde_id: ronde.id, medewerker_id: x.medewerker_id, naam: x.naam, email: x.email, winkel: x.winkel, groep: x.groep })));
    if (e2) { await db.from('hr_mto_ronde').delete().eq('id', ronde.id); fout(e2, 'Uitnodigingen aanmaken'); }
  }
  return { ronde, aantal: k.uit.length, zonderEmail: k.zonderEmail, vertrekkers: k.vertrekkers.length };
}

// Mails in blokken van 100 (Resend batch). soort: uitnodiging | herinnering1 | herinnering2
async function verstuurBlok(ronde, rijen, soort, door) {
  if (!rijen.length) return 0;
  const db = admin(), sub = onderwerp(soort), nu = new Date().toISOString();
  const mails = rijen.map(r => { const url = link(r.id); return { to: r.email, subject: sub, html: mailHtml(r.naam, url, soort, ronde.sluit_op), text: mailPlain(r.naam, url, soort, ronde.sluit_op), tags: [{ name: 'bron', value: 'mto' }, { name: 'type', value: soort }] }; });
  let ids;
  try { ids = await M.verstuurBatch(mails); }
  catch (e) {
    if (soort === 'uitnodiging' && rijen.length === 1) { await db.from('hr_mto_uitnodiging').update({ fout: e.message.slice(0, 300) }).eq('id', rijen[0].id); return 0; }
    if (soort === 'uitnodiging' && /e-?mail|address|invalid/i.test(e.message)) { let n = 0; for (const r of rijen) n += await verstuurBlok(ronde, [r], soort, door); return n; }
    throw e;
  }
  const veld = soort === 'uitnodiging' ? 'verstuurd_op' : soort === 'herinnering1' ? 'herinnerd_1' : 'herinnerd_2';
  const { error } = await db.from('hr_mto_uitnodiging').update({ [veld]: nu, fout: '' }).in('id', rijen.map(r => r.id));
  if (error) console.warn('mto bijwerken:', error.message);
  try { await db.from('hr_mails').insert(rijen.map((r, i) => ({ door: door || 'signalering', bron: 'mto', type: soort, naar: r.email, naam: r.naam, onderwerp: sub, taal: 'NL/EN', rij: 0, resend_id: (ids || [])[i] || '' }))); } catch (e) { console.warn('hr_mails mto:', e.message); }
  return rijen.length;
}
// Openstaande uitnodigingen versturen binnen een tijdsbudget; geeft { verstuurd, rest }
async function versturenDeel(rondeId, door, budgetMs) {
  const db = admin(), t0 = Date.now(), budget = budgetMs || 7000;
  const { data: rr, error: er } = await db.from('hr_mto_ronde').select('*').eq('id', rondeId).limit(1); fout(er, 'Ronde lezen');
  const ronde = (rr || [])[0]; if (!ronde) throw new Error('Ronde niet gevonden.');
  if (ronde.status !== 'open') throw new Error('Deze ronde is gesloten.');
  let verstuurd = 0;
  while (Date.now() - t0 < budget) {
    const { data, error } = await db.from('hr_mto_uitnodiging').select('id,naam,email').eq('ronde_id', rondeId).is('verstuurd_op', null).eq('fout', '').limit(100);
    fout(error, 'Uitnodigingen lezen');
    if (!data || !data.length) break;
    const n = await verstuurBlok(ronde, data, 'uitnodiging', door);
    verstuurd += n;
    if (!n) break;
  }
  const { count } = await db.from('hr_mto_uitnodiging').select('id', { count: 'exact', head: true }).eq('ronde_id', rondeId).is('verstuurd_op', null).eq('fout', '');
  return { verstuurd, rest: count || 0 };
}
// Wie krijgt vandaag een herinnering (droog = alleen tellen)
async function herinneringen(ronde, droog, door) {
  const db = admin(), uit = [];
  const dagen = (Date.now() - new Date(ronde.gestart_op).getTime()) / 864e5;
  for (let i = 0; i < HERINNER.length; i++) {
    if (dagen < HERINNER[i]) continue;
    const veld = i === 0 ? 'herinnerd_1' : 'herinnerd_2', soort = i === 0 ? 'herinnering1' : 'herinnering2';
    // tweede herinnering alleen als de eerste niet nog gaat (anders twee mails op één dag na een gemiste run)
    if (i === 0 && HERINNER[1] && dagen >= HERINNER[1]) continue;
    const { data, error } = await db.from('hr_mto_uitnodiging').select('id,naam,email').eq('ronde_id', ronde.id).eq('ingevuld', false).not('verstuurd_op', 'is', null).is(veld, null);
    fout(error, 'Herinneringen lezen');
    const lijst = data || [];
    if (droog) { uit.push({ soort, aantal: lijst.length, droog: true }); continue; }
    let n = 0;
    for (let j = 0; j < lijst.length; j += 100) n += await verstuurBlok(ronde, lijst.slice(j, j + 100), soort, door);
    uit.push({ soort, aantal: n });
  }
  return uit;
}
async function sluiten(rondeId, door) {
  const { data, error } = await admin().from('hr_mto_ronde').update({ status: 'gesloten', gesloten_op: new Date().toISOString() }).eq('id', rondeId).eq('status', 'open').select('naam');
  fout(error, 'Ronde sluiten');
  return (data || [])[0] || null;
}
// HR-herinnering in februari/september (één keer per maand), als er die maand nog geen ronde is gestart
async function hrHerinneringNodig() {
  const nu = isoNL(new Date()), maand = Number(nu.slice(5, 7)), sleutel = nu.slice(0, 7);
  if (!MAANDEN.includes(maand)) return null;
  if ((await I.lees('mto_hr_herinnerd', '')) === sleutel) return null;
  const { data } = await admin().from('hr_mto_ronde').select('id').eq('bron', 'dashboard').gte('gestart_op', sleutel + '-01T00:00:00Z').limit(1);
  if (data && data.length) return null;
  return sleutel;
}
async function hrHerinnering(sleutel) {
  const vorige = (await rondes()).filter(r => r.reacties)[0];
  const html = T.slaWrap(T.slaHead('#009f4b', 'HR &middot; Tijd voor het MTO') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">Het is ' + (sleutel.slice(5) === '02' ? 'februari' : 'september') + ': tijd voor de nieuwe ronde van het medewerkertevredenheidsonderzoek. Start hem in het dashboard via <strong>In dienst &rarr; Tevredenheid (MTO) &rarr; Ronde starten</strong>. Iedereen in dienst krijgt dan een uitnodiging, met herinneringen na ' + HERINNER.join(' en ') + ' dagen; na ' + LOOPTIJD + ' dagen sluit de ronde.</p>'
    + (vorige ? '<p style="' + P14 + 'margin:0 0 16px">Vorige ronde: <strong>' + esc(vorige.naam) + '</strong> (' + vorige.reacties + ' reacties' + (vorige.respons != null ? ', respons ' + vorige.respons + '%' : '') + ').</p>' : '')
    + '<p style="margin:0">' + knop(U.site() + '/', '&rarr; Naar het dashboard') + '</p></td></tr>' + T.slaFoot());
  const subject = 'Tijd voor het MTO (' + (sleutel.slice(5) === '02' ? 'voorjaar' : 'najaar') + ' ' + sleutel.slice(0, 4) + ')';
  const id = await M.verstuur({ to: ontvangers(), subject, html, text: 'Tijd voor de nieuwe MTO-ronde. Start hem in het dashboard: In dienst → Tevredenheid (MTO) → Ronde starten.', tags: [{ name: 'bron', value: 'mto' }, { name: 'type', value: 'hr-herinnering' }] });
  await I.schrijf('mto_hr_herinnerd', sleutel, 'signalering');
  await M.logMail({ door: 'signalering', bron: 'mto', type: 'hr-herinnering', naar: ontvangers().join(','), naam: '', onderwerp: subject, taal: 'NL', rij: 0, resend_id: id });
  return id;
}

// ---------- Invullen ----------
async function uitnodigingVoor(tok) {
  const db = admin();
  const { data, error } = await db.from('hr_mto_uitnodiging').select('id,ronde_id,naam,winkel,groep,ingevuld').eq('id', tok.i).limit(1);
  fout(error, 'Link controleren');
  const u = (data || [])[0]; if (!u) throw new Error('Ongeldige link. / Invalid link.');
  const { data: rr } = await db.from('hr_mto_ronde').select('id,naam,status,sluit_op').eq('id', u.ronde_id).limit(1);
  return { u, ronde: (rr || [])[0] || null };
}
async function opslaan(tok, p, taal) {
  const en = String(taal).toUpperCase() === 'EN';
  const { u, ronde } = await uitnodigingVoor(tok);
  if (!ronde || ronde.status !== 'open') throw new Error(en ? 'This survey round has closed. Thank you for your interest!' : 'Deze ronde is gesloten. Bedankt voor je interesse!');
  const a = Q.valideer(p, taal);
  const db = admin();
  // eerst de uitnodiging 'claimen' (voorkomt dubbel invullen bij twee keer klikken)
  const { data: cl, error: ec } = await db.from('hr_mto_uitnodiging').update({ ingevuld: true }).eq('id', u.id).eq('ingevuld', false).select('id');
  fout(ec, 'Opslaan');
  if (!cl || !cl.length) throw new Error(en ? 'You have already filled in this survey. Thank you!' : 'Je hebt de vragenlijst al ingevuld. Bedankt!');
  const { error } = await db.from('hr_mto_reactie').insert({ ronde_id: u.ronde_id, winkel: u.winkel || '', groep: u.groep || 'medewerker', taal: en ? 'EN' : 'NL', antwoorden: a.antwoorden, enps: a.enps, prioriteit: a.prioriteit, opmerking: a.opmerking, bron: 'link' });
  if (error) { await db.from('hr_mto_uitnodiging').update({ ingevuld: false }).eq('id', u.id); fout(error, 'Opslaan'); }
  return { ronde: ronde.naam };
}

// ---------- Nulmeting (Google Forms februari 2026) ----------
async function importNulmeting(door) {
  const N = require('./mto-nulmeting-2026-02.json'), db = admin();
  const { data: al } = await db.from('hr_mto_ronde').select('id').eq('bron', 'import').eq('naam', N.naam).limit(1);
  if (al && al.length) throw new Error('De nulmeting is al geïmporteerd.');
  const { data, error } = await db.from('hr_mto_ronde').insert({ naam: N.naam, bron: 'import', gestart_op: N.start + 'T09:00:00Z', gestart_door: door || '', sluit_op: N.sluit + 'T21:59:00Z', gesloten_op: N.sluit + 'T21:59:00Z', status: 'gesloten', opmerking: N.opmerking }).select('id');
  fout(error, 'Nulmeting-ronde aanmaken');
  const id = data[0].id;
  const rijen = N.reacties.map(r => { const a = {}; Q.SLEUTELS.forEach((k, i) => { a[k] = Number(r.a[i]); }); return { ronde_id: id, winkel: r.w || '', groep: r.g, taal: r.t, antwoorden: a, enps: r.e, prioriteit: r.p, opmerking: '', bron: 'import' }; });
  const { error: e2 } = await db.from('hr_mto_reactie').insert(rijen);
  if (e2) { await db.from('hr_mto_ronde').delete().eq('id', id); fout(e2, 'Nulmeting importeren'); }
  return { id, aantal: rijen.length, naam: N.naam };
}

// ---------- Rapport ----------
const gem = l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
function aggregeer(lijst, metVragen) {
  const n = lijst.length;
  if (n < MIN_N) return { n, verborgen: n > 0 };
  const perVraag = {}, perThema = {};
  Q.SLEUTELS.forEach(k => {
    const w = lijst.map(r => Number((r.antwoorden || {})[k])).filter(x => x >= 1 && x <= 5);
    perVraag[k] = { gem: r1(gem(w)), pos: w.length ? Math.round(w.filter(x => x >= 4).length / w.length * 100) : null, neg: w.length ? Math.round(w.filter(x => x <= 2).length / w.length * 100) : null };
  });
  Q.THEMAS.forEach(t => { perThema[t.key] = r1(gem(t.vragen.map(v => perVraag[v[0]].gem).filter(x => x != null))); });
  const e = lijst.map(r => r.enps).filter(x => x != null && x >= 0);
  const pro = e.filter(x => x >= 9).length, det = e.filter(x => x <= 6).length;
  const prio = {}; Q.THEMAS.forEach(t => { prio[t.key] = 0; }); lijst.forEach(r => { if (prio[r.prioriteit] != null) prio[r.prioriteit]++; });
  const taal = { NL: lijst.filter(r => r.taal !== 'EN').length, EN: lijst.filter(r => r.taal === 'EN').length };
  const uit = { n, taal, totaal: r1(gem(Object.values(perThema).filter(x => x != null))), perThema, enps: e.length ? Math.round((pro - det) / e.length * 100) : null, enpsAantal: { promoter: pro, passief: e.length - pro - det, criticus: det },
    enpsVerdeling: e.length ? { promoter: Math.round(pro / e.length * 100), passief: Math.round((e.length - pro - det) / e.length * 100), criticus: Math.round(det / e.length * 100) } : null,
    prioriteit: Object.keys(prio).map(k => ({ key: k, n: prio[k], pct: Math.round(prio[k] / n * 100) })).sort((a, b) => b.n - a.n) };
  if (metVragen) uit.perVraag = perVraag;
  return uit;
}
const normW = s => String(s || '').trim().toLowerCase();
function filter(lijst, groep, winkel) { return lijst.filter(r => (!groep || groep === 'alle' || r.groep === groep) && (!winkel || normW(r.winkel) === normW(winkel))); }

async function rapport(rondeId, groep, winkel) {
  const db = admin(), alle = await rondes();
  const ronde = alle.find(r => r.id === rondeId) || alle.find(r => r.reacties) || alle[0];
  if (!ronde) return { ronde: null, rondes: [], minN: MIN_N };
  const ids = alle.map(r => r.id);
  const [re, ui] = await Promise.all([db.from('hr_mto_reactie').select('ronde_id,winkel,groep,taal,antwoorden,enps,prioriteit,opmerking').in('ronde_id', ids), db.from('hr_mto_uitnodiging').select('ronde_id,winkel,groep,ingevuld').eq('ronde_id', ronde.id)]);
  fout(re.error, 'Reacties lezen'); fout(ui.error, 'Uitnodigingen lezen');
  const perRonde = {}; (re.data || []).forEach(r => { (perRonde[r.ronde_id] = perRonde[r.ronde_id] || []).push(r); });
  const hier = perRonde[ronde.id] || [], uitn = ui.data || [];
  const sel = filter(hier, groep, winkel), selU = filter(uitn, groep, winkel);
  const totaal = aggregeer(sel, true);
  const respons = l => l.length ? { uitgenodigd: l.length, ingevuld: l.filter(x => x.ingevuld).length, pct: Math.round(l.filter(x => x.ingevuld).length / l.length * 100) } : null;
  // vorige ronde met reacties (vóór deze) voor vergelijking
  const idx = alle.findIndex(r => r.id === ronde.id), vorigeR = alle.slice(idx + 1).find(r => (perRonde[r.id] || []).length);
  const vorige = vorigeR ? Object.assign({ naam: vorigeR.naam }, aggregeer(filter(perRonde[vorigeR.id], groep, winkel), true)) : null;
  // per winkel (met de gekozen groep)
  const winkels = {}; hier.concat(uitn).forEach(r => { const k = String(r.winkel || '').trim() || '(geen winkel)'; winkels[k] = 1; });
  const perWinkel = Object.keys(winkels).sort((a, b) => a.localeCompare(b, 'nl')).map(w => {
    const ww = w === '(geen winkel)' ? '' : w;
    const lijst = filter(hier, groep, null).filter(r => normW(r.winkel) === normW(ww)), lu = filter(uitn, groep, null).filter(r => normW(r.winkel) === normW(ww));
    const a = aggregeer(lijst, false);
    const vw = vorigeR ? aggregeer(filter(perRonde[vorigeR.id], groep, null).filter(r => normW(r.winkel) === normW(ww)), false) : null;
    return Object.assign({ winkel: w, respons: respons(lu), vorigeTotaal: vw && !vw.verborgen ? vw.totaal : null, vorigeEnps: vw && !vw.verborgen ? vw.enps : null }, a);
  }).filter(w => w.n || (w.respons && w.respons.uitgenodigd));
  // makers vs managers (met het gekozen winkelfilter)
  const groepen = ['medewerker', 'manager'].map(gp => Object.assign({ groep: gp, respons: respons(filter(uitn, gp, winkel)) }, aggregeer(filter(hier, gp, winkel), false)));
  // trend over alle rondes (oud → nieuw)
  const trend = alle.slice().reverse().map(r => { const a = aggregeer(filter(perRonde[r.id] || [], groep, winkel), false); return { id: r.id, naam: r.naam, n: a.n, verborgen: !!a.verborgen, totaal: a.totaal == null ? null : a.totaal, enps: a.enps == null ? null : a.enps }; }).filter(t => t.n);
  // open antwoorden: alleen als de selectie groot genoeg is; gesorteerd (niet in invulvolgorde)
  const opmerkingen = totaal.verborgen || sel.length < MIN_N ? [] : sel.map(r => r.opmerking).filter(Boolean).sort((a, b) => a.localeCompare(b, 'nl'));
  return { ronde, rondes: alle, minN: MIN_N, filter: { groep: groep || 'alle', winkel: winkel || '' }, respons: respons(selU), totaal, vorige, perWinkel, groepen, trend, opmerkingen,
    themas: Q.THEMAS.map(t => ({ key: t.key, nl: t.nl, vragen: t.vragen.map(v => ({ key: v[0], nl: v[1] })) })) };
}

// ---------- PDF-rapporten (per winkel, SLA, of bundel) ----------
// winkel: '' = SLA-rapport · '*' = bundel (SLA + elke winkel met >= MIN_N reacties) · naam = één winkel
async function pdfSecties(rondeId, groep, winkel) {
  groep = groep || 'alle';
  const db = admin(), alle = await rondes();
  const ronde = alle.find(r => r.id === rondeId) || alle.find(r => r.reacties);
  if (!ronde) throw new Error('Geen MTO-ronde met reacties gevonden.');
  const ids = alle.map(r => r.id);
  const [re, ui] = await Promise.all([db.from('hr_mto_reactie').select('ronde_id,winkel,groep,taal,antwoorden,enps,prioriteit,opmerking').in('ronde_id', ids), db.from('hr_mto_uitnodiging').select('ronde_id,winkel,groep,ingevuld').eq('ronde_id', ronde.id)]);
  fout(re.error, 'Reacties lezen'); fout(ui.error, 'Uitnodigingen lezen');
  const perRonde = {}; (re.data || []).forEach(r => { (perRonde[r.ronde_id] = perRonde[r.ronde_id] || []).push(r); });
  const hier = perRonde[ronde.id] || [], uitn = ui.data || [];
  const idx = alle.findIndex(r => r.id === ronde.id), vorigeR = alle.slice(idx + 1).find(r => (perRonde[r.id] || []).length);
  const respons = l => l.length ? { uitgenodigd: l.length, ingevuld: l.filter(x => x.ingevuld).length, pct: Math.round(l.filter(x => x.ingevuld).length / l.length * 100) } : null;
  const sectie = w => {
    const lijst = filter(hier, groep, w || null), a = aggregeer(lijst, true);
    return { winkel: w || '', a, respons: respons(filter(uitn, groep, w || null)), vorige: vorigeR ? aggregeer(filter(perRonde[vorigeR.id], groep, w || null), true) : null,
      opmerkingen: a.verborgen || !a.n ? [] : lijst.map(r => r.opmerking).filter(Boolean).sort((p, q) => p.localeCompare(q, 'nl')) };
  };
  const res = { ronde, groep, minN: MIN_N, vorigeNaam: vorigeR ? vorigeR.naam : '', themas: Q.THEMAS.map(t => ({ key: t.key, nl: t.nl, vragen: t.vragen.map(v => ({ key: v[0], nl: v[1] })) })), sla: sectie('') };
  if (res.sla.a.verborgen || !res.sla.a.n) throw new Error('Te weinig reacties (' + res.sla.a.n + ') voor een rapport over ' + (groep === 'alle' ? 'deze ronde' : 'deze groep') + '.');
  const namen = Array.from(new Set(hier.map(r => String(r.winkel || '').trim()).filter(Boolean))).sort((p, q) => p.localeCompare(q, 'nl'));
  if (winkel && winkel !== '*') {
    const s = sectie(winkel);
    if (s.a.verborgen || !s.a.n) throw new Error(winkel + ' heeft ' + s.a.n + ' reactie' + (s.a.n === 1 ? '' : 's') + (groep !== 'alle' ? ' in deze groep' : '') + ': een rapport kan pas vanaf ' + MIN_N + ' reacties (anonimiteit).');
    res.winkels = [s]; res.alleenWinkel = true; return res;
  }
  const perWinkel = namen.map(sectie);
  res.perWinkel = perWinkel;
  res.groepen = ['medewerker', 'manager'].map(gp => ({ groep: gp, a: aggregeer(filter(hier, gp, null), false), respons: respons(filter(uitn, gp, null)) }));
  res.trend = alle.slice(idx).reverse().map(r => { const a = aggregeer(filter(perRonde[r.id] || [], groep, null), false); return { naam: r.naam, n: a.n, verborgen: !!a.verborgen, totaal: a.totaal, enps: a.enps }; }).filter(x => x.n);
  if (winkel === '*') { res.bundel = true; res.winkels = perWinkel.filter(w => !w.a.verborgen && w.a.n); res.overgeslagen = perWinkel.filter(w => w.a.verborgen || !w.a.n).map(w => ({ winkel: w.winkel, n: w.a.n })); }
  return res;
}

// CSV-export (anoniem: per reactie alleen winkel, groep, taal, scores) — alleen groepen met ≥ MIN_N reacties
async function exportCsv(rondeId) {
  const { data, error } = await admin().from('hr_mto_reactie').select('winkel,groep,taal,antwoorden,enps,prioriteit').eq('ronde_id', rondeId);
  fout(error, 'Export');
  const tel = {}; (data || []).forEach(r => { const k = r.winkel + '|' + r.groep; tel[k] = (tel[k] || 0) + 1; });
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const kop = ['winkel', 'groep', 'taal'].concat(Q.SLEUTELS, ['enps', 'prioriteit']);
  const rijen = (data || []).map(r => { const klein = tel[r.winkel + '|' + r.groep] < MIN_N; return [klein ? '(kleine groep)' : r.winkel, r.groep, r.taal].concat(Q.SLEUTELS.map(k => (r.antwoorden || {})[k]), [r.enps, r.prioriteit]); });
  rijen.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  return [kop].concat(rijen).map(r => r.map(q).join(';')).join('\n');
}

module.exports = { MIN_N, LOOPTIJD, HERINNER, MAANDEN, rondeNaam, link, leesToken, onderwerp, mailHtml, mailPlain, rondes, openRonde, kandidaten, start, versturenDeel, herinneringen, sluiten, hrHerinneringNodig, hrHerinnering, uitnodigingVoor, opslaan, importNulmeting, aggregeer, rapport, pdfSecties, exportCsv, isManager };
