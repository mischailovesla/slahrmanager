// ============================================================
// v0.27.2: dossiercontrole — klopt een lopend ontslag-/aanzeggingsdossier met Shiftbase, vóór het naar salaris gaat?
//   controleer(rijen, med, actief, vandaag)  puur: rijen = getOntslag(), med = verloop.laadMedewerkers (ook vertrokken),
//                                             actief = shiftbase.getMedewerkers (voor de BV). Geeft { [rij]: [signaal] }.
//   signaal = { soort, ernst: 'rood'|'oranje'|'blauw', tekst }
//   laad(rijen)                              haalt Shiftbase op (gecachet) en roept controleer aan
// ============================================================
const { normNaam } = require('./util');

const SOORTEN = {
  'datum': ['Datum onleesbaar', 'rood'],
  'volgorde': ['Einddatum vóór opzegdatum', 'rood'],
  'niet-gevonden': ['Niet gevonden in Shiftbase', 'oranje'],
  'uitdienst-anders': ['Uitdienstdatum Shiftbase wijkt af', 'oranje'],
  'uitdienst-leeg': ['Geen uitdienstdatum in Shiftbase', 'oranje'],
  'bv-anders': ['BV wijkt af van Shiftbase', 'oranje'],
  'email-anders': ['E-mail wijkt af van Shiftbase', 'blauw']
};
const UITDIENST_VOORUIT = 14; // geen uitdienstdatum in Shiftbase melden vanaf 14 dagen vóór de einddatum

function nlDatum(s) {
  const m = String(s || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/); if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
}
const isoNaarNl = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const isoVan = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const bvNorm = s => String(s || '').toLowerCase().replace(/\b(b\.?v\.?|bv)\b/g, '').replace(/[^a-z0-9]/g, '');

// Alleen lopende dossiers: verstuurd, niet verwerkt/gearchiveerd en nog niet naar salaris
function lopend(r) {
  return /^(Verzonden|Verstuurd)/.test(String(r.status || '')) && r.mahdia !== 'Ja' && !r.salaris && !r.gearchiveerd;
}

function controleer(rijen, med, actief, vandaag) {
  vandaag = vandaag || new Date(); vandaag = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
  const perId = {}, perEmail = {}, perNaam = {};
  for (const m of med || []) {
    if (!m || m.naam === '(geanonimiseerd)') continue;
    const em = String(m.email || '').trim().toLowerCase(), nn = normNaam(m.naam);
    // bij dubbele records (opnieuw in dienst) wint het laatst gestarte
    const zet = (o, k) => { if (k && (!o[k] || String(o[k].start || '') < String(m.start || ''))) o[k] = m; };
    zet(perId, String(m.id || '')); zet(perEmail, em); zet(perNaam, nn);
  }
  const actId = {}, actNaam = {}; for (const a of actief || []) { actId[String(a.id)] = a; actNaam[normNaam(a.naam)] = a; }
  const uit = {};
  for (const r of rijen || []) {
    if (!lopend(r)) continue;
    const s = [], p = (soort, tekst) => s.push({ soort, label: SOORTEN[soort][0], ernst: SOORTEN[soort][1], tekst });
    const isOntslag = r.type !== 'aanzegging';
    const eind = nlDatum(r.einddatum), opz = nlDatum(r.opzegging);
    if (!eind) p('datum', 'Einddatum "' + (r.einddatum || '') + '" is geen geldige datum (dd-mm-jjjj).');
    if (isOntslag && String(r.opzegging || '').trim() && !opz) p('datum', 'Opzegdatum "' + r.opzegging + '" is geen geldige datum (dd-mm-jjjj).');
    if (eind && opz && eind < opz) p('volgorde', 'Einddatum ' + r.einddatum + ' ligt vóór de opzegdatum ' + r.opzegging + '.');
    const em = String(r.email || '').trim().toLowerCase();
    const m = (r.mid && perId[String(r.mid)]) || (em && perEmail[em]) || perNaam[normNaam(r.naam)] || null;
    if (!m) p('niet-gevonden', 'Geen medewerker met deze naam of e-mail in Shiftbase: controleer de spelling of het e-mailadres.');
    else {
      if (eind) {
        const sbEind = String(m.eind || '');
        if (sbEind && sbEind !== isoVan(eind)) p('uitdienst-anders', 'Shiftbase: uit dienst ' + isoNaarNl(sbEind) + ', dossier: ' + r.einddatum + '. Welke klopt? Pas de andere aan (salaris rekent met de einddatum).');
        else if (!sbEind && (eind - vandaag) / 864e5 <= UITDIENST_VOORUIT) p('uitdienst-leeg', 'Einddatum ' + r.einddatum + (eind < vandaag ? ' is verstreken' : ' nadert') + ', maar in Shiftbase staat nog geen uitdienstdatum.');
      }
      const a = actId[String(m.id)] || actNaam[normNaam(m.naam)];
      if (a && a.winkelBv && r.bedrijf && bvNorm(a.winkelBv) !== bvNorm(r.bedrijf)) p('bv-anders', 'Dossier: ' + r.bedrijf + ', Shiftbase (' + (a.winkelNaam || 'winkel') + '): ' + a.winkelBv + '. Klopt de BV op de brief?');
      const sbEm = String(m.email || '').trim().toLowerCase();
      if (sbEm && em && sbEm !== em) p('email-anders', 'Dossier: ' + r.email + ', Shiftbase: ' + m.email + '.');
    }
    if (s.length) uit[r.rij] = s;
  }
  return uit;
}

async function laad(rijen) {
  const VR = require('./verloop'), SB = require('./shiftbase');
  const [med, actief] = await Promise.all([VR.laadMedewerkers(false), SB.getMedewerkers(false).catch(() => [])]);
  const vandaag = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return controleer(rijen, med, actief, vandaag);
}

module.exports = { controleer, laad, lopend, SOORTEN };
