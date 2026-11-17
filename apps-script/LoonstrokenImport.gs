/**
 * SLA HR — Loonstroken automatisch uit de mail naar het HR Dashboard (v0.52.1, 17-11-2026: doorgestuurde kopieën niet dubbel)
 *
 * Wat doet het?
 *   HRM Online (Mahdia) mailt per BV de loonproductie: "SLA Midden B.V., Periodeverslagen Maandelijks 2026-10/1"
 *   met o.a. de bijlage Loonstroken_Maandelijks_2026_10_1.pdf. Dit script zoekt die mails in hr@ilovesla.com,
 *   stuurt ALLEEN de bijlage Loonstroken_*.pdf naar het HR Dashboard (/api/loonstroken-import) en zet het label
 *   "Auto/Salaris/Loonstroken in HR" op de mail. Het dashboard knipt en koppelt de stroken (zoals bij slepen).
 *   Betaallijst en journaalposten gaan niet mee. Het script verwijdert of archiveert niets.
 *
 * Installeren (eenmalig, ±10 min) — als hr@ilovesla.com:
 *   1. script.google.com → Nieuw project "SLA Loonstroken import" → plak dit bestand. (EIGEN project, niet in de
 *      HR-mail opruimer: diens installeerTriggers() verwijdert alle triggers van zijn project.)
 *   2. Netlify → Site configuration → Environment variables: LOONSTROKEN_IMPORT_SECRET = een lange willekeurige
 *      sleutel (min. 32 tekens; maak er een met maakSleutel() hieronder) → Deploy → Trigger deploy.
 *   3. Projectinstellingen (tandwiel) → Script Properties: IMPORT_SLEUTEL = dezelfde sleutel.
 *   4. Draai proefrun(): laat in het logboek zien welke mails/bijlagen hij zou sturen, zonder iets te versturen.
 *   5. Draai importeerAlles(): haalt eenmalig alle loonstroken van de afgelopen 13 maanden op (voor DUO-verzoeken).
 *   6. Draai installeerTrigger(): daarna elk uur automatisch.
 */

var CONFIG = {
  URL: 'https://slahrmanager.netlify.app/api/loonstroken-import',
  ZOEK: 'from:hrmonline.nl subject:(Periodeverslagen OR Loonstroken) has:attachment filename:pdf',
  LABEL_OK: 'Auto/Salaris/Loonstroken in HR',
  LABEL_FOUT: 'Auto/Salaris/Loonstroken import mislukt',
  BIJLAGE: /^Loonstroken[\w .\-]*\.pdf$/i,
  MAX_POGINGEN: 3,                  // daarna label "mislukt" + melding
  MELDING_AAN: 'hr@ilovesla.com',   // mail als stroken niet gekoppeld konden worden of de import mislukt ('' = geen mail)
  DASHBOARD: 'https://slahrmanager.netlify.app'
};

function importeer() { return verwerk_('newer_than:30d', false); }          // elk uur via de trigger
function importeerAlles() { return verwerk_('newer_than:400d', false); }    // eenmalig: inhalen
function proefrun() { return verwerk_('newer_than:400d', true); }           // niets versturen, alleen loggen

function verwerk_(bereik, proef) {
  var sleutel = PropertiesService.getScriptProperties().getProperty('IMPORT_SLEUTEL');
  if (!proef && (!sleutel || sleutel.length < 32)) throw new Error('Script Property IMPORT_SLEUTEL ontbreekt (zie stap 3 bovenaan).');
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) { Logger.log('Draait al.'); return; }
  try {
    var q = CONFIG.ZOEK + ' ' + bereik + ' -label:"' + CONFIG.LABEL_OK + '" -label:"' + CONFIG.LABEL_FOUT + '"';
    var threads = GmailApp.search(q, 0, 100), start = Date.now(), samenvatting = [], fouten = [], gezien = {};
    Logger.log(threads.length + ' mail(s) gevonden: ' + q);
    for (var i = 0; i < threads.length; i++) {
      if ((Date.now() - start) / 1000 > 300) { Logger.log('Tijd op, de rest volgt bij de volgende run.'); break; }
      var t = threads[i], alleGoed = true, gestuurd = 0;
      t.getMessages().forEach(function (m) {
        m.getAttachments({ includeInlineImages: false }).forEach(function (a) {
          if (!CONFIG.BIJLAGE.test(a.getName())) return;
          // doorgestuurde kopie (Fwd/FW) in dezelfde run: zelfde bestand niet nog een keer sturen
          var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, a.getBytes()));
          if (gezien[hash]) { Logger.log('DUBBEL (overgeslagen)  ' + m.getSubject() + '  →  ' + a.getName()); gestuurd++; return; }
          gezien[hash] = true;
          if (proef) { Logger.log('PROEF  ' + m.getDate().toISOString().slice(0, 10) + '  ' + m.getSubject() + '  →  ' + a.getName() + ' (' + Math.round(a.getSize() / 1024) + ' kB)'); gestuurd++; return; }
          var r = stuur_(a, m, sleutel);
          if (r.ok) {
            gestuurd++;
            samenvatting.push(r.data);
            Logger.log('OK  ' + m.getSubject() + ': ' + r.data.aantal + ' stroken (' + r.data.nieuw + ' nieuw), niet/onzeker gekoppeld: ' + (r.data.nietGekoppeld || []).length);
          } else {
            alleGoed = false;
            var n = poging_(m.getId());
            Logger.log('FOUT (poging ' + n + ')  ' + m.getSubject() + ': ' + r.fout);
            if (n >= CONFIG.MAX_POGINGEN) { fouten.push(m.getSubject() + ': ' + r.fout); label_(CONFIG.LABEL_FOUT).addToThread(t); }
          }
        });
      });
      if (!proef && alleGoed && gestuurd) label_(CONFIG.LABEL_OK).addToThread(t);
      if (!proef && alleGoed && !gestuurd) Logger.log('Geen Loonstroken-bijlage in: ' + t.getFirstMessageSubject());
    }
    if (!proef) meld_(samenvatting, fouten);
  } finally { lock.releaseLock(); }
}

