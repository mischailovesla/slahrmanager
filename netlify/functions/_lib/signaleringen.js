// ============================================================
// Automatische checks (stap 4) — port van de Apps Script-triggers:
//   syncFormulierStatus (4-uurlijks), checkLoonheffingHerinneringen (09:00),
//   checkOntslagHerinneringen (09:15), checkNieuweMedewerkers (09:45),
//   checkAanzegtermijnen (09:50), checkStilleAfwezigen (ma 10:00), checkWeekendBeschikbaarheid (ma 09:45).
// Elke check geeft een rapport terug: { naam, gevonden:[...], verstuurd:[...], droog, fouten:[] }.
// DROOGLOOP: zolang env SIGNALERINGEN_ACTIEF niet '1' is wordt er niets gemaild
// en niets in de sheets geschreven — alleen gerapporteerd. Zo kun je de Netlify-
// versie naast Apps Script laten meedraaien en daarna in één keer omschakelen
// (env var aan + Apps Script-triggers uit), zonder dubbele mails.
// ============================================================
const S = require('./sheets');
const SB = require('./shiftbase');
const T = require('./sjablonen');
const M = require('./mail');
const C = require('./config');
const { normNaam, parseNLDatum, dagenTot } = require('./util');
const { admin } = require('./auth');
const W = require('./weekend');

const actief = () => String(process.env.SIGNALERINGEN_ACTIEF || '').trim() === '1';
function stempel() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute');
}
const vandaag0 = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); d.setHours(0, 0, 0, 0); return d; };
const isoDag = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dagenSinds = (datumTekst, vandaag) => { const d = parseNLDatum(datumTekst); return d ? Math.floor((vandaag - d) / 864e5) : null; };
const ontvangers = k => (C.SIGNALERING_ONTVANGERS[k] || C.HR_EMAIL).split(',').map(s => s.trim()).filter(Boolean);
const F = 'font-family:Arial,sans-serif;';
const esc = T.esc;

// Verzendhulp: in droogloop alleen registreren
async function mailOfDroog(rap, opts, doen) {
  if (!actief() || rap.droog) { rap.verstuurd.push(Object.assign({ droog: true }, opts.kort)); return; }
  try {
    const id = await M.verstuur({ to: opts.to, subject: opts.subject, text: opts.text, html: opts.html, tags: [{ name: 'bron', value: 'signalering' }, { name: 'type', value: rap.naam }] });
    if (doen) await doen();
    rap.verstuurd.push(Object.assign({ resendId: id }, opts.kort));
    await M.logMail({ door: 'signalering', bron: 'signalering', type: rap.naam, naar: Array.isArray(opts.to) ? opts.to.join(',') : opts.to, naam: opts.kort.naam || '', onderwerp: opts.subject, taal: opts.kort.taal || 'NL', rij: opts.kort.rij || 0, resend_id: id });
  } catch (e) { rap.fouten.push((opts.kort.naam || opts.subject) + ': ' + e.message); }
}

