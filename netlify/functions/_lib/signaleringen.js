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

// Wie staat er bij Ontslag & aanzegging (ook gearchiveerd) met een einddatum vandaag of later? Voor die mensen zijn
// contract-, keten-, proeftijd-, oproep- en aanwezigheidssignalen overbodig: ze vertrekken al.
async function vertrekkers() {
  const set = new Set(), vandaag = vandaag0();
  for (const r of await S.getOntslag(true)) {
    const d = parseNLDatum(r.einddatum);
    if (d ? d < vandaag : !!r.gearchiveerd) continue; // al weg (of oud gearchiveerd dossier zonder datum)
    if (r.email) set.add('e:' + String(r.email).trim().toLowerCase());
    if (r.naam) set.add('n:' + normNaam(r.naam));
  }
  return set;
}
const vertrekt = (set, x) => !!x && ((x.email && set.has('e:' + String(x.email).trim().toLowerCase())) || (x.naam && set.has('n:' + normNaam(x.naam))));
async function zonderVertrekkers(lijst, rap) {
  if (!lijst || !lijst.length) return lijst || [];
  try { const set = await vertrekkers(); const uit = lijst.filter(x => !vertrekt(set, x)); if (rap) rap.overgeslagenOntslag = lijst.length - uit.length; return uit; }
  catch (e) { if (rap) rap.fouten.push('ontslagdossiers lezen: ' + e.message); return lijst; }
}

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
  // Fase 1: medewerker_id bijwerken op nieuwe rijen (alleen op de Supabase-laag; stil bij fouten)
  if (!rap.droog && S.bron && S.bron() === 'supabase') {
    try { const uit = await require('./data').koppelMedewerkers(await SB.getMedewerkers()); rap.gekoppeld = Object.values(uit).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0); }
    catch (e) { rap.fouten.push('koppelen: ' + e.message); }
  }
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
    const tweetalig = /NL\s*\/\s*EN/i.test(r.taal || ''); // automatische uitnodiging was NL + EN → herinnering ook
    await mailOfDroog(rap, {
      to: r.email, subject: tweetalig ? T.LOON_TWEETALIG_ONDERWERP.herinnering : tpl.subject,
      text: T.personaliseerUploadLinks(tweetalig ? T.loonPlainTweetalig('herinnering', r.naam, r.deadline) : T.loonPlain('herinnering', r.naam, r.deadline, isEN), r.naam),
      html: tweetalig ? T.loonHtmlTweetalig('herinnering', r.naam, r.deadline) : T.loonHtml('herinnering', r.naam, r.deadline, isEN),
      kort: { naam: r.naam, email: r.email, rij: r.rij, taal: r.taal }
    }, async () => { await S.zetCel(id, null, r.rij, 8, stempel()); await S.zetCel(id, null, r.rij, 9, String((r.aantalHer || 0) + 1)); });
  }
  return rap;
}