function stuur_(bijlage, bericht, sleutel) {
  try {
    var res = UrlFetchApp.fetch(CONFIG.URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-import-sleutel': sleutel },
      payload: JSON.stringify({ naam: bijlage.getName(), bestand: Utilities.base64Encode(bijlage.getBytes()), onderwerp: bericht.getSubject(), van: bericht.getFrom(), datum: bericht.getDate().toISOString(), messageId: bericht.getId() })
    });
    var data = {}; try { data = JSON.parse(res.getContentText()); } catch (e) { data = { bericht: res.getContentText().slice(0, 300) }; }
    if (res.getResponseCode() === 200 && data.success) return { ok: true, data: data };
    return { ok: false, fout: 'HTTP ' + res.getResponseCode() + ' ' + (data.bericht || '') };
  } catch (e) { return { ok: false, fout: e.message }; }
}

// Korte mail aan HR: alleen als er iets te doen is (niet/onzeker gekoppeld, of mislukt)
function meld_(samenvatting, fouten) {
  if (!CONFIG.MELDING_AAN) return;
  var open = [];
  samenvatting.forEach(function (d) { (d.nietGekoppeld || []).forEach(function (x) { open.push((d.bvs || []).join(', ') + ' ' + (d.periodes || []).join(', ') + ': ' + x.naam_strook + (x.voorstel ? ' → voorstel ' + x.voorstel : ' → niet gevonden')); }); });
  if (!open.length && !fouten.length) return;
  var tekst = 'Hoi,\n\nDe loonstroken uit de mail van de salarisadministratie staan in het HR Dashboard (In dienst → Loonstroken).\n\n'
    + (open.length ? 'Deze ' + open.length + ' strook/stroken moet je nog even koppelen of bevestigen:\n- ' + open.join('\n- ') + '\n\n' : '')
    + (fouten.length ? 'Deze import(s) zijn ' + CONFIG.MAX_POGINGEN + ' keer mislukt (label "' + CONFIG.LABEL_FOUT + '"); sleep de PDF dan zelf in het dashboard:\n- ' + fouten.join('\n- ') + '\n\n' : '')
    + CONFIG.DASHBOARD + '\n\nGroet,\nHR Dashboard (automatisch bericht)';
  GmailApp.sendEmail(CONFIG.MELDING_AAN, 'Loonstroken: ' + (open.length ? open.length + ' te koppelen' : '') + (open.length && fouten.length ? ', ' : '') + (fouten.length ? fouten.length + ' import mislukt' : ''), tekst);
}

function poging_(id) {
  var p = PropertiesService.getScriptProperties(), k = 'poging_' + id, n = Number(p.getProperty(k) || 0) + 1;
  p.setProperty(k, String(n)); return n;
}
function label_(naam) { return GmailApp.getUserLabelByName(naam) || GmailApp.createLabel(naam); }

function installeerTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importeer') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importeer').timeBased().everyHours(1).create();
  Logger.log('Trigger staat: importeer() elk uur.');
}
// Hulp: een sterke sleutel om in Netlify én in de Script Properties te zetten
function maakSleutel() { var s = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random())).replace(/=+$/, ''); Logger.log(s); return s; }
