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

  // Signaleringen (uit Shiftbase.gs v9.4) — stap 4
  SIGNALERING_ONTVANGERS: {
    nieuweMedewerkers: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    aanzegtermijn: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    stilleAfwezigen: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com'
  },
  SB_NIEUW_DAGEN: 14,              // "nieuw" = gestart binnen 14 dagen of start in de toekomst
  SIGNALERING_NEGEREN_NAMEN: [     // Shiftbase-spelling; al afgehandeld onder andere naam
    'Hannah Frederique Maria Vos'
  ],
  STIL_VENSTER_DAGEN: 28,          // "stil" = geen dienst in de laatste 4 weken
  STIL_LOOKBACK_DAGEN: 84,         // hoever terugkijken voor "laatste dienst"
  STIL_TOEKOMST_DAGEN: 14,         // wie binnenkort is ingeroosterd, is niet stil
  STIL_UITGESLOTEN_WINKELS: ['HQ'],

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
    CB: { naam: 'Ceintuurbaan',     adres: 'Ceintuurbaan 149, 1072 GB Amsterdam', bv: 'SLA Ceintuur BV' },
    WS: { naam: 'Westerstraat',     adres: 'Westerstraat 34, 1015 MK Amsterdam', bv: 'SLA Ceintuur BV' },
    MW: { naam: 'Middenweg',        adres: 'Middenweg 55b, 1098 AD Amsterdam', bv: 'SLA Midden BV' },
    HD: { naam: 'Haarlemmerdijk',   adres: 'Haarlemmerdijk 50-h, 1013 JE Amsterdam', bv: 'SLA Midden BV' },
    ZA: { naam: 'Zuidas',           adres: 'Claude Debussylaan 35, 1082 MC Amsterdam', bv: 'SLA Zuidas BV' },
    US: { naam: 'Utrechtsestraat',  adres: 'Utrechtsestraat 10hs, 1017 VN Amsterdam', bv: 'SLA Utrechtse BV' },
    AW: { naam: 'Amstelveenseweg',  adres: 'Amstelveenseweg 124, 1075 XL Amsterdam', bv: 'SLA ASW BV' },
    AD: { naam: 'Admiraal',         adres: 'Admiraal de Ruijterweg 63, 1057 JX Amsterdam', bv: 'SLA Admiraal B.V.' },
    HH: { naam: 'Hofhouse',         adres: 'Veemarkt 55, 1019 DA Amsterdam', bv: 'SLA Hofhouse BV' },
    VS: { naam: 'Voorstraat',       adres: 'Voorstraat 52, 3512 AR Utrecht', bv: 'SLA Utrecht BV' },
    HC: { naam: 'Hoog Catharijne',  adres: 'Catharijne Esplanade 45, 3511 WK Utrecht', bv: 'SLA H.C. BV' },
    KP: { naam: 'Kerkplein',        adres: 'Kerkplein 4a, 2513 AZ Den Haag', bv: 'SLA Den Haag BV' },
    OB: { naam: 'Oude Binnenweg',   adres: 'Oude Binnenweg 150A, 3012 JH Rotterdam', bv: 'SLA Rotterdam BV' }
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
