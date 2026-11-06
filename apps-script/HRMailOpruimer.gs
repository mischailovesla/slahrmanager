/**
 * ============================================================
 * HR Mail Opruimer v1.2 (06-11-2026) — voor de mailbox hr@ilovesla.com
 * ============================================================
 * Draait in Google Apps Script ONDER HET ACCOUNT hr@ilovesla.com
 * (script.google.com → Nieuw project, ingelogd als hr@).
 *
 * Wat doet het?
 *  1. Sorteren: elke nieuwe mail krijgt een label onder "Auto/…" (op afzender + onderwerp).
 *  2. Ruis opruimen: periodeverslagen, loonstroken, systeemmeldingen, afwezigheidsberichten
 *     en sollicitatie-notificaties worden (na een paar dagen) gelezen + gearchiveerd.
 *     Gearchiveerd = uit de inbox, NIET weg. Alles blijft vindbaar onder het label.
 *  3. Actielaag: "Actie nodig" (laatste bericht is van iemand anders, nog niet beantwoord)
 *     en "Wacht op antwoord" (laatste bericht is van HR, al 3+ dagen geen reactie).
 *  4. Achterstand: gelezen mail ouder dan 60 dagen en ongelezen mail ouder dan 90 dagen
 *     (zonder actie-label) gaat uit de inbox. Ongelezen blijft ongelezen, onder Auto/Opgeruimd (oud, ongelezen).
 *
 * Veiligheid
 *  - Er wordt NOOIT iets verwijderd. Alleen labelen, als gelezen markeren en archiveren.
 *  - DRY_RUN = true (standaard): er verandert niets, je krijgt alleen een logboek
 *    (Google Sheet "HR-mail opruimen – logboek" in de Drive van hr@) met wat er zou gebeuren.
 *  - Mail met een ster, of met jullie eigen labels (1.0 Opvolgen … 7. 1 jarig jubileum,
 *    Loonopdracht, Loonaangifte, Mutaties uurloners, Ontslagformulier), wordt nooit gearchiveerd.
 *  - Mail van collega's/winkels (@ilovesla.com) wordt alleen gelabeld, nooit automatisch
 *    gelezen gemarkeerd of gearchiveerd — behalve de systeemadressen werkenbij@ en contracten@.
 *
 * Installeren
 *  1. Plak dit bestand in een nieuw Apps Script-project (als hr@).
 *  2. Run eenmalig  proefrun()  → geef toestemming → bekijk het logboek (link staat in de uitvoerlog).
 *  3. Klopt het? Zet DRY_RUN op false en run  opruimenAchterstand()  (eventueel een paar keer,
 *     hij stopt zelf na ~5 minuten en gaat de volgende keer verder).
 *  4. Run eenmalig  installeerTriggers()  → daarna elke 15 minuten sorteren, elke ochtend de actielaag.
 * ============================================================
 */

// ---------- Instellingen ----------
var DRY_RUN = true;                       // true = alleen logboek, niets veranderen
var HR_ADRES = 'hr@ilovesla.com';
var ROOT = 'Auto';
var ACTIE_NODIG = 'Actie nodig';
var WACHT_OP = 'Wacht op antwoord';
var WACHT_DAGEN = 3;                      // na hoeveel dagen zonder reactie → "Wacht op antwoord"
var ACHTERSTAND_DAGEN = 60;               // gelezen mail ouder dan dit → uit de inbox
var ONGELEZEN_DAGEN = 90;                  // v1.2: ook ONgelezen mail ouder dan dit → uit de inbox (blijft ongelezen, label Auto/Opgeruimd (oud, ongelezen)); 0 = uit
var MAX_SECONDEN = 270;                   // Apps Script stopt bij 6 min; wij stoppen eerder
var LOGBOEK_NAAM = 'HR-mail opruimen – logboek';