// ---- 3. Ontslag-herinneringen (checkOntslagHerinneringen) ----
async function ontslagHerinneringen(droog) {
  const rap = { naam: 'ontslag-herinneringen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0(), id = C.SHEETS.ontslag.id;
  rap.gearchiveerd = []; rap.bevestigd = [];
  const UD = require('./uitdienst'), bevestigAan = await UD.actief();
  // rijen die HR zelf uit het archief heeft teruggezet niet opnieuw automatisch archiveren
  const teruggezet = {};
  try { const { data } = await admin().from('hr_acties').select('rij').eq('actie', 'herstel').eq('bron', 'ontslag').limit(1000); (data || []).forEach(a => { teruggezet[a.rij] = true; }); } catch (e) { /* tabel/kolom ontbreekt: dan niets uitzonderen */ }
  for (const r of await S.getOntslag()) {
    if (r.ondertekend === 'Ja' || !r.verzenddatum) continue;
    const sindsVerzonden = dagenSinds(r.verzenddatum, vandaag);
    // na ONTSLAG_ARCHIVEER_DAGEN zonder handtekening: automatisch archiveren, geen herinneringen meer
    if (sindsVerzonden !== null && sindsVerzonden >= C.ONTSLAG_ARCHIVEER_DAGEN && !teruggezet[r.rij]) {
      const item = { naam: r.naam, rij: r.rij, type: r.type, verzonden: r.verzenddatum, herinneringen: r.aantalHer || 0 };
      if (rap.droog) { rap.gearchiveerd.push(Object.assign({ droog: true }, item)); continue; }
      try {
        await S.archiveerRij(id, 'automatisch: niet ondertekend na ' + C.ONTSLAG_ARCHIVEER_DAGEN + ' dagen', r.rij, r.naam, 'signalering');
        await require('./auth').logActie({ door: 'signalering', actie: 'archiveren', bron: 'ontslag', rij: r.rij, naam: r.naam, details: (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslagbevestiging') + ' niet ondertekend na ' + sindsVerzonden + ' dagen (' + (r.aantalHer || 0) + ' herinneringen) — automatisch gearchiveerd' });
        rap.gearchiveerd.push(item);
      } catch (e) { rap.fouten.push(r.naam + ' (archiveren): ' + e.message); }
      continue;
    }
    if (!r.email || r.email.indexOf('@') === -1) continue;
    if (sindsVerzonden === null || sindsVerzonden < C.COOLDOWN_DAGEN) continue;
    const sindsLaatste = dagenSinds(r.herinnering, vandaag);
    if (r.herinnering && sindsLaatste !== null && sindsLaatste < C.COOLDOWN_DAGEN) continue;
    const bv = r.bedrijf || C.BEDRIJFSNAAM;
    // na het maximum geen automatische mail meer (voorheen eindeloos: tot 53 herinneringen) — wel een (rode) taak voor HR
    if ((r.aantalHer || 0) >= C.ONTSLAG_MAX_HERINNERINGEN) {
      // v0.19.4: na de laatste herinnering de uitdiensttreding bevestigen (geen handtekening nodig), salaris inlichten, archiveren
      if (bevestigAan) {
        if (rap.droog) { rap.bevestigd.push({ droog: true, naam: r.naam, rij: r.rij, type: r.type }); continue; }
        try { rap.bevestigd.push(await UD.bevestig(r, 'signalering')); rap.verstuurd.push({ naam: r.naam, bevestiging: true }); continue; }
        catch (e) { rap.fouten.push(r.naam + ' (bevestiging uitdiensttreding): ' + e.message); }
      }
      rap.gevonden.push({ naam: r.naam, email: r.email, verzonden: r.verzenddatum, rij: r.rij, eerder: r.aantalHer, type: r.type, gestopt: true }); continue;
    }
    rap.gevonden.push({ naam: r.naam, email: r.email, verzonden: r.verzenddatum, rij: r.rij, eerder: r.aantalHer, type: r.type });
    await mailOfDroog(rap, {
      to: r.email, subject: 'Even een herinnering: je ondertekende brief',
      text: 'Beste ' + String(r.naam || '').split(' ')[0] + ',\n\nWe hebben de ondertekende brief nog niet van je terug ontvangen. Wil je hem nog even uploaden? Dat kan hier:\n' + T.prefillOntslagUrl(r.naam) + '\n\nLukt het niet of heb je een vraag? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\n' + C.AFZENDER_NAAM + '\n' + bv,
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
// Deadline in de uitnodiging: de startdatum; ligt die al achter ons (of binnen 3 dagen), dan vandaag + 3 dagen.
function loonDeadline(startTekst, vandaag) {
  const st = parseNLDatum(startTekst), min = plusDagen(vandaag, C.LOON_AUTO_MIN_DAGEN || 3);
  const d = st && st >= min ? st : min;
  return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
}
const loonAutoAan = async () => (await require('./instellingen').lees('loon_auto', false)) === true;
// Uitnodiging versturen + vastleggen in hr_loonheffing (zelfde kolommen als loonheffing-mail.js), taal 'NL/EN'
async function loonUitnodigen(p, deadline) {
  const id = C.SHEETS.loonheffing.id, nu = stempel(), email = String(p.email).trim().toLowerCase();
  const resendId = await M.verstuur({ to: email, subject: T.LOON_TWEETALIG_ONDERWERP.uitnodiging, text: T.personaliseerUploadLinks(T.loonPlainTweetalig('uitnodiging', p.naam, deadline), p.naam), html: T.loonHtmlTweetalig('uitnodiging', p.naam, deadline), tags: [{ name: 'bron', value: 'loonheffing' }, { name: 'type', value: 'uitnodiging-auto' }] });
  let rij = await S.vindLoonRij(email);
  if (!rij) {
    rij = await S.eersteLegeLoonRij();
    await S.zetCel(id, null, rij, 1, p.naam); await S.zetCel(id, null, rij, 2, email); await S.zetCel(id, null, rij, 7, 'NL/EN');
  }
  await S.zetCel(id, null, rij, 3, deadline);
  await S.zetCel(id, null, rij, 4, 'Verzonden op ' + nu, S.KLEUR.groen);
  await S.zetCel(id, null, rij, 5, nu);
  await M.logMail({ door: 'signalering', bron: 'loonheffing', type: 'uitnodiging', naar: email, naam: p.naam, onderwerp: T.LOON_TWEETALIG_ONDERWERP.uitnodiging, taal: 'NL/EN', rij, resend_id: resendId });
  return { rij, resendId };
}
async function nieuweMedewerkers(droog) {
  const rap = { naam: 'nieuwe-medewerkers', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const [med, loon] = await Promise.all([SB.getMedewerkers(true), S.getLoonheffing()]);
  const loonEmails = {}, loonNamen = {};
  loon.forEach(r => { const e = r.email.toLowerCase(); if (e) loonEmails[e] = true; const n = normNaam(r.naam); if (n) loonNamen[n] = true; });
  const vandaag = vandaag0();
  const nieuw = vindNieuweMedewerkers(med, loonEmails, loonNamen, vandaag);
  rap.gevonden = nieuw;
  if (!nieuw.length) return rap;
  // De check draait elke 4 uur; het HR-lijstje (schakelaar uit) of 'zonder e-mail' gaat alleen mee met de eerste run van de dag.
  const eersteRun = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false })) < 11;
  const auto = await loonAutoAan();
  rap.automatisch = auto;
  if (auto) {
    const zonderMail = [], verstuurd = [];
    for (const p of nieuw) {
      if (!p.email || p.email.indexOf('@') === -1) { zonderMail.push(p); continue; }
      const deadline = loonDeadline(p.start, vandaag);
      if (rap.droog) { rap.verstuurd.push({ droog: true, naam: p.naam, email: p.email, deadline }); continue; }
      try { const r = await loonUitnodigen(p, deadline); verstuurd.push(Object.assign({ deadline }, p)); rap.verstuurd.push({ naam: p.naam, email: p.email, deadline, rij: r.rij, resendId: r.resendId }); }
      catch (e) { rap.fouten.push(p.naam + ': ' + e.message); zonderMail.push(Object.assign({ fout: e.message }, p)); }
    }
    rap.gevonden = zonderMail; // wat overblijft is nog een taak voor HR
    const meld = zonderMail.filter(p => p.fout || eersteRun);
    if (rap.droog || (!verstuurd.length && !meld.length)) return rap;
    const regel = p => '- ' + p.naam + ' (' + p.winkel + ', start ' + p.start + (p.deadline ? ', deadline ' + p.deadline : '') + (p.fout ? ' — FOUT: ' + p.fout : '') + ')';
    const plain = 'Hallo,\n\n' + (verstuurd.length ? 'Automatisch verstuurd (indiensttredings- en loonheffingsformulier, NL + EN):\n' + verstuurd.map(regel).join('\n') + '\n\n' : '') + (meld.length ? 'Kon NIET automatisch (geen e-mailadres in Shiftbase of fout) — handmatig versturen:\n' + meld.map(regel).join('\n') + '\n\n' : '') + '(Automatisch bericht van het SLA HR Dashboard)';
    const html = T.slaWrap(T.slaHead('#009f4b', 'HR &middot; Nieuwe medewerkers') + '<tr><td style="padding:32px 36px 28px"><pre style="' + F + 'font-size:13px;color:#333d3a;white-space:pre-wrap;margin:0">' + esc(plain) + '</pre></td></tr>' + T.slaFoot());
    const id = await M.verstuur({ to: ontvangers('nieuweMedewerkers'), subject: 'Nieuwe medewerkers: ' + verstuurd.length + ' uitnodiging(en) automatisch verstuurd' + (meld.length ? ', ' + meld.length + ' handmatig' : ''), text: plain, html, tags: [{ name: 'bron', value: 'signalering' }, { name: 'type', value: 'nieuwe-medewerkers' }] }).catch(e => { rap.fouten.push('HR-overzicht: ' + e.message); return null; });
    if (id) await M.logMail({ door: 'signalering', bron: 'signalering', type: 'nieuwe-medewerkers', naar: ontvangers('nieuweMedewerkers').join(','), naam: 'HR-team', onderwerp: 'Nieuwe medewerkers (automatisch)', taal: 'NL', rij: 0, resend_id: id });
    return rap;
  }
  if (!eersteRun) return rap; // schakelaar uit: HR-lijstje één keer per dag, zoals voorheen
  const plain = 'Hallo,\n\nDeze medewerkers zijn recent gestart (of starten binnenkort) volgens Shiftbase, maar hebben nog geen loonheffingsuitnodiging vanuit het HR Dashboard ontvangen:\n\n' + nieuw.map(p => '- ' + p.naam + ' (' + p.winkel + ', start ' + p.start + ')').join('\n') + '\n\n(Automatisch bericht van het SLA HR Dashboard)';
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
// v0.25.4: aanzeg-signalen gaan niet meer in een eigen mail maar in de dagelijkse contractmail (contractketen, 10:00),
// één kaart per persoon. Deze check legt de lijst nog wel vast voor Taken/Overzicht.
async function aanzegLijst(med) {
  const [m2, cons, ontslag] = await Promise.all([med ? med : SB.getMedewerkers(true), SB.sbGet('contracts').then(c => (c && c.data) || c || []), S.getOntslag(true)]); // incl. archief: een gearchiveerde aanzegging is wél verstuurd
  const verzE = {}, verzN = {};
  ontslag.forEach(r => { if (String(r.status || '').indexOf('Verzonden') !== 0) return; const e = r.email.toLowerCase(); if (e) verzE[e] = true; const n = normNaam(r.naam); if (n) verzN[n] = true; });
  return vindAflopendeContracten(m2, cons, verzE, verzN, vandaag0(), C.AANZEG_VENSTER_DAGEN);
}
async function aanzegtermijnen(droog) {
  const rap = { naam: 'aanzegtermijnen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  rap.gevonden = await aanzegLijst();
  rap.opmerking = 'Geen eigen mail meer: staat in de dagelijkse contractmail (10:00)';
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
  const lijst = await zonderVertrekkers(bepaalStilleAfwezigen(med, ros, abs, vandaag, C.STIL_VENSTER_DAGEN, C.STIL_UITGESLOTEN_WINKELS), rap);
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
  const lijst = await zonderVertrekkers(W.bepaalWeekendOntwijkers(med, ros, abs, vandaag, weken, C.WEEKEND_UITGESLOTEN_WINKELS), rap);
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

// ============================================================
// Fase 2: juridische checks (contractketen/proeftijd, verzuim/Poortwachter, jeugd, oproepaanbod)
// ============================================================
const KT = require('./contracten');
const VZ = require('./verzuim');
const JG = require('./jeugd');
const OP = require('./oproep');

// Generieke HR-mail met blokken per item (zelfde huisstijl als de andere checks)
function blokMail(kleur, kop, intro, items, tip, voet) {
  const blokken = items.map(i => '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid ' + (i.kleur || kleur) + '"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + esc(i.titel) + (i.sub ? ' <span style="font-weight:400;color:#888078;font-size:12px">&middot; ' + esc(i.sub) + '</span>' : '') + '</p><p style="' + F + 'font-size:12px;color:#666;margin:0;line-height:1.6">' + i.html + '</p></td></tr></table>').join('');
  return T.slaWrap(T.slaHead(kleur, kop) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">' + intro + '</p>' + blokken + (tip ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">' + tip + '</td></tr></table>' : '') + '<p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">' + esc(voet || 'Automatisch bericht van het SLA HR Dashboard') + '</p></td></tr>' + T.slaFoot());
}

// ---- 12. Contractketen + proeftijd (dagelijks) ----
async function contractketen(droog) {
  const rap = { naam: 'contractketen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const med = await SB.getMedewerkers(true);
  const [per, corr, aanzeg] = await Promise.all([SB.getContractenPerUser(true), require('./instellingen').lees('keten_correcties', {}),
    aanzegLijst(med).catch(e => { rap.fouten.push('aanzegtermijnen: ' + e.message); return []; })]);
  const lijst = await zonderVertrekkers(KT.contractSignalen(med, per, vandaag0(), corr || {}), rap);
  rap.gevonden = lijst; rap.aanzeg = aanzeg.length;
  if (!lijst.length && !aanzeg.length) return rap;
  // Vastgelegde besluiten (tab Verlengingen) per naam: dan geen alarm meer, maar de vervolgstap
  const besluit = {};
  try {
    const naamVan = {}; med.forEach(m => { naamVan[String(m.id)] = m.naam; });
    const { data } = await admin().from('hr_verlenging').select('medewerker_id,contract_eind,besluit,besloten_door,besloten_op').gte('contract_eind', isoDag(vandaag0()));
    (data || []).sort((a, b) => String(a.besloten_op).localeCompare(String(b.besloten_op))).forEach(b => { const n = naamVan[String(b.medewerker_id)]; if (n) besluit[normNaam(n)] = b; });
  } catch (e) { rap.fouten.push('besluiten: ' + e.message); }
  const mail = contractMail(lijst, aanzeg, besluit);
  await mailOfDroog(rap, { to: ontvangers('contractketen'), subject: mail.subject, text: mail.plain, html: mail.html, kort: { naam: 'HR-team', aantal: mail.personen } });
  return rap;
}
// Eén kaart per persoon met alle contractsignalen (aanzegtermijn, keten, van rechtswege vast, proeftijd); urgentste eerst.
function contractMail(lijst, aanzeg, besluit) {
  besluit = besluit || {};
  const P = {}, pers = x => { const k = normNaam(x.naam) || x.naam; return P[k] || (P[k] = { naam: x.naam, winkel: x.winkel || '-', regels: [], plain: [], score: 9, kleur: '#009f4b', eind: '', dagenTotEinde: null }); };
  const zet = (p, score, kleur) => { if (score < p.score) { p.score = score; p.kleur = kleur; } };
  for (const a of aanzeg) {
    const p = pers(a); p.eind = a.einddatum; p.dagenTotEinde = a.dagenTotEinde; p.dl = a.dagenTotDeadline;
    if (a.dagenTotDeadline < 0) { zet(p, 0, '#c0392b'); p.regels.push('<strong style="color:#c0392b">Aanzegdeadline ' + (-a.dagenTotDeadline) + ' dagen verstreken</strong> &mdash; nog geen aanzegging verstuurd; pro-rata aanzegvergoeding loopt op: nu ' + (-a.dagenTotDeadline) + '/30 maandloon.'); p.plain.push('AANZEGDEADLINE ' + (-a.dagenTotDeadline) + ' DAGEN VERSTREKEN (' + (-a.dagenTotDeadline) + '/30 maandloon)'); }
    else if (a.dagenTotDeadline <= 7) { zet(p, 1, '#e8824a'); p.regels.push('<strong style="color:#9a4a1a">Aanzegdeadline ' + (a.dagenTotDeadline === 0 ? 'vandaag' : 'over ' + a.dagenTotDeadline + ' dagen') + '</strong> &mdash; nog geen aanzegging verstuurd: deze week beslissen.'); p.plain.push('aanzegdeadline ' + (a.dagenTotDeadline === 0 ? 'VANDAAG' : 'over ' + a.dagenTotDeadline + ' dagen')); }
    else { zet(p, 3, '#009f4b'); p.regels.push('Aanzegdeadline over ' + a.dagenTotDeadline + ' dagen &mdash; nog geen aanzegging verstuurd.'); p.plain.push('aanzegdeadline over ' + a.dagenTotDeadline + ' dagen'); }
  }
  for (const x of lijst) {
    const p = pers(x);
    if (x.soort === 'vast') { zet(p, 1, '#c0392b'); if (!p.eind) p.eind = x.einddatum; p.verlengd = x.verlengdTot; p.regels.push('<strong style="color:#c0392b">Van rechtswege vast?</strong> &mdash; ' + esc(x.reden) + ' (keten: ' + x.aantal + ' contracten, ' + x.maanden + ' maanden). Het vervolgcontract geldt dan als <strong>onbepaalde tijd</strong>: pas het aan (en zet het in Shiftbase op onbepaald) of corrigeer het aantal in het dossier als de telling niet klopt.'); p.plain.push('mogelijk van rechtswege vast: ' + x.reden); }
    else if (x.soort === 'keten') { zet(p, x.vol ? 2 : 3, x.vol ? '#c0392b' : '#e8824a'); if (!p.eind) { p.eind = x.einddatum; p.dagenTotEinde = x.dagenTotEinde; } p.regels.push((x.vol ? '<strong style="color:#c0392b">Keten vol</strong> &mdash; ' : '<strong>Keten</strong> &mdash; ') + esc(x.reden) + ' (' + x.aantal + ' contract(en), ' + x.maanden + ' maanden).' + (x.vol ? ' Verlengen kan alleen als <strong>onbepaalde tijd</strong>; anders aanzeggen.' : ' Het volgende contract is het laatste tijdelijke; daarna wordt het vast.')); p.plain.push((x.vol ? 'keten vol: ' : 'keten: ') + x.reden); }
    else { zet(p, x.dagenTotEinde <= 7 ? 1 : 3, '#2980b9'); p.inDienst = x.start; p.regels.push('<strong style="color:#2980b9">Proeftijd</strong> (indien schriftelijk overeengekomen) eindigt op <strong>' + esc(x.proeftijdEinde) + '</strong>' + (x.dagenTotEinde >= 0 ? ' &mdash; over ' + x.dagenTotEinde + ' dagen' : ' &mdash; <strong style="color:#c0392b">verstreken</strong>') + '. Gesprek en beslissing vóór die datum; proeftijdontslag daarna is niet meer mogelijk.'); p.plain.push('proeftijd eindigt ' + x.proeftijdEinde + (x.dagenTotEinde < 0 ? ' (verstreken)' : '')); }
  }
  // Besluit vastgelegd? Dan vervangt de vervolgstap de aanzeg-/ketenregels.
  for (const k of Object.keys(P)) {
    const b = besluit[k]; if (!b) continue; const p = P[k], door = b.besloten_door ? ' (vastgelegd door ' + esc(String(b.besloten_door).split('@')[0]) + ')' : '';
    const proef = p.regels.filter(r => /Proeftijd/.test(r)), dl = p.dl;
    if (b.besluit === 'zelf-opgezegd') { p.regels = ['<strong style="color:#9a4a1a">Medewerker stopt zelf</strong>' + door + ' &mdash; verstuur nog de <strong>ontslagbevestiging</strong> en laat die digitaal ondertekenen; dan verdwijnt de melding.']; p.plain = ['medewerker stopt zelf: ontslagbevestiging nog versturen']; p.score = 1; p.kleur = '#e8824a'; }
    else if (b.besluit === 'niet-verlengen') { p.regels = ['<strong style="color:#9a4a1a">Besloten: niet verlengen</strong>' + door + ' &mdash; verstuur de <strong>aanzegging</strong>' + (dl != null ? (dl < 0 ? ' (deadline al ' + (-dl) + ' dagen verstreken)' : ' (deadline over ' + dl + ' dagen)') : '') + '.']; p.plain = ['besloten niet verlengen: aanzegging nog versturen']; p.score = dl != null && dl < 0 ? 0 : 1; p.kleur = dl != null && dl < 0 ? '#c0392b' : '#e8824a'; }
    else if (/^verlengen/.test(b.besluit)) { p.regels = ['<strong style="color:#006b30">Besloten: ' + (b.besluit === 'verlengen-vast' ? 'vast contract' : 'verlengen') + '</strong>' + door + ' &mdash; zet het nieuwe contract in Shiftbase; dan verdwijnt de melding.'].concat(proef); p.plain = ['besloten verlengen: contract nog in Shiftbase zetten']; p.score = 3; p.kleur = '#009f4b'; }
  }
  const alle = Object.values(P).sort((a, b) => a.score - b.score || (a.dl != null ? a.dl : 999) - (b.dl != null ? b.dl : 999) || (a.dagenTotEinde != null ? a.dagenTotEinde : 999) - (b.dagenTotEinde != null ? b.dagenTotEinde : 999) || a.naam.localeCompare(b.naam, 'nl'));
  const sub = p => p.winkel + (p.eind ? ' · contract eindigt ' + p.eind + (p.verlengd ? ', verlengd t/m ' + p.verlengd : p.dagenTotEinde != null ? ' (over ' + p.dagenTotEinde + ' dagen)' : '') : p.inDienst ? ' · in dienst ' + p.inDienst : '');
  const kaart = p => '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid ' + p.kleur + '"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 6px">' + esc(p.naam) + ' <span style="font-weight:400;color:#888078;font-size:12px">&middot; ' + esc(sub(p)) + '</span></p>' + p.regels.map(r => '<p style="' + F + 'font-size:12px;color:#555;margin:0 0 4px;line-height:1.6">' + r + '</p>').join('') + '</td></tr></table>';
  const kop = t => '<p style="' + F + 'font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888078;margin:18px 0 8px">' + t + '</p>';
  const nu = alle.filter(p => p.score <= 1), later = alle.filter(p => p.score > 1);
  const teLaat = alle.filter(p => p.score === 0).length, nKeten = lijst.filter(x => x.soort !== 'proeftijd').length, nProef = lijst.filter(x => x.soort === 'proeftijd').length;
  const delen = [teLaat ? teLaat + ' aanzegdeadline(s) verstreken' : '', nu.length ? nu.length + ' actie deze week' : '', alle.length + ' medewerker(s)'].filter(Boolean);
  const subject = (teLaat ? '⚠ ' : '') + 'Contracten: ' + delen.join(' · ');
  const intro = 'Alle contractsignalen van vandaag, <strong>één kaart per medewerker</strong>: aanzegtermijnen (contract loopt binnen ' + C.AANZEG_VENSTER_DAGEN + ' dagen af zonder verstuurde aanzegging, art. 7:668 BW), ketenregeling (na ' + C.KETEN_MAX_CONTRACTEN + ' tijdelijke contracten of ' + C.KETEN_MAX_MAANDEN + ' maanden volgt onbepaalde tijd, art. 7:668a BW) en proeftijden (art. 7:652 BW).' + ' <span style="color:#888078">(' + aanzeg.length + ' zonder aanzegging · ' + nKeten + ' ketensignaal · ' + nProef + ' proeftijd)</span>';
  const html = T.slaWrap(T.slaHead('#e8824a', 'HR &middot; Contracten &amp; aanzegtermijnen') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 8px">' + intro + '</p>'
    + (nu.length ? kop('Actie deze week (' + nu.length + ')') + nu.map(kaart).join('') : '') + (later.length ? kop('Komende weken (' + later.length + ')') + later.map(kaart).join('') : '')
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:12px 16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:12px;color:#006b30;line-height:1.6">&#10003; <strong>Niet verlengen:</strong> HR Dashboard &rarr; Uitstroom &rarr; Ontslag &amp; aanzegging &rarr; Aanzegging. <strong>Wel verlengen:</strong> zet het nieuwe contract in Shiftbase; dan verdwijnt de melding vanzelf.</td></tr></table><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0;text-align:center">Automatisch bericht &mdash; dagelijkse contractcheck</p></td></tr>' + T.slaFoot());
  const pl = p => '- ' + p.naam + ' (' + sub(p) + '): ' + p.plain.join('; ');
  const plain = 'Hallo,\n\nContractsignalen van vandaag (één regel per medewerker):\n' + (nu.length ? '\nACTIE DEZE WEEK:\n' + nu.map(pl).join('\n') + '\n' : '') + (later.length ? '\nKOMENDE WEKEN:\n' + later.map(pl).join('\n') + '\n' : '') + '\nNiet verlengen: HR Dashboard -> Ontslag & aanzegging -> Aanzegging. Wel verlengen: zet het contract in Shiftbase.\n\n(Automatisch bericht van het SLA HR Dashboard)';
  return { subject, html, plain, personen: alle.length };
}

// ---- 13. Verzuim / Wet verbetering poortwachter (dagelijks) ----
async function verzuim(droog) {
  const rap = { naam: 'verzuim', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0();
  const [med, abs] = await Promise.all([SB.getMedewerkers(true), SB.sbGet('absentees?min_date=' + isoDag(plusDagen(vandaag, -C.VERZUIM_TERUGKIJK_DAGEN)) + '&max_date=' + isoDag(plusDagen(vandaag, 60))).then(r => (r && r.data) || r || [])]);
  const periodes = VZ.ziekteperiodes(abs, vandaag);
  const lijst = VZ.verzuimSignalen(med, periodes, vandaag);
  rap.gevonden = lijst;
  if (!lijst.length) return rap;
  const items = lijst.map(x => x.soort === 'mijlpaal'
    ? { kleur: x.teLaat ? '#c0392b' : '#e8824a', titel: x.naam, sub: x.winkel + ' · ziek sinds ' + x.sinds + ' (dag ' + x.dag + ')', html: '<strong>' + esc(x.mijlpaal) + '</strong>' + (x.over > 0 ? ' — over ' + x.over + ' dagen' : x.over === 0 ? ' — <strong>vandaag</strong>' : ' — <strong style="color:#c0392b">' + (-x.over) + ' dagen geleden (nog niet vastgelegd?)</strong>') }
    : x.soort === 'frequent'
      ? { kleur: '#2980b9', titel: x.naam, sub: x.winkel, html: '<strong>Frequent verzuim:</strong> ' + x.meldingen + ' ziekmeldingen in 12 maanden (laatste ' + esc(x.laatste) + '). Plan een verzuimgesprek: wat speelt er, en wat is er nodig?' }
      : { kleur: '#888078', titel: x.naam, sub: x.winkel + ' · ziek sinds ' + x.sinds, html: 'Lopend verzuim, dag ' + x.dag + '. Houd contact (wekelijks) en leg afspraken vast in het dossier.' });
  const plain = 'Hallo,\n\nVerzuimsignalen:\n' + lijst.map(x => '- ' + x.naam + ' (' + x.winkel + '): ' + (x.soort === 'mijlpaal' ? x.mijlpaal + (x.over >= 0 ? ' over ' + x.over + ' dagen' : ' ' + (-x.over) + ' dagen geleden') : x.soort === 'frequent' ? 'frequent verzuim (' + x.meldingen + 'x in 12 mnd)' : 'lopend verzuim dag ' + x.dag)).join('\n') + '\n\n(Automatisch bericht van het SLA HR Dashboard)';
  await mailOfDroog(rap, { to: ontvangers('verzuim'), subject: 'Verzuim: ' + lijst.filter(x => x.soort === 'mijlpaal').length + ' Poortwachter-mijlpa(a)l(en), ' + lijst.filter(x => x.soort === 'frequent').length + 'x frequent verzuim', text: plain, html: blokMail('#e8824a', 'HR &middot; Verzuim &amp; Poortwachter', 'Op basis van de ziekmeldingen in Shiftbase (status goedgekeurd; periodes korter dan 4 weken uit elkaar tellen als één ziektegeval):', items, 'Mijlpalen uit de Wet verbetering poortwachter: week 6 probleemanalyse (bedrijfsarts), week 8 plan van aanpak, week 42 UWV-melding, week 52 eerstejaarsevaluatie. Een onvolledig dossier kan een loonsanctie van UWV opleveren.', 'Dagelijkse verzuimcheck'), kort: { naam: 'HR-team', aantal: lijst.length } });
  return rap;
}

// ---- 14. Jeugd: minimumjeugdloon-verjaardagen + Arbeidstijdenwet-roostercheck < 18 (wekelijks) ----
async function jeugd(droog) {
  const rap = { naam: 'jeugd', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0();
  const med = await SB.getMedewerkers(true);
  const jong = med.filter(m => m.leeftijd != null && m.leeftijd < 18);
  let ros = [];
  if (jong.length) ros = await SB.sbGet('rosters?min_date=' + isoDag(vandaag) + '&max_date=' + isoDag(plusDagen(vandaag, C.ATW_DAGEN_VOORUIT))).then(r => (r && r.data) || r || []).catch(e => { rap.fouten.push('roosters: ' + e.message); return []; });
  const vj = JG.verjaardagen(med, vandaag).map(x => Object.assign({ soort: 'verjaardag' }, x));
  const atw = JG.atwOvertredingen(med, ros, vandaag).map(x => Object.assign({ soort: 'atw' }, x));
  rap.gevonden = atw.concat(vj);
  rap.zonderGeboortedatum = med.filter(m => m.leeftijd == null).length;
  if (!rap.gevonden.length) return rap;
  const items = atw.map(x => ({ kleur: '#c0392b', titel: x.naam + ' (' + x.leeftijd + ')', sub: x.winkel + ' · ' + x.datum + (x.dienst ? ' · ' + x.dienst : ''), html: '<strong>Rooster past niet bij de Arbeidstijdenwet:</strong> ' + esc(x.wat) + '. Regel: ' + esc(x.regel) + '.' }))
    .concat(vj.map(x => ({ kleur: '#009f4b', titel: x.naam, sub: x.winkel + ' · wordt ' + x.wordt + ' op ' + x.op + (x.over === 0 ? ' (vandaag)' : ' (over ' + x.over + ' dagen)'), html: 'Minimumjeugdloon stijgt per die datum — doorgeven aan de salarisadministratie (' + esc(C.SALARIS_EMAIL) + ').' })));
  const plain = 'Hallo,\n\n' + (atw.length ? 'Arbeidstijdenwet (<18):\n' + atw.map(x => '- ' + x.naam + ' (' + x.leeftijd + ', ' + x.winkel + ') ' + x.datum + ': ' + x.wat).join('\n') + '\n\n' : '') + (vj.length ? 'Verjaardagen (minimumjeugdloon):\n' + vj.map(x => '- ' + x.naam + ' (' + x.winkel + ') wordt ' + x.wordt + ' op ' + x.op).join('\n') + '\n\n' : '') + '(Automatisch bericht van het SLA HR Dashboard)';
  await mailOfDroog(rap, { to: ontvangers('jeugd'), subject: 'Jeugd: ' + atw.length + ' roosterafwijking(en) ATW, ' + vj.length + ' verjaardag(en) minimumjeugdloon', text: plain, html: blokMail('#2980b9', 'HR &middot; Jeugd: rooster &amp; jeugdloon', 'Medewerkers onder de 18 en verjaardagen tot en met ' + C.JEUGD_LOON_MAX_LEEFTIJD + ' jaar in de komende ' + C.JEUGD_VERJAARDAG_DAGEN + ' dagen:', items, 'Roosterafwijkingen: pas het rooster in Shiftbase aan vóór de dienst. Verjaardagen: het wettelijk minimumjeugdloon geldt vanaf de verjaardag zelf; de salarisadministratie moet dit per loonrun verwerken.' + (rap.zonderGeboortedatum ? ' Let op: bij ' + rap.zonderGeboortedatum + ' medewerker(s) ontbreekt de geboortedatum in Shiftbase.' : ''), 'Wekelijkse jeugdcheck'), kort: { naam: 'HR-team', aantal: rap.gevonden.length } });
  return rap;
}

// ---- 15. Oproepaanbod na 12 maanden (wekelijks) ----
async function oproepaanbod(droog) {
  const rap = { naam: 'oproepaanbod', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const vandaag = vandaag0();
  const [med, per, aanbod] = await Promise.all([SB.getMedewerkers(true), SB.getContractenPerUser(true), S.getOproepaanbod().catch(() => [])]);
  const kandidaat = med.filter(m => OP.oproepSinds(per[String(m.id)] || [], vandaag));
  if (!kandidaat.length) return rap;
  const ros = await SB.sbGet('rosters?min_date=' + isoDag(plusDagen(vandaag, -400)) + '&max_date=' + isoDag(vandaag)).then(r => (r && r.data) || r || []).catch(e => { rap.fouten.push('roosters: ' + e.message); return []; });
  const laatste = {};
  for (const r of aanbod) { const d = parseNLDatum(r.verzenddatum); if (!d) continue; const isoD = isoDag(d); const e = String(r.email || '').toLowerCase(), n = normNaam(r.naam); if (e && (!laatste[e] || laatste[e] < isoD)) laatste[e] = isoD; if (n && (!laatste[n] || laatste[n] < isoD)) laatste[n] = isoD; }
  const lijst = await zonderVertrekkers(OP.oproepSignalen(med, per, ros, laatste, vandaag), rap);
  rap.gevonden = lijst;
  if (!lijst.length) return rap;
  const items = lijst.map(x => ({ kleur: x.teLaat ? '#c0392b' : '#e8824a', titel: x.naam, sub: x.winkel + ' · oproep sinds ' + x.sinds + ' (' + x.contractType + ')', html: '12-maandsgrens <strong>' + esc(x.grens) + '</strong>' + (x.teLaat ? ' — <strong style="color:#c0392b">' + (-x.over) + ' dagen verstreken</strong>; de medewerker kan loon claimen over niet-aangeboden uren' : ' — over ' + x.over + ' dagen') + '. Gemiddeld <strong>' + x.gemPerWeek + ' u/week</strong> (' + x.diensten + ' diensten, ' + esc(x.periode) + ').' + (x.laatsteAanbod ? ' Laatste aanbod: ' + esc(x.laatsteAanbod) + ' (herhaling na 12 maanden).' : '') }));
  const plain = 'Hallo,\n\nOproepkrachten die een aanbod vaste arbeidsomvang moeten krijgen (art. 7:628a lid 5 BW):\n' + lijst.map(x => '- ' + x.naam + ' (' + x.winkel + '): grens ' + x.grens + ', gemiddeld ' + x.gemPerWeek + ' u/week').join('\n') + '\n\nVerstuur het aanbod via HR Dashboard → In dienst → Oproepaanbod.\n\n(Automatisch bericht van het SLA HR Dashboard)';
  await mailOfDroog(rap, { to: ontvangers('oproepaanbod'), subject: 'Oproepaanbod: ' + lijst.length + ' medewerker(s) bereiken de 12-maandsgrens' + (lijst.some(x => x.teLaat) ? ' (' + lijst.filter(x => x.teLaat).length + ' al verstreken)' : ''), text: plain, html: blokMail('#e8824a', 'HR &middot; Aanbod vaste arbeidsomvang', 'Deze oproepkrachten werken (bijna) 12 maanden op oproepbasis. De wet verplicht binnen een maand een schriftelijk aanbod van ten minste het gemiddelde aantal uren:', items, 'Verstuur het aanbod met brief + PDF via <strong>In dienst &rarr; Oproepaanbod</strong>. De medewerker mag weigeren; dan volgend jaar opnieuw aanbieden. Contracttype-herkenning via OPROEP_TREFWOORDEN in config.js.', 'Wekelijkse oproepcheck'), kort: { naam: 'HR-team', aantal: lijst.length } });
  return rap;
}

// ---- 16. Check-in na 30/60 dagen (fase 3a, dagelijks) ----
// Uitnodigen wie vandaag binnen het venster valt + één herinnering na CHECKIN_HERINNERING_DAGEN. Geen samenvattingsmail aan HR:
// alleen een lage check-in levert direct een mail op (bij het invullen, _lib/checkin.meldLaag). Echt versturen alleen als
// SIGNALERINGEN_ACTIEF=1 én de check-in aan staat (Instroom → Check-in 30/60); anders droog: alleen rapporteren wie het zou zijn.
async function checkin(droog) {
  const CI = require('./checkin');
  const aan = await CI.actief();
  const rap = { naam: 'checkin', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() || !aan, gepauzeerd: !aan };
  const vandaag = vandaag0();
  const [med, set] = await Promise.all([SB.getMedewerkers(true), CI.bestaande()]);
  for (const k of CI.kandidaten(med, set, vandaag)) {
    rap.gevonden.push(Object.assign({ soort: 'uitnodiging' }, k));
    if (k.zonderEmail) { rap.fouten.push(k.naam + ': geen e-mailadres in Shiftbase'); continue; }
    if (rap.droog) { rap.verstuurd.push({ droog: true, naam: k.naam, moment: k.moment }); continue; }
    try { const r = await CI.uitnodigen(k, 'signalering', 'schedule'); rap.verstuurd.push({ naam: k.naam, moment: k.moment, id: r.id }); }
    catch (e) { rap.fouten.push(k.naam + ': ' + e.message); }
  }
  // herinneringen: één keer, na X dagen, zolang de link geldig is
  const grens = new Date(Date.now() - C.CHECKIN_HERINNERING_DAGEN * 864e5).toISOString(), oud = new Date(Date.now() - C.CHECKIN_GELDIG_DAGEN * 864e5).toISOString();
  const { data: open, error } = await admin().from('hr_checkin').select('*').is('ingevuld_op', null).is('herinnerd_op', null).lt('verstuurd_op', grens).gt('verstuurd_op', oud);
  if (error) rap.fouten.push('herinneringen: ' + error.message);
  for (const r of open || []) {
    rap.gevonden.push({ soort: 'herinnering', naam: r.naam, winkel: r.winkel, moment: r.moment });
    if (rap.droog) { rap.verstuurd.push({ droog: true, naam: r.naam, herinnering: true }); continue; }
    try { await CI.herinneren(r, 'signalering'); rap.verstuurd.push({ naam: r.naam, herinnering: true }); }
    catch (e) { rap.fouten.push(r.naam + ' (herinnering): ' + e.message); }
  }
  return rap;
}

// ---- Maandrapport (fase 4b): 1e van de maand, rapport over de vorige maand als PDF naar HR ----
async function maandrapport(droog) {
  const MR = require('./maandrapport');
  const rap = { naam: 'maandrapport', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const r = await MR.laad();
  rap.gevonden.push({ naam: 'Maandrapport ' + r.label, maand: r.sleutel, instroom: r.kern.instroom, uitstroom: r.kern.uitstroom, winkelsRood: r.winkels.filter(w => w.rood).map(w => w.naam) });
  r.fouten.forEach(f => rap.fouten.push(f));
  if (rap.droog) { rap.verstuurd.push({ droog: true, naam: 'Maandrapport ' + r.label }); return rap; }
  if (await MR.alVerstuurd(r.sleutel)) { rap.overgeslagen = 'Maandrapport ' + r.label + ' was al verstuurd (opnieuw mailen kan via Scorekaart → Maandrapport).'; return rap; }
  try { const id = await MR.mail(r, ontvangers('maandrapport'), 'signalering'); rap.verstuurd.push({ naam: 'Maandrapport ' + r.label, resendId: id }); }
  catch (e) { rap.fouten.push('mail: ' + e.message); }
  return rap;
}

// ---- Fase 4c: contractverlengingen (dagelijks; geen mail — alleen de takenlijst en het tabblad Contractverlenging) ----
async function laadVerlengingen() {
  const VL = require('./verlenging');
  const [med, per, corr, ontslag, bes] = await Promise.all([SB.getMedewerkers(true), SB.getContractenPerUser(true), require('./instellingen').lees('keten_correcties', {}), S.getOntslag(true),
    admin().from('hr_verlenging').select('*').then(r => { if (r.error) throw new Error(r.error.message); return r.data || []; }).catch(e => { console.warn('hr_verlenging:', e.message); return null; })]);
  const besluiten = {}; (bes || []).forEach(b => { besluiten[VL.sleutel(b.medewerker_id, b.contract_eind)] = b; });
  return { lijst: VL.overzicht(med, per, besluiten, ontslag, vandaag0(), corr || {}), tabelOk: bes !== null };
}
async function verlengingen(droog) {
  const rap = { naam: 'verlengingen', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const { lijst, tabelOk } = await laadVerlengingen();
  if (!tabelOk) rap.fouten.push('hr_verlenging ontbreekt (migratie 0014): besluiten worden nog niet meegenomen');
  rap.gevonden = lijst.filter(x => x.open);
  rap.afgerond = lijst.filter(x => !x.open).length;
  return rap;
}

// ---- MTO (fase 5): restant uitnodigingen, herinneringen na 7 + 14 dagen, sluiten na 21 dagen, HR-seintje in feb/sep ----
async function mto(droog) {
  const MTO = require('./mto');
  const rap = { naam: 'mto', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  let ronde = null;
  try { ronde = await MTO.openRonde(); } catch (e) { rap.fouten.push(e.message); return rap; }
  if (ronde) {
    const dagen = Math.floor((Date.now() - new Date(ronde.gestart_op).getTime()) / 864e5);
    rap.ronde = { naam: ronde.naam, dagen };
    if (ronde.sluit_op && new Date(ronde.sluit_op) < new Date()) {
      rap.gevonden.push({ soort: 'sluiten', naam: ronde.naam });
      if (rap.droog) rap.verstuurd.push({ droog: true, naam: ronde.naam + ' sluiten' });
      else { try { await MTO.sluiten(ronde.id, 'signalering'); rap.verstuurd.push({ naam: ronde.naam + ' gesloten' }); } catch (e) { rap.fouten.push('sluiten: ' + e.message); } }
    } else {
      if (!rap.droog) { try { const d = await MTO.versturenDeel(ronde.id, 'signalering', 20000); if (d.verstuurd) rap.verstuurd.push({ naam: d.verstuurd + ' uitnodigingen (restant)' }); if (d.rest) rap.fouten.push(d.rest + ' uitnodigingen nog niet verstuurd'); } catch (e) { rap.fouten.push('uitnodigingen: ' + e.message); } }
      try {
        for (const h of await MTO.herinneringen(ronde, rap.droog, 'signalering')) {
          if (!h.aantal) continue;
          rap.gevonden.push({ soort: h.soort, naam: ronde.naam, aantal: h.aantal });
          rap.verstuurd.push(Object.assign({ naam: h.aantal + 'x ' + h.soort }, h.droog ? { droog: true } : {}));
        }
      } catch (e) { rap.fouten.push('herinneringen: ' + e.message); }
    }
  }
  try {
    const sleutel = ronde ? null : await MTO.hrHerinneringNodig();
    if (sleutel) {
      rap.gevonden.push({ soort: 'hr-herinnering', naam: 'MTO-ronde starten (' + sleutel + ')' });
      if (rap.droog) rap.verstuurd.push({ droog: true, naam: 'HR-herinnering MTO' });
      else { await MTO.hrHerinnering(sleutel); rap.verstuurd.push({ naam: 'HR-herinnering MTO' }); }
    }
  } catch (e) { rap.fouten.push('hr-herinnering: ' + e.message); }
  return rap;
}

const CHECKS = { 'sync-formulieren': syncFormulieren, 'loonheffing-herinneringen': loonHerinneringen, 'ontslag-herinneringen': ontslagHerinneringen, 'nieuwe-medewerkers': nieuweMedewerkers, 'aanzegtermijnen': aanzegtermijnen, 'stille-afwezigen': stilleAfwezigen, 'weekend-beschikbaarheid': weekendBeschikbaarheid, 'korting-herinneringen': kortingHerinneringen, 'vakantiepieken': vakantiepieken, 'bewaartermijnen': bewaartermijnen, 'data-hygiene': dataHygiene, 'contractketen': contractketen, 'verzuim': verzuim, 'jeugd': jeugd, 'oproepaanbod': oproepaanbod, 'checkin': checkin, 'maandrapport': maandrapport, 'verlengingen': verlengingen, 'exit-survey': exitSurvey, 'salaris': salaris, 'mto': mto };

// Eén check draaien + loggen in hr_signaleringen (migratie 0004). Faalt nooit hard op het loggen.
// ---- Automatisch naar salaris (maandag + donderdag) ----
// Alles wat klaar is maar nog niet naar de salarisadministratie is gestuurd, gaat in één run weg — precies zoals de
// knop "→ Salaris" (één mail per dossier, documenten als bijlage). Alleen als de schakelaar 'salaris_auto' aan staat.
//   loonheffing:   loonheffingsverklaring geüpload (indiensttredingsformulier gaat mee als het er is)
//   ontslag:       ondertekende ontslagbevestiging/aanzegging geüpload (niet-ondertekend loopt via 'bevestiging uitdiensttreding')
//   korting:       formulier loonheffingskorting geüpload
//   overplaatsing: brief verstuurd; ondertekend document gaat mee als het er is (ondertekenen is niet verplicht)
// Oude Google-Drive-uploads kunnen niet automatisch mee: die komen in het overzicht aan HR.
async function salaris(droog) {
  const rap = { naam: 'salaris', gevonden: [], verstuurd: [], fouten: [], handmatig: [], droog: !!droog || !actief() };
  if ((await require('./instellingen').lees('salaris_auto', false)) !== true) { rap.gepauzeerd = true; return rap; }
  const SAL = require('./salaris'), U = require('./uploads');
  // Veiligheidsgrens: alleen dossiers van de laatste SALARIS_AUTO_DAGEN (verzenddatum), en niet al door Mahdia als verwerkt
  // aangevinkt — zo gaan oude dossiers van vóór het stempel (Apps Script-tijd) niet alsnog dubbel naar salaris.
  const vanaf = C.SALARIS_AUTO_VANAF ? new Date(C.SALARIS_AUTO_VANAF + 'T00:00:00') : null;
  let grens = plusDagen(vandaag0(), -(C.SALARIS_AUTO_DAGEN || 60));
  if (vanaf && vanaf > grens) grens = vanaf; // niet verder terug dan SALARIS_AUTO_VANAF (01-10-2026)
  const recent = r => { const d = parseNLDatum(r.verzenddatum); return !!d && d >= grens && r.mahdia !== 'Ja'; };
  const klaar = {
    loonheffing: r => recent(r) && !r.salaris && !!r.docUrl,
    ontslag: r => recent(r) && !r.salaris && r.ondertekend === 'Ja' && !!r.docUrl,
    korting: r => recent(r) && !r.salaris && !!r.docUrl,
    overplaatsing: r => recent(r) && !r.salaris && String(r.status || '').indexOf('Verstuurd') === 0
  };
  for (const type of Object.keys(klaar)) {
    let lijst = [];
    try { lijst = (await SAL.lijstVan(type)).filter(klaar[type]); } catch (e) { rap.fouten.push(type + ': ' + e.message); continue; }
    for (const r of lijst) {
      const item = { type, naam: r.naam, rij: r.rij };
      const oud = [r.docUrl, r.docUrl2].filter(u => u && !U.isRef(u));
      if (oud.length) { rap.handmatig.push(Object.assign({ reden: 'document staat nog in Google Drive (oud formulier)' }, item)); continue; }
      rap.gevonden.push(item);
      if (rap.droog) { rap.verstuurd.push(Object.assign({ droog: true }, item)); continue; }
      try {
        const uit = await SAL.stuur(type, r, 'signalering', { zonderDocument: true });
        if (uit && uit.success === false) rap.handmatig.push(Object.assign({ reden: uit.bericht || 'niet verstuurd' }, item));
        else rap.verstuurd.push(Object.assign({ resendId: uit && uit.resendId }, item));
      } catch (e) { rap.fouten.push(type + ' ' + r.naam + ': ' + e.message); }
    }
  }
  // Kort overzicht aan HR (alleen als er iets is gebeurd of handmatig moet)
  if (!rap.droog && (rap.verstuurd.length || rap.handmatig.length || rap.fouten.length)) {
    const lbl = { loonheffing: 'Loonheffing/indiensttreding', ontslag: 'Ontslag/aanzegging (ondertekend)', korting: 'Loonheffingskorting', overplaatsing: 'Overplaatsing' };
    const regel = x => '- ' + (lbl[x.type] || x.type) + ': ' + x.naam + (x.reden ? ' — ' + x.reden : '');
    const plain = 'Hallo,\n\nAutomatisch naar de salarisadministratie (' + C.SALARIS_EMAIL + ') gestuurd:\n' + (rap.verstuurd.length ? rap.verstuurd.map(regel).join('\n') : '- niets') + '\n\n'
      + (rap.handmatig.length ? 'Kon niet automatisch — graag handmatig via de knop "→ Salaris":\n' + rap.handmatig.map(regel).join('\n') + '\n\n' : '')
      + (rap.fouten.length ? 'Fouten:\n' + rap.fouten.map(f => '- ' + f).join('\n') + '\n\n' : '') + '(Automatisch bericht van het SLA HR Dashboard, maandag en donderdag)';
    const html = T.slaWrap(T.slaHead('#2b6cb0', 'HR &middot; Naar salaris') + '<tr><td style="padding:32px 36px 28px"><pre style="' + F + 'font-size:13px;color:#333d3a;white-space:pre-wrap;margin:0">' + esc(plain) + '</pre></td></tr>' + T.slaFoot());
    try { await M.verstuur({ to: ontvangers('salaris'), subject: 'Naar salaris: ' + rap.verstuurd.length + ' dossier(s) verstuurd' + (rap.handmatig.length ? ', ' + rap.handmatig.length + ' handmatig' : ''), text: plain, html, tags: [{ name: 'bron', value: 'signalering' }, { name: 'type', value: 'salaris' }] }); }
    catch (e) { rap.fouten.push('HR-overzicht: ' + e.message); }
  }
  return rap;
}

// ---- Exit-survey na de laatste werkdag ----
// Iedereen uit Ontslag & aanzegging (ook gearchiveerd) van wie de einddatum gisteren was — of tot EXIT_AUTO_INHAAL_DAGEN
// terug, zodat een gemiste dag wordt ingehaald — krijgt automatisch de exit-survey, tenzij hij al is uitgenodigd of al
// heeft ingevuld. Alleen als de survey aan staat (Uitstroom → Exit-surveys). In de brief/mail stond al de aankondiging.
async function exitSurvey(droog) {
  const rap = { naam: 'exit-survey', gevonden: [], verstuurd: [], fouten: [], droog: !!droog || !actief() };
  const X = require('./exit');
  if (!(await X.actief())) { rap.gepauzeerd = true; return rap; }
  const vandaag = vandaag0(), van = isoDag(plusDagen(vandaag, -(C.EXIT_AUTO_INHAAL_DAGEN || 7))), tot = isoDag(plusDagen(vandaag, -1));
  const db = admin();
  const [rijen, { data: exitMails }, { data: ingevuld }, { data: ontslagMails }] = await Promise.all([
    S.getOntslag(true),
    db.from('hr_mails').select('naam,naar').eq('bron', 'exit'),
    db.from('hr_exit').select('naam,email'),
    db.from('hr_mails').select('naam,type,taal,onderwerp,tijdstip').eq('bron', 'ontslag').order('tijdstip', { ascending: false }).limit(2000)
  ]);
  const al = new Set();
  (exitMails || []).forEach(m => { if (m.naar) al.add('e:' + String(m.naar).toLowerCase()); if (m.naam) al.add('n:' + normNaam(m.naam)); });
  (ingevuld || []).forEach(m => { if (m.email) al.add('e:' + String(m.email).toLowerCase()); if (m.naam) al.add('n:' + normNaam(m.naam)); });
  const brief = {}; // laatste (niet-herinnering) ontslagmail per naam → taal + soort
  (ontslagMails || []).forEach(m => { const k = normNaam(m.naam); if (k && !brief[k] && !/herinnering/.test(String(m.type || ''))) brief[k] = m; });
  for (const r of rijen) {
    const d = parseNLDatum(r.einddatum); if (!d) continue;
    const iso = isoDag(d); if (iso < van || iso > tot) continue;
    const email = String(r.email || '').trim().toLowerCase(), nn = normNaam(r.naam);
    if (!email || email.indexOf('@') === -1) { rap.fouten.push(r.naam + ': geen e-mailadres'); continue; }
    if (al.has('e:' + email) || al.has('n:' + nn)) continue;
    al.add('e:' + email); al.add('n:' + nn);
    const b = brief[nn] || {}, isEN = String(b.taal || '').toUpperCase() === 'EN', t = String(b.type || r.type || '');
    const soort = /^aanzegging/.test(t) ? 'aanzegging' : /^proeftijd/.test(t) ? (/opzegging|resignation/i.test(b.onderwerp || '') ? 'proeftijd-wn' : 'proeftijd-wg') : 'ontslag';
    const link = X.exitLink(r.naam, isEN ? 'EN' : 'NL', soort);
    const subject = isEN ? 'Thank you for your time at SLA! How was it?' : 'Bedankt voor je tijd bij SLA! Hoe was het?';
    const text = T.exitUitnodigingPlain(r.naam, isEN).split('{{EXITLINK}}').join(link), html = T.exitUitnodigingHtml(r.naam, isEN).split('{{EXITLINK}}').join(link);
    const item = { naam: r.naam, email, einddatum: r.einddatum, taal: isEN ? 'EN' : 'NL', soort };
    rap.gevonden.push(item);
    if (rap.droog) { rap.verstuurd.push(Object.assign({ droog: true }, item)); continue; }
    try {
      const id = await M.verstuur({ to: email, subject, text, html, tags: [{ name: 'bron', value: 'exit' }, { name: 'type', value: 'automatisch' }] });
      await M.logMail({ door: 'signalering', bron: 'exit', type: 'uitnodiging-auto', naar: email, naam: r.naam, onderwerp: subject, taal: item.taal, rij: 0, resend_id: id });
      rap.verstuurd.push(Object.assign({ resendId: id }, item));
    } catch (e) { rap.fouten.push(r.naam + ': ' + e.message); }
  }
  return rap;
}

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

module.exports = { CHECKS, draai, actief, vindNieuweMedewerkers, vindAflopendeContracten, aanzegLijst, contractMail, bepaalStilleAfwezigen, syncFormulieren, loonHerinneringen, ontslagHerinneringen, nieuweMedewerkers, aanzegtermijnen, stilleAfwezigen, weekendBeschikbaarheid, kortingHerinneringen, vakantiepieken, bewaartermijnen, dataHygiene, bhrScan, hygieneOverzicht, contractketen, verzuim, jeugd, oproepaanbod, checkin, maandrapport, verlengingen, laadVerlengingen, exitSurvey, vertrekkers, vertrekt, loonDeadline, loonAutoAan, salaris, mto };
