// ============================================================
// Vaste configuratie - 1-op-1 overgenomen uit Code.gs v29.7
// (sheet-ID's, kolomposities, winkel->BV mapping)
// ============================================================
module.exports = {
  SHEETS: {
    loonheffing: { id: '1vXelppN0QMsd_sPuzr7Efu3CnBchxEgujTmBMbGJ-Z4', responsesGid: 217214943 },
    ontslag:     { id: '150zw8o-3MpjxXX4960qAWV2PsLxv0OTL8mq8FpiYUiQ', responsesGid: 1318137515 },
    onboarding:  { id: '1MPOTbng9LbrVlA7eGNilsu8Zhgqh0JHK3HZ7H6sPMLw' },
    sommatie:    { id: '1WRu28kAZXnLmjxdXwf53p3CIa_dQNH4Tha08cFz7x_E' },
    // Overplaatsing is een tab in de ontslag/HR-acties-sheet
    overplaatsing: { id: '150zw8o-3MpjxXX4960qAWV2PsLxv0OTL8mq8FpiYUiQ', tab: 'Overplaatsing' },
    // Vrije brieven: tab 'Brieven' in dezelfde HR-acties-sheet (VrijeBrief.gs: BRIEF_SHEET_ID)
    brieven: { id: '150zw8o-3MpjxXX4960qAWV2PsLxv0OTL8mq8FpiYUiQ', tab: 'Brieven' }
  },

  // Extra log-tabs voor het dossier. Deze zitten in modules (Waarschuwing.gs,
  // Proeftijd.gs, VrijeBrief.gs, Korting.gs, Beschikbaarheid.gs) waarvan de
  // sheet-structuur hier nog niet bekend is. Vul aan: {label, id, tab, naamKol, emailKol, datumKol}
  // naamKol/emailKol/datumKol = 0-based kolomindex.
  DOSSIER_EXTRA_TABS: [
    // { label:'Waarschuwingen', id:'...', tab:'Waarschuwingen', naamKol:0, emailKol:1, datumKol:5 },
  ],

  AANZEG_VENSTER_DAGEN: 42,
  COOLDOWN_DAGEN: 3,

  // Mail / huisstijl (uit Code.gs)
  AFZENDER_TEAM: 'SLA HR Team',
  AFZENDER_NAAM: 'Jop van de Graaf',
  HR_EMAIL: 'hr@ilovesla.com',
  BEDRIJFSNAAM: 'SLA',

  // Loonheffing-flow: links en prefill (v29.4)
  UPLOAD_LOON: 'https://docs.google.com/forms/d/e/1FAIpQLSccn1Y4826aho-hIBSrbpw07BbCPAYmSVx2Fjlms08H8XNHgA/viewform?usp=header',
  PREFILL_LOON_ENTRY: 'entry.35290118',
  // Ontslag/aanzegging-flow (uit Code.gs): upload-formulier. De brieven zelf staan in _lib/brieftemplates.js
  UPLOAD_ONTSLAG: 'https://docs.google.com/forms/d/e/1FAIpQLSfI7REFmrvQFDBtfnGTbot_ra2RV6-w_g137FcnD7Dnaakgaw/viewform?usp=sf_link',
  PREFILL_ONTSLAG_ENTRY: 'entry.967349986',
  INDIENSTLINK: 'https://docs.google.com/spreadsheets/d/14gGKuBmJusIPOMq-WjOEdtPyBZ1amP5-/export?format=xlsx',
  LB_FORMULIER_NL: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/programmas_en_formulieren/model_opgaaf_gegevens_voor_de_loonheffingen',
  LB_FORMULIER_EN: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/themaoverstijgend/applications_and_forms/model-statement-data-payroll-taxes',

  WINKEL_BV_MAP: {
    CB: { naam: 'Ceintuurbaan',     bv: 'SLA Ceintuur BV' },
    WS: { naam: 'Westerstraat',     bv: 'SLA Ceintuur BV' },
    MW: { naam: 'Middenweg',        bv: 'SLA Midden BV' },
    HD: { naam: 'Haarlemmerdijk',   bv: 'SLA Midden BV' },
    ZA: { naam: 'Zuidas',           bv: 'SLA Zuidas BV' },
    US: { naam: 'Utrechtsestraat',  bv: 'SLA Utrechtse BV' },
    AW: { naam: 'Amstelveenseweg',  bv: 'SLA ASW BV' },
    AD: { naam: 'Admiraal',         bv: 'SLA Admiraal B.V.' },
    HH: { naam: 'Hofhouse',         bv: 'SLA Hofhouse BV' },
    VS: { naam: 'Voorstraat',       bv: 'SLA Utrecht BV' },
    HC: { naam: 'Hoog Catharijne',  bv: 'SLA H.C. BV' },
    KP: { naam: 'Kerkplein',        bv: 'SLA Den Haag BV' },
    OB: { naam: 'Oude Binnenweg',   bv: 'SLA Rotterdam BV' }
  },

  // Shiftbase department_id -> winkelcode (uit Shiftbase.gs v9.4)
  SB_DEPT_CODE: {
    '153188': 'CB', '153128': 'WS', '153130': 'MW', '153129': 'HD',
    '153189': 'ZA', '153127': 'US', '153126': 'AW', '153192': 'AD',
    '152898': 'VS', '153140': 'HC', '153141': 'KP'
  },
  SB_FRANCHISE_DEPTS: { '153143': true, '153187': true }, // Haarlem, Groningen
  SB_UITGESLOTEN_NAMEN: ['Afwasser T', 'Af Wasser', 'Test Test'],
  VAKANTIE_OPTION_ID: '1019457'
};