// Eigen labels van HR: die mails worden nooit gearchiveerd door dit script
var BESCHERMDE_LABELS = ['1.0 Opvolgen > Ymke', '1.1 Jodi Winkels', '1.1 Ymke Winkels', '1.2 NU', '2. LATER', '3. Doen deze maand', '4. Doen volgende maand', '5. Wachten op..', '6. Bewaren', '7. 1 jarig jubileum', 'Loonopdracht', 'Loonaangifte', 'Mutaties uurloners', 'Ontslagformulier', 'Handtekeningverzoeken verstuurd'];
// @ilovesla.com-adressen die systeemmail sturen (die mogen wel automatisch opgeruimd worden)
var SYSTEEM_INTERN = ['werkenbij@ilovesla.com', 'contracten@ilovesla.com', 'admin@ilovesla.com'];

// ---------- Regels ----------
// zoek   = Gmail-zoekopdracht (zoals in de zoekbalk)
// label  = label onder Auto/
// ruis   = true: lezen + archiveren na `naDagen` dagen (0 = meteen)
// actie  = true: telt mee voor "Actie nodig" als het onbeantwoord is
var REGELS = [
  { naam: 'Periodeverslagen HRM Online', zoek: 'from:hrmonline.nl subject:Periodeverslagen', label: 'Salaris/Periodeverslagen', ruis: true, naDagen: 2 },
  { naam: 'Afwezigheidsberichten', zoek: 'subject:("Automatisch antwoord" OR "Automatic reply" OR "Out of office" OR "Afwezigheidsbericht")', label: 'Ruis/Afwezig', ruis: true, naDagen: 0 },
  { naam: 'Onbestelbaar (bounces)', zoek: 'from:(mailer-daemon OR postmaster) OR subject:("Undeliverable" OR "niet bezorgd" OR "Delivery Status Notification")', label: 'Ruis/Bounces', ruis: false, actie: true },
  { naam: 'Loonstroken (kopie)', zoek: 'from:contracten@ilovesla.com subject:Loonstrook', label: 'Salaris/Loonstroken', ruis: true, naDagen: 0 },
  { naam: 'HRM Online overig', zoek: 'from:hrmonline.nl -subject:Periodeverslagen', label: 'Salaris/HRM Online', ruis: false, actie: true },
  { naam: 'Sollicitaties (werkenbij)', zoek: 'from:werkenbij@ilovesla.com subject:"Nieuwe sollicitatie"', label: 'Werving/Sollicitaties', ruis: true, naDagen: 7 },
  { naam: 'Reacties kandidaten (werkenbij)', zoek: 'from:werkenbij@ilovesla.com subject:"Nieuw antwoord van"', label: 'Werving/Reacties kandidaat', ruis: false, actie: true },
  { naam: 'Systeemmeldingen', zoek: 'from:(no-reply@accounts.google.com OR drive-shares-dm-noreply@google.com OR esignature-noreply@google.com OR uber.com OR exact.com OR exactonline.nl OR apprendo.nl OR notifications@sign.com OR noreply OR no-reply) -from:ilovesla.com', label: 'Systeem', ruis: true, naDagen: 3 },
  { naam: 'Ontslag / opzegging', zoek: 'subject:(ontslag OR resignation OR opzegging OR opzeggen OR termination OR "notice" OR "laatste werkdag" OR "uit dienst")', label: 'Uitstroom/Ontslag', ruis: false, actie: true },
  { naam: 'Nieuwe medewerker / contractaanvraag', zoek: 'subject:("new hire" OR "nieuwe medewerker" OR "nieuwe sla maker" OR "nieuwe slamaker" OR "new employee" OR "first contract" OR "eerste contract" OR "hiring request" OR "contract request" OR slamaker OR "sla-maker" OR "sla maker")', label: 'Instroom/Nieuwe medewerker', ruis: false, actie: true },
  { naam: 'Contract / verlenging', zoek: 'subject:(contract OR arbeidsovereenkomst OR verlenging OR verlengen OR renewal OR proposal OR voorstel) -from:hrmonline.nl', label: 'Instroom/Contract', ruis: false, actie: true },
  { naam: 'Loonheffing', zoek: 'subject:(loonheffing OR loonheffingsverklaring OR loonheffingskorting OR "payroll tax")', label: 'Instroom/Loonheffing', ruis: false, actie: true },
  { naam: 'Vragen over salaris / loonstrook', zoek: 'subject:(payslip OR payslips OR loonstrook OR salaris OR salary OR payment OR betaling OR uitbetaling OR jaaropgave) -subject:("eerste salaris" OR "first salary" OR Periodeverslagen) -from:hrmonline.nl -from:contracten@ilovesla.com', label: 'Salaris/Vragen medewerkers', ruis: false, actie: true },
  { naam: 'Verlof / vakantie', zoek: 'subject:(vakantie OR vacation OR verlof OR leave OR "day off")', label: 'In dienst/Verlof', ruis: false, actie: true },
  { naam: 'Ziek / beter', zoek: 'subject:(ziek OR ziekmelding OR betermelding OR sick OR verzuim)', label: 'In dienst/Ziek', ruis: false, actie: true },
  { naam: 'UWV / Belastingdienst', zoek: 'from:(uwv.nl OR belastingdienst.nl) OR subject:(uwv OR werkgeversportaal OR belastingdienst)', label: 'Overheid', ruis: false, actie: true }
];