// ---- 1. Formulierstatus syncen (syncLoonheffingFormulieren / syncOntslagFormulieren) ----
async function syncFormulieren(droog) {
  const rap = { naam: 'sync-formulieren', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const [loon, ontslag] = await Promise.all([S.getLoonheffing(), S.getOntslag()]);
  for (const r of loon) if (r.ontvangen !== 'Ja' && r.docUrl) {
    rap.gevonden.push({ bron: 'loonheffing', naam: r.naam, rij: r.rij });
    if (!rap.droog) { try { await S.zetCel(C.SHEETS.loonheffing.id, null, r.rij, 6, 'Ja', S.KLEUR.groen); } catch (e) { rap.fouten.push(r.naam + ': ' + e.message); } }
  }
  for (const r of ontslag) if (r.ondertekend !== 'Ja' && r.docUrl) {
    rap.gevonden.push({ bron: 'ontslag', naam: r.naam, rij: r.rij });
    if (!rap.droog) { try { await S.zetCel(C.SHEETS.ontslag.id, null, r.rij, 10, 'Ja', S.KLEUR.groen); } catch (e) { rap.fouten.push(r.naam + ': ' + e.message); } }
  }
  // Korting-uploads (syncKortingUploads_ in Korting.gs: alleen uploads ná de verzenddatum)
  try { for (const k of await S.syncKortingUploads(rap.droog)) rap.gevonden.push({ bron: 'korting', naam: k.naam, rij: k.rij }); }
  catch (e) { rap.fouten.push('korting-sync: ' + e.message); }
  return rap;
}

// ---- 2. Loonheffing-herinneringen (checkLoonheffingHerinneringen) ----
async function loonHerinneringen(droog) {
  const rap = { naam: 'loonheffing-herinneringen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0(), id = C.SHEETS.loonheffing.id;
  for (const r of await S.getLoonheffing()) {
    if (r.ontvangen === 'Ja' || !r.email || r.email.indexOf('@') === -1 || !r.deadline) continue;
    const naDeadline = dagenSinds(r.deadline, vandaag);
    if (naDeadline === null || naDeadline < 0) continue;
    const sindsLaatste = dagenSinds(r.herinnering, vandaag);
    if (r.herinnering && sindsLaatste !== null && sindsLaatste < C.COOLDOWN_DAGEN) continue;
    const isEN = r.taal === 'EN';
    rap.gevonden.push({ naam: r.naam, email: r.email, deadline: r.deadline, rij: r.rij, taal: r.taal, eerder: r.aantalHer });
    const tpl = T.LOON_TEMPLATES.find(x => x.type === 'herinnering' && x.taal === (isEN ? 'EN' : 'NL'));
    await mailOfDroog(rap, {
      to: r.email, subject: tpl.subject, text: T.personaliseerUploadLinks(T.loonPlain('herinnering', r.naam, r.deadline, isEN), r.naam), html: T.loonHtml('herinnering', r.naam, r.deadline, isEN),
      kort: { naam: r.naam, email: r.email, rij: r.rij, taal: r.taal }
    }, async () => { await S.zetCel(id, null, r.rij, 8, stempel()); await S.zetCel(id, null, r.rij, 9, String((r.aantalHer || 0) + 1)); });
  }
  return rap;
}

// ---- 3. Ontslag-herinneringen (checkOntslagHerinneringen) ----
async function ontslagHerinneringen(droog) {
  const rap = { naam: 'ontslag-herinneringen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0(), id = C.SHEETS.ontslag.id;
  for (const r of await S.getOntslag()) {
    if (r.ondertekend === 'Ja' || !r.email || r.email.indexOf('@') === -1 || !r.verzenddatum) continue;
    const sindsVerzonden = dagenSinds(r.verzenddatum, vandaag);
    if (sindsVerzonden === null || sindsVerzonden < C.COOLDOWN_DAGEN) continue;
    const sindsLaatste = dagenSinds(r.herinnering, vandaag);
    if (r.herinnering && sindsLaatste !== null && sindsLaatste < C.COOLDOWN_DAGEN) continue;
    const bv = r.bedrijf || C.BEDRIJFSNAAM;
    rap.gevonden.push({ naam: r.naam, email: r.email, verzonden: r.verzenddatum, rij: r.rij, eerder: r.aantalHer, type: r.type });
    await mailOfDroog(rap, {
      to: r.email, subject: 'Herinnering: ondertekend HR-document nog niet ontvangen',
      text: 'Beste ' + r.naam + ',\n\nWe hebben het ondertekende HR-document nog niet retour ontvangen. Upload zo spoedig mogelijk via:\n' + T.prefillOntslagUrl(r.naam) + '\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + bv,
      html: T.ontslagHerHtml(r.naam, bv), kort: { naam: r.naam, email: r.email, rij: r.rij }
    }, async () => { await S.zetCel(id, null, r.rij, 11, stempel()); await S.zetCel(id, null, r.rij, 12, String((r.aantalHer || 0) + 1)); });
  }
  return rap;
}

// ---- 4. Nieuwe medewerkers zonder loonheffingsuitnodiging (checkNieuweMedewerkers v9.4) ----
function vindNieuweMedewerkers(med, loonEmails, loonNamen, vandaag) {
  const grens = plusDagen(vandaag, -C.SB_NIEUW_DAGEN);
  const negeer = {}; (C.SIGNALERING_NEGEREN_NAMEN || []).forEach(n => { const k = normNaam(n); if (k) negeer[k] = true; });
  const nieuw = [];
  for (const m of med || []) {
    const d = parseNLDatum(m.indienst); if (!d || d < grens) continue;
    const em = String(m.email || '').trim().toLowerCase(), nn = normNaam(m.naam);
    if (nn && negeer[nn]) continue;
    if ((em && loonEmails[em]) || (nn && loonNamen[nn])) continue;
    nieuw.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', start: m.indienst });
  }
  return nieuw.sort((a, b) => a.winkel.localeCompare(b.winkel) || a.naam.localeCompare(b.naam));
}
function nieuweMedewerkersHtml(nieuw) {
  const blokken = nieuw.map(p => '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + esc(p.naam) + ' <span style="font-weight:400;color:#888078;font-size:12px">&middot; ' + esc(p.winkel) + ' &middot; start ' + esc(p.start) + '</span></p><p style="' + F + 'font-size:12px;color:#666;margin:0 0 6px">' + esc(p.email || '(geen e-mail in Shiftbase)') + '</p><p style="' + F + 'font-size:11px;color:#888078;margin:0">Nog te doen: <span style="display:inline-block;background:#fdf0e8;color:#9a4a1a;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700">loonheffingsuitnodiging</span></p></td></tr></table>').join('');
  return T.slaWrap(T.slaHead('#009f4b', 'HR &middot; Nieuwe medewerkers') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">Volgens Shiftbase zijn deze <strong>' + nieuw.length + ' medewerker(s)</strong> recent gestart of starten ze binnenkort, maar hebben nog geen loonheffingsuitnodiging ontvangen:</p>' + blokken + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:12px;color:#7a5c00;line-height:1.6">Zonder loonheffingsverklaring v&oacute;&oacute;r de eerste loonrun geldt het anoniementarief (52%). Verstuur de loonheffingsuitnodiging via het HR Dashboard (Instroom &rarr; Loonheffingsverklaring).</td></tr></table><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch bericht - dagelijkse Shiftbase-check</p></td></tr>' + T.slaFoot());
}
async function nieuweMedewerkers(droog) {
  const rap = { naam: 'nieuwe-medewerkers', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const [med, loon] = await Promise.all([SB.getMedewerkers(true), S.getLoonheffing()]);
  const loonEmails = {}, loonNamen = {};
  loon.forEach(r => { const e = r.email.toLowerCase(); if (e) loonEmails[e] = true; const n = normNaam(r.naam); if (n) loonNamen[n] = true; });
  const nieuw = vindNieuweMedewerkers(med, loonEmails, loonNamen, vandaag0());
  rap.gevonden = nieuw;
  if (!nieuw.length) return rap;
  const plain = 'Hallo,\n\nDeze medewerkers zijn recent gestart (of starten binnenkort) volgens Shiftbase, maar hebben nog geen loonheffingsuitnodiging vanuit het HR Dashboard ontvangen:\n\n' + nieuw.map(p => '- ' + p.naam + ' (' + p.winkel + ', start ' + p.start + ')').join('\n') + '\n\n(Automatisch bericht van het SLA HR systeem - dagelijkse Shiftbase-check)';
  await mailOfDroog(rap, { to: ontvangers('nieuweMedewerkers'), subject: 'Nieuwe medewerkers gevonden in Shiftbase: ' + nieuw.length + ' zonder loonheffingsuitnodiging', text: plain, html: nieuweMedewerkersHtml(nieuw), kort: { naam: 'HR-team', aantal: nieuw.length } });
  return rap;
}

// ---- 5. Aanzegtermijnen (checkAanzegtermijnen) ----
function vindAflopendeContracten(med, contracts, verzE, verzN, vandaag, venster) {
  const medById = {}; (med || []).forEach(m => { if (m.id) medById[String(m.id)] = m; });
  const perUser = {};
  (contracts || []).forEach(c0 => {
    const c = (c0 && c0.Contract) || c0 || {}; const uid = String(c.user_id || ''); if (!uid) return;
    const sd = String(c.startdate || '').trim();
    if (!perUser[uid] || sd > perUser[uid].sd) perUser[uid] = { sd, ed: String(c.enddate || '').trim() };
  });
  const out = [];
  Object.keys(perUser).forEach(uid => {
    const m = medById[uid]; if (!m) return;
    const ed = perUser[uid].ed; if (!ed || ed === '0000-00-00') return;
    const mm = ed.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!mm) return;
    const eind = new Date(+mm[1], +mm[2] - 1, +mm[3]);
    const dagenTotEinde = Math.round((eind - vandaag) / 864e5);
    if (dagenTotEinde < 0 || dagenTotEinde > venster) return;
    const em = String(m.email || '').trim().toLowerCase(), nn = normNaam(m.naam);
    if ((em && verzE[em]) || (nn && verzN[nn])) return;
    const deadline = new Date(eind.getTime()); deadline.setMonth(deadline.getMonth() - 1);
    out.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', einddatum: mm[3] + '-' + mm[2] + '-' + mm[1], dagenTotEinde, dagenTotDeadline: Math.round((deadline - vandaag) / 864e5) });
  });
  return out.sort((a, b) => a.dagenTotDeadline - b.dagenTotDeadline);
}
function aanzegHtml(lijst) {
  const blokken = lijst.map(p => {
    let kleur, st;
    if (p.dagenTotDeadline < 0) { kleur = '#c0392b'; st = '<strong style="color:#c0392b">DEADLINE ' + (-p.dagenTotDeadline) + ' DAGEN VERSTREKEN</strong> &mdash; pro-rata aanzegvergoeding loopt op: nu ' + (-p.dagenTotDeadline) + '/30 maandloon'; }
    else if (p.dagenTotDeadline <= 7) { kleur = '#e8824a'; st = '<strong style="color:#9a4a1a">Aanzegdeadline ' + (p.dagenTotDeadline === 0 ? 'VANDAAG' : 'over ' + p.dagenTotDeadline + ' dagen') + '</strong> &mdash; verstuur deze week'; }
    else { kleur = '#009f4b'; st = 'Aanzegdeadline over ' + p.dagenTotDeadline + ' dagen'; }
    return '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid ' + kleur + '"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + esc(p.naam) + ' <span style="font-weight:400;color:#888078;font-size:12px">&middot; ' + esc(p.winkel) + '</span></p><p style="' + F + 'font-size:12px;color:#666;margin:0 0 6px">Contract eindigt <strong>' + esc(p.einddatum) + '</strong> (over ' + p.dagenTotEinde + ' dagen)</p><p style="' + F + 'font-size:12px;margin:0">' + st + '</p></td></tr></table>';
  }).join('');
  return T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Aanzegtermijn-bewaking') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">Deze contracten lopen binnen <strong>' + C.AANZEG_VENSTER_DAGEN + ' dagen</strong> af en er is volgens het HR Dashboard nog <strong>geen aanzegging of ontslagbevestiging verstuurd</strong>:</p>' + blokken + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">&#10003; Verstuur de aanzegging via <strong>HR Dashboard &rarr; Uitstroom &rarr; Ontslag &amp; aanzegging &rarr; Aanzegging niet-verlengen + PDF</strong>. Is het contract verlengd? Zet de verlenging in Shiftbase &mdash; dan verdwijnt deze melding vanzelf.</td></tr></table><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch bericht &mdash; dagelijkse aanzegtermijn-check (art. 7:668 BW)</p></td></tr>' + T.slaFoot());
}
async function aanzegtermijnen(droog) {
  const rap = { naam: 'aanzegtermijnen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const [med, cons, ontslag] = await Promise.all([SB.getMedewerkers(true), SB.sbGet('contracts').then(c => (c && c.data) || c || []), S.getOntslag()]);
  const verzE = {}, verzN = {};
  ontslag.forEach(r => { if (String(r.status || '').indexOf('Verzonden') !== 0) return; const e = r.email.toLowerCase(); if (e) verzE[e] = true; const n = normNaam(r.naam); if (n) verzN[n] = true; });
  const lijst = vindAflopendeContracten(med, cons, verzE, verzN, vandaag0(), C.AANZEG_VENSTER_DAGEN);
  rap.gevonden = lijst;
  if (!lijst.length) return rap;
  const teLaat = lijst.filter(x => x.dagenTotDeadline < 0).length;
  const subject = teLaat > 0 ? '⚠ Aanzegtermijn: ' + teLaat + ' deadline(s) VERSTREKEN, ' + lijst.length + ' contract(en) lopen af' : 'Aanzegtermijn: ' + lijst.length + ' contract(en) lopen af zonder verstuurde aanzegging';
  const plain = 'Hallo,\n\nDeze contracten lopen binnen ' + C.AANZEG_VENSTER_DAGEN + ' dagen af en er is volgens het HR Dashboard nog GEEN aanzegging of ontslagbevestiging verstuurd:\n\n' +
    lijst.map(p => '- ' + p.naam + ' (' + p.winkel + ') - einddatum ' + p.einddatum + ' - ' + (p.dagenTotDeadline < 0 ? 'DEADLINE ' + (-p.dagenTotDeadline) + ' DAGEN VERSTREKEN: pro-rata vergoeding loopt op (' + (-p.dagenTotDeadline) + '/30 maandloon)' : p.dagenTotDeadline === 0 ? 'aanzegdeadline is VANDAAG' : 'aanzegdeadline over ' + p.dagenTotDeadline + ' dagen')).join('\n') +
    '\n\nVerstuur de aanzegging via HR Dashboard -> Ontslag & aanzegging -> "Aanzegging niet-verlengen + PDF".\nIs het contract verlengd? Zet de verlenging in Shiftbase, dan verdwijnt de melding vanzelf.\n\n(Automatisch bericht - dagelijkse aanzegtermijn-check, art. 7:668 BW)';
  await mailOfDroog(rap, { to: ontvangers('aanzegtermijn'), subject, text: plain, html: aanzegHtml(lijst), kort: { naam: 'HR-team', aantal: lijst.length, teLaat } });
  return rap;
}

// ---- 6. Stille afwezigen (checkStilleAfwezigen, wekelijks) ----
function bepaalStilleAfwezigen(med, rosters, absentees, vandaag, venster, uitgesloten) {
  const vandaagIso = isoDag(vandaag), grensIso = isoDag(plusDagen(vandaag, -venster));
  const uit = {}; (uitgesloten || []).forEach(w => { uit[w] = true; });
  const laatste = {}, toekomst = {};
  (rosters || []).forEach(r0 => {
    const rr = (r0 && r0.Roster) || r0 || {}; if (rr.deleted === true || String(rr.deleted) === '1') return;
    const uid = String(rr.user_id || ''), dt = String(rr.date || ''); if (!uid || !dt) return;
    if (dt <= vandaagIso) { if (!laatste[uid] || dt > laatste[uid]) laatste[uid] = dt; } else toekomst[uid] = true;
  });
  const verlof = {};
  (absentees || []).forEach(a0 => {
    const a = (a0 && a0.Absentee) || a0 || {}; if (String(a.status || '') !== 'Approved') return;
    const sd = String(a.startdate || ''), ed = String(a.enddate || a.startdate || '');
    if (sd <= vandaagIso && ed >= grensIso) verlof[String(a.user_id || '')] = true;
  });
  const out = [];
  (med || []).forEach(m => {
    const w = m.winkelNaam || '(geen winkel)'; if (uit[w]) return;
    const uid = String(m.id || ''); if (toekomst[uid]) return;
    const ind = parseNLDatum(m.indienst); if (ind && isoDag(ind) > grensIso) return;   // te kort in dienst (v9.4)
    const l = laatste[uid] || ''; if (l >= grensIso) return; if (verlof[uid]) return;
    let dagen = null, label = '';
    const mm = l.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mm) { dagen = Math.round((vandaag - new Date(+mm[1], +mm[2] - 1, +mm[3])) / 864e5); label = mm[3] + '-' + mm[2] + '-' + mm[1]; }
    out.push({ naam: m.naam, email: m.email || '', winkel: w, laatsteDienst: label, dagen, indienst: m.indienst || '' });
  });
  return out.sort((a, b) => a.winkel !== b.winkel ? (a.winkel < b.winkel ? -1 : 1) : (b.dagen === null ? 9999 : b.dagen) - (a.dagen === null ? 9999 : a.dagen));
}
function stilHtml(lijst, venster, lookback) {
  let blokken = '', vorige = '', open = false;
  lijst.forEach(p => {
    if (p.winkel !== vorige) { if (open) blokken += '</td></tr></table>'; blokken += '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #e8824a"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 8px">' + esc(p.winkel) + '</p>'; vorige = p.winkel; open = true; }
    blokken += '<p style="' + F + 'font-size:12px;color:#666;margin:0 0 4px">&bull; <strong>' + esc(p.naam) + '</strong> &mdash; ' + (p.laatsteDienst ? 'laatste dienst ' + esc(p.laatsteDienst) + ' <span style="color:#c0392b;font-weight:700">(' + p.dagen + ' dagen geleden)</span>' : '<span style="color:#c0392b;font-weight:700">geen dienst in de laatste ' + lookback + ' dagen</span>' + (p.indienst ? ' <span style="color:#888078">(in dienst sinds ' + esc(p.indienst) + ')</span>' : '')) + '</p>';
  });
  if (open) blokken += '</td></tr></table>';
  return T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Stille afwezigen') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">Deze actieve medewerkers hadden de afgelopen <strong>' + venster + ' dagen</strong> geen enkele ingeroosterde dienst &mdash; zonder goedgekeurd verlof en zonder toekomstige dienst in het rooster:</p>' + blokken + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">&#10003; Check bij de store manager wat er speelt. Blijft het stil, dan is de <strong>oproepbrief</strong> in het HR Dashboard (Dossier &rarr; Sommaties) de volgende stap.</td></tr></table><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch wekelijks bericht &mdash; stille-afwezigen check</p></td></tr>' + T.slaFoot());
}
async function stilleAfwezigen(droog) {
  const rap = { naam: 'stille-afwezigen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0();
  const [med, ros, abs] = await Promise.all([
    SB.getMedewerkers(true),
    SB.sbGet('rosters?min_date=' + isoDag(plusDagen(vandaag, -C.STIL_LOOKBACK_DAGEN)) + '&max_date=' + isoDag(plusDagen(vandaag, C.STIL_TOEKOMST_DAGEN))).then(r => (r && r.data) || r || []),
    SB.sbGet('absentees?min_date=' + isoDag(plusDagen(vandaag, -C.STIL_VENSTER_DAGEN)) + '&max_date=' + isoDag(vandaag)).then(r => (r && r.data) || r || [])
  ]);
  const lijst = bepaalStilleAfwezigen(med, ros, abs, vandaag, C.STIL_VENSTER_DAGEN, C.STIL_UITGESLOTEN_WINKELS);
  rap.gevonden = lijst;
  if (!lijst.length) return rap;
  let plain = 'Hallo,\n\nDeze actieve medewerkers hadden de afgelopen ' + C.STIL_VENSTER_DAGEN + ' dagen geen enkele ingeroosterde dienst, zonder goedgekeurd verlof en zonder toekomstige dienst in het rooster:\n', vorige = '';
  lijst.forEach(p => { if (p.winkel !== vorige) { plain += '\n' + p.winkel + ':\n'; vorige = p.winkel; } plain += '- ' + p.naam + ' - laatste dienst: ' + (p.laatsteDienst ? p.laatsteDienst + ' (' + p.dagen + ' dagen geleden)' : 'geen in de laatste ' + C.STIL_LOOKBACK_DAGEN + ' dagen' + (p.indienst ? ' (in dienst sinds ' + p.indienst + ')' : '')) + '\n'; });
  plain += '\nCheck bij de store manager wat er speelt. Blijft het stil, dan is de oproepbrief in het HR Dashboard (Sommaties) de volgende stap.\n\n(Automatisch wekelijks bericht van het SLA HR systeem)';
  await mailOfDroog(rap, { to: ontvangers('stilleAfwezigen'), subject: 'Stille afwezigen: ' + lijst.length + ' medewerker(s) zonder dienst in ' + C.STIL_VENSTER_DAGEN + ' dagen', text: plain, html: stilHtml(lijst, C.STIL_VENSTER_DAGEN, C.STIL_LOOKBACK_DAGEN), kort: { naam: 'HR-team', aantal: lijst.length } });
  return rap;
}

// ---- 7. Weekendbeschikbaarheid (checkWeekendBeschikbaarheid, Shiftbase.gs v9.4; maandag 09:45) ----
function weekendHtml(lijst, weken) {
  let blokken = '', vorige = '', open = false;
  lijst.forEach(p => {
    if (p.winkel !== vorige) { if (open) blokken += '</td></tr></table>'; blokken += '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #e8824a"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 8px">' + esc(p.winkel) + '</p>'; vorige = p.winkel; open = true; }
    blokken += '<p style="' + F + 'font-size:12px;color:#666;margin:0 0 2px">&bull; <strong>' + esc(p.naam) + '</strong> &mdash; <strong style="color:#c0392b">' + p.doordeweeks + ' doordeweekse dienst(en)</strong> in dezelfde periode &middot; laatste weekenddienst: ' + (p.laatsteWeekendDienst ? esc(p.laatsteWeekendDienst) : '<em>niet gevonden</em>') + '</p><p style="' + F + 'font-size:11px;color:#888078;margin:0 0 8px;padding-left:12px;border-left:2px solid #e8e2de">Onderbouwing: &ldquo;' + esc(p.onderbouwing) + '&rdquo;</p>';
  });
  if (open) blokken += '</td></tr></table>';
  return T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Weekendbeschikbaarheid') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">Deze medewerkers hadden de afgelopen <strong>' + weken + ' volledige weekenden</strong> (vr t/m zo) geen enkele weekenddienst, terwijl ze in dezelfde periode <strong>w&eacute;l doordeweeks werkten</strong>. Goedgekeurd verlof en net gestarte medewerkers zijn uitgefilterd. Huisregel: <em>&ldquo;Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar.&rdquo;</em></p>' + blokken
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:12px;color:#7a5c00;line-height:1.6">&#9888; Dit signaal is gebaseerd op het <strong>rooster</strong> (ingeroosterd), niet op opgegeven beschikbaarheid. Check bij twijfel eerst de beschikbaarheid in Shiftbase &mdash; iemand kan beschikbaar zijn geweest maar niet ingepland.</td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">&#10003; Klopt het beeld? Verstuur de kennisgeving via <strong>HR Dashboard &rarr; Beschikbaarheid</strong> en plak de onderbouwing hierboven in het onderbouwingsveld.</td></tr></table>'
    + '<p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch wekelijks bericht &mdash; weekendbeschikbaarheid-check</p></td></tr>' + T.slaFoot());
}
async function weekendBeschikbaarheid(droog) {
  const rap = { naam: 'weekend-beschikbaarheid', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0(), weken = C.WEEKEND_SIGNAAL_WEKEN;
  const [med, ros, abs] = await Promise.all([
    SB.getMedewerkers(true),
    SB.sbGet('rosters?min_date=' + isoDag(plusDagen(vandaag, -(weken * 7 + 56))) + '&max_date=' + isoDag(vandaag)).then(r => (r && r.data) || r || []),
    SB.sbGet('absentees?min_date=' + isoDag(plusDagen(vandaag, -(weken * 7 + 7))) + '&max_date=' + isoDag(vandaag)).then(r => (r && r.data) || r || [])
  ]);
  const lijst = W.bepaalWeekendOntwijkers(med, ros, abs, vandaag, weken, C.WEEKEND_UITGESLOTEN_WINKELS);
  rap.gevonden = lijst;
  if (!lijst.length) return rap;
  let plain = 'Hallo,\n\nDeze medewerkers hadden de afgelopen ' + weken + ' volledige weekenden (vr t/m zo) geen enkele weekenddienst, terwijl ze in dezelfde periode wel doordeweeks werkten. Goedgekeurd verlof en net gestarte medewerkers zijn uitgefilterd:\n', vorige = '';
  lijst.forEach(p => { if (p.winkel !== vorige) { plain += '\n' + p.winkel + ':\n'; vorige = p.winkel; } plain += '- ' + p.naam + ' - ' + p.doordeweeks + ' doordeweekse dienst(en), laatste weekenddienst: ' + (p.laatsteWeekendDienst || 'niet gevonden in de laatste ' + Math.round((weken * 7 + 56) / 7) + ' weken') + '\n  Onderbouwing voor de brief: "' + p.onderbouwing + '"\n'; });
  plain += '\nLET OP: dit is gebaseerd op het rooster (ingeroosterd), niet op opgegeven beschikbaarheid. Check bij twijfel de beschikbaarheid in Shiftbase.\nVerstuur de kennisgeving via HR Dashboard -> Beschikbaarheid (de onderbouwing kun je zo overnemen).\n\n(Automatisch wekelijks bericht van het SLA HR systeem)';
  await mailOfDroog(rap, { to: ontvangers('weekendBeschikbaarheid'), subject: 'Weekendbeschikbaarheid: ' + lijst.length + ' medewerker(s) ' + weken + ' weekenden zonder dienst (wel doordeweeks actief)', text: plain, html: weekendHtml(lijst, weken), kort: { naam: 'HR-team', aantal: lijst.length } });
  return rap;
}

// ---- 8. Loonheffingskorting-herinneringen (checkKortingHerinneringen, Korting.gs v1.5; dagelijks 09:55) ----
async function kortingHerinneringen(droog) {
  const rap = { naam: 'korting-herinneringen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  try { await S.syncKortingUploads(rap.droog); } catch (e) { rap.fouten.push('sync: ' + e.message); }
  const vandaag = vandaag0(), id = C.SHEETS.loonheffing.id;
  for (const r of await S.getKorting()) {
    if (!r.naam || !r.email || r.email.indexOf('@') === -1 || r.retour === 'Ja' || !r.verzenddatum) continue;
    const sindsVerz = dagenSinds(r.verzenddatum, vandaag);
    if (sindsVerz === null || sindsVerz < C.KORT_HERINNER_DAGEN) continue;
    const sindsLaatste = dagenSinds(r.herinnering, vandaag);
    if (r.herinnering && sindsLaatste !== null && sindsLaatste < C.KORT_HERINNER_DAGEN) continue;
    const isEN = r.taal === 'EN', keuze = r.keuze || 'Wijzigen';
    rap.gevonden.push({ naam: r.naam, email: r.email, keuze, rij: r.rij, taal: r.taal, eerder: r.aantalHer, verzonden: r.verzenddatum });
    await mailOfDroog(rap, {
      to: r.email, subject: T.kortSubject(keuze, isEN, true), text: T.kortingPlain(r.naam, keuze, r.ingangsdatum, r.deadline, isEN, true), html: T.kortingHtml(r.naam, keuze, r.ingangsdatum, r.deadline, isEN, true),
      kort: { naam: r.naam, email: r.email, rij: r.rij, taal: r.taal }
    }, async () => { await S.zetCel(id, C.TAB_KORTING, r.rij, 11, stempel()); await S.zetCel(id, C.TAB_KORTING, r.rij, 12, String((r.aantalHer || 0) + 1)); });
  }
  return rap;
}

// ---- 9. Vakantiepieken (checkVakantiepieken, Shiftbase.gs v6; maandag 09:00) ----
function piekHtml(pieken) {
  const blokken = pieken.map(p => {
    const totaal = p.app + p.stil + p.pend, kleur = p.alRood ? '#c0392b' : '#e8824a';
    const status = p.alRood ? '<strong style="color:#c0392b">Al boven de drempel</strong>' : '<strong style="color:#9a4a1a">Komt boven de drempel</strong> als de open aanvragen worden goedgekeurd';
    return '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid ' + kleur + '"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + esc(p.winkel) + ' <span style="font-weight:400;color:#888078;font-size:12px">&middot; bezetting ' + p.bezetting + ' &middot; week ' + esc(p.week) + '</span></p><p style="' + F + 'font-size:12px;color:#666;margin:0 0 6px"><strong>' + p.app + '</strong> vakantie' + (p.stil ? ' + <strong>' + p.stil + '</strong> stil' : '') + (p.pend ? ' + <strong>' + p.pend + '</strong> aangevraagd' : '') + ' = <strong>' + totaal + '</strong> totaal tegelijk weg &mdash; ' + status + '</p>'
      + (p.namen.length ? '<p style="' + F + 'font-size:11px;color:#888078;margin:0 0 2px"><strong>Vakantie:</strong> ' + esc(p.namen.join(', ')) + '</p>' : '') + (p.stilNamen.length ? '<p style="' + F + 'font-size:11px;color:#888078;margin:0"><strong>Stil:</strong> ' + esc(p.stilNamen.join(', ')) + '</p>' : '') + '</td></tr></table>';
  }).join('');
  return T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Afwezigheidspieken') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">In de komende <strong>' + C.VAKANTIE_PIEK_WEKEN + ' weken</strong> gaan deze winkels over de drempel van <strong>' + Math.round(C.VAKANTIE_DREMPEL_ROOD * 100) + '%</strong> van de bezetting gelijktijdig afwezig (vakantie + stille afwezigen samen):</p>' + blokken
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">&#10003; Bekijk de volledige heatmap in <strong>HR Dashboard &rarr; Vakantieplanner</strong>. Open aanvragen kun je nu nog met de store manager bespreken v&oacute;&oacute;rdat ze worden goedgekeurd.</td></tr></table><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch wekelijks bericht &mdash; vakantiepiek-check</p></td></tr>' + T.slaFoot());
}
async function vakantiepieken(droog) {
  const rap = { naam: 'vakantiepieken', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const VK = require('./vakantie');
  const d = await VK.getVakantiePlannerData();
  const pieken = VK.bepaalPieken(d);
  rap.gevonden = pieken;
  if (!pieken.length) return rap;
  let plain = 'Hallo,\n\nIn de komende ' + C.VAKANTIE_PIEK_WEKEN + ' weken zijn er pieken van gelijktijdige afwezigheid (vakantie + stille afwezigen samen, >= ' + Math.round(C.VAKANTIE_DREMPEL_ROOD * 100) + '% van de bezetting):\n\n';
  pieken.forEach(p => { plain += '- ' + p.winkel + ' (bezetting ' + p.bezetting + '), week ' + p.week + ': ' + p.app + ' vakantie' + (p.stil ? ' + ' + p.stil + ' stil' : '') + (p.pend ? ' + ' + p.pend + ' aangevraagd' : '') + ' = ' + (p.app + p.stil + p.pend) + ' totaal\n' + (p.namen.length ? '  Vakantie: ' + p.namen.join(', ') + '\n' : '') + (p.stilNamen.length ? '  Stil: ' + p.stilNamen.join(', ') + '\n' : ''); });
  plain += '\nBekijk de volledige heatmap in HR Dashboard -> Vakantieplanner. Aanvragen die nog open staan kun je nu nog met de store manager bespreken.\n\n(Automatisch wekelijks bericht van het SLA HR systeem)';
  await mailOfDroog(rap, { to: ontvangers('vakantiepiek'), subject: 'Afwezigheidspieken: ' + pieken.length + ' winkel-week combinatie(s) boven de drempel', text: plain, html: piekHtml(pieken), kort: { naam: 'HR-team', aantal: pieken.length } });
  return rap;
}

// ---- 10. AVG-bewaartermijnen (bewaartermijnRapport, Beheer.gs v1.0; 1e van de maand 08:00) ----
// Rapporteert, verwijdert NIETS: beoordelen en verwijderen blijft een menselijke beslissing (gedocumenteerd opschoonproces).
function bhrScan(data, datumKoppen, jaren) {
  if (!data || data.length < 2) return [];
  let hRij = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) { const k = (data[i] || []).map(x => String(x || '').trim().toLowerCase()); if (k.indexOf('naam') > -1 || k.indexOf('voornaam') > -1) { hRij = i; break; } }
  const koppen = (data[hRij] || []).map(x => String(x || '').trim().toLowerCase());
  let kNaam = koppen.indexOf('naam'); if (kNaam === -1) kNaam = koppen.indexOf('voornaam');
  let kDatum = -1;
  for (const dk of datumKoppen) { if (kDatum > -1) break; for (let c = 0; c < koppen.length; c++) if (koppen[c].indexOf(dk) > -1) { kDatum = c; break; } }
  if (kNaam === -1 || kDatum === -1) return [];
  const grens = new Date(); grens.setFullYear(grens.getFullYear() - jaren);
  const uit = [];
  for (let r = hRij + 1; r < data.length; r++) {
    const naam = String((data[r] || [])[kNaam] || '').trim(); if (!naam) continue;
    const dt = parseNLDatum((data[r] || [])[kDatum]); if (!dt || dt > grens) continue;
    uit.push({ rij: r + 1, naam, datum: String(data[r][kDatum]) });
  }
  return uit;
}
async function bewaartermijnen(droog) {
  const rap = { naam: 'bewaartermijnen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const blokken = [];
  const scan = async (titel, id, tab, koppen, jaren, termijn) => { try { const items = bhrScan(await S.leesRuw(id, tab), koppen, jaren); if (items.length) blokken.push({ titel, items, termijn }); } catch (e) { rap.fouten.push(titel + ': ' + e.message); } };
  const tabs = { loon: await S.eersteTabNaam(C.SHEETS.loonheffing.id), ontslag: await S.eersteTabNaam(C.SHEETS.ontslag.id), som: await S.eersteTabNaam(C.SHEETS.sommatie.id) };
  await scan('Ontslag / aanzegging (hoofdtab)', C.SHEETS.ontslag.id, tabs.ontslag, ['einddatum'], C.BHR_JAREN_DOSSIER, C.BHR_JAREN_DOSSIER + ' jaar na einddatum');
  await scan('Sommaties', C.SHEETS.sommatie.id, tabs.som, ['verzenddatum', 'verzonden'], C.BHR_JAREN_DOSSIER, C.BHR_JAREN_DOSSIER + ' jaar na verzending');
  await scan('Waarschuwingen', C.SHEETS.ontslag.id, C.TAB_WAARSCHUWINGEN, ['datum', 'verzonden'], C.BHR_JAREN_DOSSIER, C.BHR_JAREN_DOSSIER + ' jaar');
  await scan('Loonheffingsverklaringen', C.SHEETS.loonheffing.id, tabs.loon, ['deadline', 'verzenddatum'], C.BHR_JAREN_LOON, C.BHR_JAREN_LOON + ' jaar (fiscaal)');
  rap.gevonden = blokken.flatMap(b => b.items.map(i => Object.assign({ categorie: b.titel, termijn: b.termijn }, i)));
  if (!blokken.length) return rap;
  const totaal = rap.gevonden.length, st = F + 'font-size:13px;color:#333d3a;line-height:1.6';
  let plain = 'Hoi,\n\nDe maandelijkse AVG-bewaartermijncontrole heeft records gevonden die hun termijn voorbij zijn. Verwijderen gebeurt NIET automatisch - beoordeel en verwijder handmatig (rij in de sheet + bijbehorend document):\n', html = '';
  for (const bl of blokken) {
    plain += '\n=== ' + bl.titel + ' (termijn: ' + bl.termijn + ') ===\n';
    let rijen = '';
    for (const it of bl.items) { plain += '  rij ' + it.rij + ': ' + it.naam + ' (' + it.datum + ')\n'; rijen += '<div style="' + st + ';padding:3px 0">rij ' + it.rij + ' &bull; <strong>' + esc(it.naam) + '</strong> &bull; ' + esc(it.datum) + '</div>'; }
    html += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr><td style="padding:12px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #2b6cb0"><p style="' + st + ';font-weight:700;margin:0 0 6px">' + esc(bl.titel) + ' <span style="font-weight:400;color:#888078">(termijn: ' + esc(bl.termijn) + ')</span></p>' + rijen + '</td></tr></table>';
  }
  plain += '\nDeze controle draait maandelijks en is onderdeel van het AVG-opschoonproces.\n\n(Automatisch bericht van het SLA HR Dashboard)';
  await mailOfDroog(rap, { to: ontvangers('bewaartermijn'), subject: 'AVG-bewaartermijnen: ' + totaal + ' record(s) te beoordelen', text: plain,
    html: T.slaWrap(T.slaHead('#2b6cb0', 'HR &middot; AVG-bewaartermijnen') + '<tr><td style="padding:32px 36px 28px"><p style="' + st + ';font-size:15px;margin:0 0 14px">Hoi,</p><p style="' + st + ';margin:0 0 18px">De maandelijkse bewaartermijncontrole heeft <strong>' + totaal + ' record(s)</strong> gevonden die hun termijn voorbij zijn. Er wordt <strong>niets automatisch verwijderd</strong> - beoordeel de records en verwijder handmatig (sheet-rij + bijbehorend document).</p>' + html + '<p style="' + F + 'font-size:11px;color:#aaa;margin:14px 0 0">Onderdeel van het periodieke AVG-opschoonproces &bull; automatisch bericht van het SLA HR Dashboard</p></td></tr>' + T.slaFoot()),
    kort: { naam: 'HR-team', aantal: totaal } });
  return rap;
}

// ---- 11. Datakwaliteit Shiftbase (stuurDataHygieneRapport, Shiftbase.gs; 1e van de maand 09:00) ----
function hygieneOverzicht(med) {
  const perWinkel = {}; let totAdres = 0, totFunctie = 0;
  for (const m of med || []) { const mistA = !m.adres, mistF = !m.functie; if (!mistA && !mistF) continue; if (mistA) totAdres++; if (mistF) totFunctie++; const w = m.winkelNaam || '(geen winkel)'; (perWinkel[w] = perWinkel[w] || []).push({ naam: m.naam, mistAdres: mistA, mistFunctie: mistF }); }
  return { perWinkel, totAdres, totFunctie, totaal: (med || []).length };
}
async function dataHygiene(droog) {
  const rap = { naam: 'data-hygiene', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const ov = hygieneOverzicht(await SB.getMedewerkers(true));
  const winkels = Object.keys(ov.perWinkel).sort();
  rap.gevonden = winkels.flatMap(w => ov.perWinkel[w].map(p => ({ winkel: w, naam: p.naam, mist: [p.mistAdres ? 'adres' : '', p.mistFunctie ? 'functie' : ''].filter(Boolean).join(' + ') })));
  if (!winkels.length) return rap;
  const pct = n => Math.round(n / ov.totaal * 100);
  let plain = 'Hallo,\n\nMaandelijkse datakwaliteit-check van Shiftbase (' + ov.totaal + ' actieve medewerkers):\n- Zonder adres: ' + ov.totAdres + ' (' + pct(ov.totAdres) + '%)\n- Zonder functie: ' + ov.totFunctie + ' (' + pct(ov.totFunctie) + '%)\n\n', blokken = '';
  winkels.forEach((w, i) => {
    const lijst = ov.perWinkel[w];
    plain += '=== ' + w + ' (' + lijst.length + ') ===\n';
    blokken += '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="padding:10px 16px;background:#333d3a;border-radius:6px 6px 0 0"><p style="' + F + 'font-size:13px;font-weight:700;color:#fff;margin:0">' + esc(w) + ' <span style="float:right;background:rgba(255,255,255,.2);padding:2px 10px;border-radius:10px;font-size:11px">' + lijst.length + '</span></p></td></tr></table>';
    lijst.forEach((p, j) => { const mist = [p.mistAdres ? 'adres' : '', p.mistFunctie ? 'functie' : ''].filter(Boolean).join(' + '); plain += '  - ' + p.naam + ': ' + mist + '\n'; blokken += '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:10px 16px;background:#fff;border-left:4px solid #e8824a;border-right:1px solid #f0ebe7;' + (j === lijst.length - 1 ? 'border-radius:0 0 8px 8px;' : 'border-bottom:1px solid #f0ebe7;') + '"><span style="' + F + 'font-size:13px;font-weight:700;color:#333d3a">' + esc(p.naam) + '</span><span style="' + F + 'font-size:12px;color:#9a4a1a;float:right">mist: ' + mist + '</span></td></tr></table>'; });
    plain += '\n'; if (i < winkels.length - 1) blokken += '<div style="height:12px;line-height:12px;font-size:1px">&nbsp;</div>';
  });
  plain += 'Aanvullen kan direct in Shiftbase (medewerkerprofiel). Complete data = complete juridische brieven.\n\n(Automatisch maandelijks bericht van het SLA HR systeem)';
  await mailOfDroog(rap, { to: ontvangers('dataHygiene'), subject: 'Shiftbase datakwaliteit: ' + ov.totAdres + 'x adres en ' + ov.totFunctie + 'x functie ontbreekt', text: plain,
    html: T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Datakwaliteit Shiftbase') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">Maandelijkse check over <strong>' + ov.totaal + ' actieve medewerkers</strong>: <strong>' + ov.totAdres + '</strong> zonder adres (' + pct(ov.totAdres) + '%), <strong>' + ov.totFunctie + '</strong> zonder functie (' + pct(ov.totFunctie) + '%). Compleet aangevulde profielen betekenen complete juridische brieven vanuit het dashboard.</p>' + blokken + '<p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch maandelijks bericht - aanvullen kan direct in Shiftbase</p></td></tr>' + T.slaFoot()),
    kort: { naam: 'HR-team', aantal: rap.gevonden.length } });
  return rap;
}

const CHECKS = { 'sync-formulieren': syncFormulieren, 'loonheffing-herinneringen': loonHerinneringen, 'ontslag-herinneringen': ontslagHerinneringen, 'nieuwe-medewerkers': nieuweMedewerkers, 'aanzegtermijnen': aanzegtermijnen, 'stille-afwezigen': stilleAfwezigen, 'weekend-beschikbaarheid': weekendBeschikbaarheid, 'korting-herinneringen': kortingHerinneringen, 'vakantiepieken': vakantiepieken, 'bewaartermijnen': bewaartermijnen, 'data-hygiene': dataHygiene };

// Eén check draaien + loggen in hr_signaleringen (migratie 0004). Faalt nooit hard op het loggen.
async function draai(naam, droog, bron) {
  const fn = CHECKS[naam]; if (!fn) throw new Error('Onbekende check: ' + naam);
  const start = Date.now();
  let rap;
  try { rap = await fn(droog); }
  catch (e) { rap = { naam, gevonden: [], verstuurd: [], fouten: ['check mislukt: ' + e.message], droog: !!droog || !actief() }; }
  rap.actief = actief(); rap.duurMs = Date.now() - start; rap.bron = bron || 'schedule'; rap.tijd = stempel();
  try { await admin().from('hr_signaleringen').insert({ check: naam, bron: rap.bron, droog: rap.droog, gevonden: rap.gevonden.length, verstuurd: rap.verstuurd.length, fouten: rap.fouten.length, details: rap }); }
  catch (e) { console.warn('hr_signaleringen log mislukt:', e.message); }
  return rap;
}

module.exports = { CHECKS, draai, actief, vindNieuweMedewerkers, vindAflopendeContracten, bepaalStilleAfwezigen, syncFormulieren, loonHerinneringen, ontslagHerinneringen, nieuweMedewerkers, aanzegtermijnen, stilleAfwezigen, weekendBeschikbaarheid, kortingHerinneringen, vakantiepieken, bewaartermijnen, dataHygiene, bhrScan, hygieneOverzicht };
