// ============================================================
// SLA HR Dashboard — DOORVERWIJZING (stap 5, cutover)
// Vervangt Code.gs in het Apps Script-project ZODRA het Netlify-dashboard
// definitief is. Iedereen die de oude exec-URL opent, krijgt een nette
// doorverwijspagina naar https://slahrmanager.netlify.app.
//
// Werkwijze (na de cutover-checklist in CUTOVER.md):
//  1. Apps Script-editor → alle triggers verwijderen (Triggers-icoon links).
//  2. Alle .gs-bestanden behalve Code.gs verwijderen (of laten staan: ze
//     worden niet meer aangeroepen zolang doGet() hieronder de enige is).
//  3. Inhoud van Code.gs vervangen door dit bestand.
//  4. Implementaties beheren → Nieuwe versie → Implementeren.
//  Terugdraaien = vorige implementatieversie activeren.
// ============================================================
var NIEUWE_URL = 'https://slahrmanager.netlify.app';

function doGet() {
  var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="refresh" content="4;url=' + NIEUWE_URL + '">'
    + '<title>SLA HR Dashboard is verhuisd</title>'
    + '<style>body{font-family:"DM Sans",Arial,sans-serif;background:#f8f3f0;color:#333d3a;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}'
    + '.c{background:#fff;border-radius:16px;padding:40px 44px;max-width:520px;box-shadow:0 8px 32px rgba(51,61,58,.12);text-align:center}'
    + '.l{font-size:2.2rem;font-weight:700;color:#009f4b;letter-spacing:-1px}.s{font-size:.72rem;color:#888078;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:22px}'
    + 'h1{font-size:1.25rem;margin:0 0 10px}p{font-size:.95rem;line-height:1.6;color:#555;margin:0 0 22px}'
    + 'a.b{display:inline-block;background:#009f4b;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px}'
    + '.k{font-size:.78rem;color:#888078;margin-top:18px}</style></head><body><div class="c">'
    + '<div class="l">SLA</div><div class="s">HR Dashboard</div>'
    + '<h1>Het HR Dashboard is verhuisd</h1>'
    + '<p>Deze oude versie (Apps Script) is uitgezet. Alles — dossiers, brieven, signaleringen — staat nu op het nieuwe adres. Je wordt automatisch doorgestuurd.</p>'
    + '<a class="b" href="' + NIEUWE_URL + '">Ga naar het nieuwe dashboard &rarr;</a>'
    + '<div class="k">Zet <strong>slahrmanager.netlify.app</strong> in je bladwijzers. Inloggen met je @ilovesla.com-account.</div>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('SLA HR Dashboard is verhuisd').addMetaTag('viewport', 'width=device-width,initial-scale=1');
}