// ============================================================
// Publieke functies (deze run je zelf of via triggers)
// ============================================================

/** Eerste kennismaking: niets veranderen, alleen loggen wat er zou gebeuren (hele inbox). */
function proefrun() {
  var oud = DRY_RUN; DRY_RUN = true;
  try { opruimenAchterstand(); } finally { DRY_RUN = oud; }
}

/** Elke 15 minuten (trigger): nieuwe mail sorteren en ruis opruimen. */
function verwerkNieuw() {
  var start = Date.now(), log = [];
  REGELS.forEach(function (r) { if (!tijdOp(start)) sorteer(r, 'newer_than:2d', log); });
  REGELS.forEach(function (r) { if (r.ruis && !tijdOp(start)) ruimOp(r, log); });
  schrijfLog(log);
}

/** Eenmalig (en zo vaak als nodig): de hele inbox sorteren, ruis opruimen, oude gelezen mail archiveren. */
function opruimenAchterstand() {
  var start = Date.now(), log = [];
  REGELS.forEach(function (r) { if (!tijdOp(start)) sorteer(r, 'in:inbox', log); });
  REGELS.forEach(function (r) { if (r.ruis && !tijdOp(start)) ruimOp(r, log); });
  if (!tijdOp(start)) archiveerOud(log, start);
  if (!tijdOp(start)) actieLaag(log, start);
  if (tijdOp(start)) log.push(regel('—', 'gestopt (tijd op)', 0, 'Run opnieuw om verder te gaan.'));
  schrijfLog(log);
}

/** Elke ochtend (trigger): "Actie nodig" en "Wacht op antwoord" bijwerken. */
function dagelijks() {
  var start = Date.now(), log = [];
  actieLaag(log, start);
  schrijfLog(log);
}

/** Eenmalig: triggers aanmaken (oude triggers van dit script worden eerst verwijderd). */
function installeerTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('verwerkNieuw').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('dagelijks').timeBased().atHour(7).everyDays(1).inTimezone('Europe/Amsterdam').create();
  Logger.log('Triggers aangemaakt: verwerkNieuw (elke 15 min) en dagelijks (07:00).');
}

/** Overzicht: hoeveel mail staat er per regel nog in de inbox (verandert niets). */
function telInbox() {
  REGELS.forEach(function (r) { Logger.log(r.naam + ': ' + GmailApp.search('in:inbox (' + r.zoek + ')', 0, 500).length + (GmailApp.search('in:inbox (' + r.zoek + ')', 0, 500).length === 500 ? '+' : '')); });
}

