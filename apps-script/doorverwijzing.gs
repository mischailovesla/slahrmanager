// ============================================================
// SLA HR Dashboard — DOORVERWIJZING (stap 5, cutover)
// Vervangt Code.gs in het Apps Script-project ZODRA het Netlify-dashboard
// definitief is. Iedereen die de oude exec-URL opent, krijgt een nette
// doorverwijspagina naar https://slahrmanager.netlify.app.
//
// Werkwijze (na de cutover-checklist in CUTOVER.md):
//  1. Apps Script-editor → alle triggers verwijderen (Triggers-icoon links).
//  2. Alle .gs-bestanden behalve Code.gs verwijderen. Let op: laten staan
//     werkt NIET zomaar — Apps Script evalueert bij elke aanroep de bovenste
//     laag van álle bestanden, en Shiftbase.gs roept daar normNaam() aan
//     (zat in de oude Code.gs). Daarom staat onderaan een stub; verwijderen
//     van de oude bestanden blijft de nette oplossing.
//  3. Inhoud van Code.gs vervangen door dit bestand.
//  4. Implementaties beheren → Nieuwe versie → Implementeren.
//  Terugdraaien = vorige implementatieversie activeren.
// ============================================================
var NIEUWE_URL = 'https://slahrmanager.netlify.app';

function doGet() {
  var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>SLA HR Dashboard is verhuisd</title>'
    + '<style>body{font-family:"DM Sans",Arial,sans-serif;background:#f8f3f0;color:#333d3a;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}'
    + '.c{background:#fff;border-radius:16px;padding:40px 44px;max-width:520px;box-shadow:0 8px 32px rgba(51,61,58,.12);text-align:center}'
    + '.l{font-size:2.2rem;font-weight:700;color:#009f4b;letter-spacing:-1px}.s{font-size:.72rem;color:#888078;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:22px}'
    + 'h1{font-size:1.25rem;margin:0 0 10px}p{font-size:.95rem;line-height:1.6;color:#555;margin:0 0 22px}'
    + 'a.b{display:inline-block;background:#009f4b;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px}'
    + '.k{font-size:.78rem;color:#888078;margin-top:18px}</style></head><body><div class="c">'
    + '<div class="l">SLA</div><div class="s">HR Dashboard</div>'
    + '<h1>Het HR Dashboard is verhuisd</h1>'
    + '<p>Deze oude versie (Apps Script) is uitgezet. Alles — dossiers, brieven, signaleringen — staat nu op het nieuwe adres. Je wordt over een paar seconden doorgestuurd; gebeurt dat niet, klik dan op de knop.</p>'
    + '<a class="b" href="' + NIEUWE_URL + '" target="_top">Ga naar het nieuwe dashboard &rarr;</a>'
    + '<div class="k">Zet <strong>slahrmanager.netlify.app</strong> in je bladwijzers. Inloggen met je @ilovesla.com-account.</div>'
    + '</div>'
    // Apps Script toont de webapp in een iframe; het nieuwe dashboard weigert
    // frames (X-Frame-Options: DENY). Daarom NIET via meta-refresh maar naar
    // het bovenste venster (_top) doorsturen. Lukt dat niet, dan blijft de knop.
    + '<script>setTimeout(function(){try{window.open(' + JSON.stringify(NIEUWE_URL) + ',"_top");}catch(e){}},2500);</script>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('SLA HR Dashboard is verhuisd').setSandboxMode(HtmlService.SandboxMode.IFRAME).addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

// Stap B1 van CUTOVER.md: alle triggers van dit account in één keer verwijderen.
// Draaien in de editor (functie kiezen → Uitvoeren). Verwacht in het log: "11 trigger(s) verwijderd. Nu nog: 0".
// Triggers die een ANDER account heeft aangemaakt (bijv. hr@) zie je niet: draai de functie dan ook als dat account.
function verwijderAlleTriggers() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) ScriptApp.deleteTrigger(ts[i]);
  Logger.log(ts.length + ' trigger(s) verwijderd. Nu nog: ' + ScriptApp.getProjectTriggers().length);
}

// Stub voor de oude .gs-bestanden die bij het laden nog normNaam() uit de
// oude Code.gs verwachten (o.a. Shiftbase.gs regel 71–76). Overbodig zodra
// die bestanden verwijderd zijn; kan dan weg.
function normNaam(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