// ============================================================
// Intern
// ============================================================
function sorteer(r, bereik, log) {
  var lbl = label(ROOT + '/' + r.label), q = bereik + ' (' + r.zoek + ') -label:' + qLabel(ROOT + '/' + r.label);
  var totaal = 0, vb = '';
  while (true) {
    var threads = GmailApp.search(q, 0, 100);
    if (!threads.length) break;
    vb = vb || threads[0].getFirstMessageSubject();
    totaal += threads.length;
    if (DRY_RUN) break;              // in de proefrun alleen de eerste 100 tellen
    lbl.addToThreads(threads);
    if (threads.length < 100) break;
  }
  if (totaal) log.push(regel(r.naam, 'label ' + ROOT + '/' + r.label, totaal + (DRY_RUN && totaal === 100 ? '+' : ''), vb));
}

function ruimOp(r, log) {
  var q = 'in:inbox label:' + qLabel(ROOT + '/' + r.label) + (r.naDagen ? ' older_than:' + r.naDagen + 'd' : '') + beschermdQuery();
  if (DRY_RUN) q = 'in:inbox (' + r.zoek + ')' + (r.naDagen ? ' older_than:' + r.naDagen + 'd' : '') + beschermdQuery();
  var threads = GmailApp.search(q, 0, 500).filter(function (t) { return !heeftCollega(t); });
  if (!threads.length) return;
  if (!DRY_RUN) for (var i = 0; i < threads.length; i += 100) { var deel = threads.slice(i, i + 100); GmailApp.markThreadsRead(deel); GmailApp.moveThreadsToArchive(deel); }
  log.push(regel(r.naam, 'gelezen + gearchiveerd' + (r.naDagen ? ' (ouder dan ' + r.naDagen + ' dagen)' : ''), threads.length + (threads.length === 500 ? '+' : ''), threads[0].getFirstMessageSubject()));
}

function archiveerOud(log, start) {
  var q = 'in:inbox -is:unread -is:starred older_than:' + ACHTERSTAND_DAGEN + 'd -label:' + qLabel(ACTIE_NODIG) + beschermdQuery();
  var lbl = label(ROOT + '/Opgeruimd (oud)'), totaal = 0, vb = '';
  while (!tijdOp(start)) {
    var threads = GmailApp.search(q, 0, 100);
    if (!threads.length) break;
    vb = vb || threads[0].getFirstMessageSubject();
    totaal += threads.length;
    if (DRY_RUN) { totaal = GmailApp.search(q, 0, 500).length; break; }
    lbl.addToThreads(threads); GmailApp.moveThreadsToArchive(threads);
  }
  if (totaal) log.push(regel('Achterstand', 'gelezen mail ouder dan ' + ACHTERSTAND_DAGEN + ' dagen uit de inbox', totaal + (DRY_RUN && totaal === 500 ? '+' : ''), vb));
  // v1.2: ongelezen mail die al maanden ligt, wordt in de praktijk niet meer opgepakt → uit de inbox, maar blijft ongelezen
  if (!ONGELEZEN_DAGEN) return;
  var q2 = 'in:inbox is:unread -is:starred older_than:' + ONGELEZEN_DAGEN + 'd -label:' + qLabel(ACTIE_NODIG) + beschermdQuery();
  var lbl2 = label(ROOT + '/Opgeruimd (oud, ongelezen)'), n2 = 0, vb2 = '';
  while (!tijdOp(start)) {
    var t2 = GmailApp.search(q2, 0, 100);
    if (!t2.length) break;
    vb2 = vb2 || t2[0].getFirstMessageSubject();
    if (DRY_RUN) { n2 = GmailApp.search(q2, 0, 500).length; break; }
    n2 += t2.length; lbl2.addToThreads(t2); GmailApp.moveThreadsToArchive(t2);
  }
  if (n2) log.push(regel('Achterstand ongelezen', 'ongelezen mail ouder dan ' + ONGELEZEN_DAGEN + ' dagen uit de inbox (blijft ongelezen)', n2 + (DRY_RUN && n2 === 500 ? '+' : ''), vb2));
}

// "Actie nodig" = in de inbox, valt onder een actie-regel, laatste bericht NIET van HR.
// "Wacht op antwoord" = laatste bericht van HR, ouder dan WACHT_DAGEN, nog geen reactie.
function actieLaag(log, start) {
  var actie = label(ACTIE_NODIG), wacht = label(WACHT_OP), nA = 0, nW = 0, nWeg = 0;
  var actieLabels = REGELS.filter(function (r) { return r.actie; }).map(function (r) { return 'label:' + qLabel(ROOT + '/' + r.label); });
  var threads = GmailApp.search('in:inbox newer_than:45d (' + actieLabels.join(' OR ') + ')', 0, 300);
  threads.forEach(function (t) {
    if (tijdOp(start)) return;
    var msgs = t.getMessages(), laatste = msgs[msgs.length - 1], vanHR = laatste.getFrom().toLowerCase().indexOf(HR_ADRES) > -1;
    var dagen = (Date.now() - laatste.getDate().getTime()) / 864e5, lbls = t.getLabels().map(function (l) { return l.getName(); });
    if (!vanHR) { if (lbls.indexOf(ACTIE_NODIG) < 0) { nA++; if (!DRY_RUN) t.addLabel(actie); } if (lbls.indexOf(WACHT_OP) > -1 && !DRY_RUN) t.removeLabel(wacht); }
    else {
      if (lbls.indexOf(ACTIE_NODIG) > -1) { nWeg++; if (!DRY_RUN) t.removeLabel(actie); }
      if (dagen >= WACHT_DAGEN && lbls.indexOf(WACHT_OP) < 0) { nW++; if (!DRY_RUN) t.addLabel(wacht); }
    }
  });
  // beantwoord buiten de actie-regels om: label weghalen
  GmailApp.search('label:' + qLabel(ACTIE_NODIG), 0, 200).forEach(function (t) {
    var m = t.getMessages(); if (m[m.length - 1].getFrom().toLowerCase().indexOf(HR_ADRES) > -1) { nWeg++; if (!DRY_RUN) t.removeLabel(actie); }
  });
  log.push(regel('Actielaag', 'Actie nodig +' + nA + ' / −' + nWeg + ' · Wacht op antwoord +' + nW, nA + nW + nWeg, ''));
}

// ---------- hulpjes ----------
function label(naam) { return GmailApp.getUserLabelByName(naam) || GmailApp.createLabel(naam); }
function qLabel(naam) { return '"' + naam.replace(/"/g, '') + '"'; }
function beschermdQuery() { return ' -is:starred ' + BESCHERMDE_LABELS.map(function (l) { return '-label:' + qLabel(l); }).join(' '); }
function tijdOp(start) { return (Date.now() - start) / 1000 > MAX_SECONDEN; }
function heeftCollega(t) { // mail van een collega/winkel nooit automatisch opruimen
  return t.getMessages().some(function (m) {
    var van = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].toLowerCase().trim();
    return /@ilovesla\.com$/.test(van) && van !== HR_ADRES && SYSTEEM_INTERN.indexOf(van) < 0;
  });
}
function regel(naam, actie, aantal, voorbeeld) { return [new Date(), DRY_RUN ? 'PROEF' : 'ECHT', naam, actie, aantal, voorbeeld || '']; }
function schrijfLog(rijen) {
  if (!rijen.length) return;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('LOGBOEK_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(LOGBOEK_NAAM); props.setProperty('LOGBOEK_ID', ss.getId()); ss.getSheets()[0].appendRow(['Tijd', 'Modus', 'Regel', 'Actie', 'Aantal threads', 'Voorbeeld onderwerp']); ss.getSheets()[0].setFrozenRows(1); }
  var sh = ss.getSheets()[0];
  sh.getRange(sh.getLastRow() + 1, 1, rijen.length, rijen[0].length).setValues(rijen);
  Logger.log('Logboek: ' + ss.getUrl());
  rijen.forEach(function (r) { Logger.log(r.slice(1).join(' | ')); });
}
