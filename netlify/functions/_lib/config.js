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
    stilleAfwezigen: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    weekendBeschikbaarheid: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    vakantiepiek: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    dataHygiene: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    bewaartermijn: 'mischa@ilovesla.com'
  },
  SB_NIEUW_DAGEN: 14,              // "nieuw" = gestart binnen 14 dagen of start in de toekomst
  SIGNALERING_NEGEREN_NAMEN: [     // Shiftbase-spelling; al afgehandeld onder andere naam
    'Hannah Frederique Maria Vos'
  ],
  STIL_VENSTER_DAGEN: 28,          // "stil" = geen dienst in de laatste 4 weken
  STIL_LOOKBACK_DAGEN: 84,         // hoever terugkijken voor "laatste dienst"
  STIL_TOEKOMST_DAGEN: 14,         // wie binnenkort is ingeroosterd, is niet stil
  STIL_UITGESLOTEN_WINKELS: ['HQ'],
  WEEKEND_SIGNAAL_WEKEN: 3,        // weekendontwijker = 3 opeenvolgende weekenden zonder dienst (wel doordeweeks)
  WEEKEND_UITGESLOTEN_WINKELS: ['HQ'],
  BSK_ONDERBOUWING_WEKEN: 8,       // data-onderbouwing in de beschikbaarheidsbrief: laatste 8 weken

  // Log-tabs batch A (HR-acties-sheet)
  TAB_WAARSCHUWINGEN: 'Waarschuwingen',
  TAB_BESCHIKBAARHEID: 'Beschikbaarheid',

  // Batch B
  TAB_KORTING: 'Korting',          // tab in de loonheffing-sheet (Korting.gs v1.5)
  KORT_HERINNER_DAGEN: 3,
  KORT_LB_NL: 'https://download.belastingdienst.nl/belastingdienst/docs/model_opgaaf_gegevens_loonheffingen_lh0082z11fol.pdf',
  KORT_LB_EN: 'https://download.belastingdienst.nl/belastingdienst/docs/stat-of-dat-payroll-taxes-lh0082z5foleng.pdf',
  SALARIS_EMAIL: 'mafshari@hrmonline.nl',   // salarisadministratie (Mahdia / HRM Online)
  SALARIS_LOON_KOL: 11,            // K in de loonheffing-sheet: tijdstempel 'naar salaris gestuurd'
  SALARIS_ONTSLAG_KOL: 15,         // O in de ontslag-sheet
  CONTRACT_DAGEN_TERUG: 90,        // Contract.gs v3.0: starters vanaf 90 dagen geleden (incl. toekomst)
  CONTRACT_MAX_USERS: 40,

  // Batch C — Vastloners (Vastloners.gs v30.0 + claude/vastloners-configuratie.md)
  VASTLONER_TREFWOORDEN: ['store manager', 'storemanager', 'shopmanager', 'bedrijfsleider'],
  VASTLONER_NAMEN: ['Lisa Seidelt', 'Cassandra Liacos', 'Frida Csaszar', 'Joline van Wegen', 'Julia Vesseur', 'Anna Maeda', 'Viktoria Platthy', 'Sophie van den Broek', 'Maria-Daria Puia', 'Amber Tomas', 'Arle Koster', 'Puck Hermans'],
  VASTLONER_EXTRA: [],        // e-mailadressen die altijd meetellen
  VASTLONER_UITSLUITEN: [],   // e-mailadressen die nooit meetellen
  // Verloftypes op Shiftbase absentee_option_id: categorie + loonconsequentie (hoofdregel wet; nog af te stemmen met salarisadministratie/CAO)
  VL_TYPE_MAP: {
    '1019457': { naam: 'Vakantie', cat: 'vakantie', loon: '' },
    '1019458': { naam: 'Ziek', cat: 'ziekte', loon: 'wachtdag via Shiftbase' },
    '1019459': { naam: 'Nationale feestdag', cat: 'negeren', loon: 'geen mutatie' },
    '1019460': { naam: 'Bijzonder verlof', cat: 'overig', loon: 'betaald of onbetaald volgens CAO' },
    '1019461': { naam: 'Zwangerschapsverlof', cat: 'overig', loon: 'WAZO-uitkering via UWV' },
    '1019462': { naam: 'Kortdurend zorgverlof', cat: 'overig', loon: '70% van het loon' },
    '1019463': { naam: 'Langdurend zorgverlof', cat: 'overig', loon: 'in beginsel onbetaald' },
    '1019464': { naam: 'Ouderschapsverlof', cat: 'overig', loon: 'betaald deel via UWV' },
    '1019465': { naam: 'Onbetaald verlof', cat: 'onbetaald', loon: 'inhouden op het salaris' }
  },
  VL_ZIEKTE_WOORDEN: ['ziek', 'sick', 'verzuim'],
  VL_VERLOF_WOORDEN: ['vakantie', 'verlof', 'vrij', 'holiday', 'vacation', 'atv', 'tvt'],
  VL_SAMENTEL_DAGEN: 28,      // 4-wekenregel art. 7:629 lid 10 BW
  VL_TERUGKIJK_DAGEN: 70,     // om samentelling te kunnen beoordelen

  // Vakantieplanner (Shiftbase.gs v6)
  VAKANTIE_WEKEN: 8,
  VAKANTIE_DREMPEL_ORANJE: 0.20,
  VAKANTIE_DREMPEL_ROOD: 0.30,
  VAKANTIE_PIEK_WEKEN: 4,
  VAKANTIE_PIEK_MIN_BEZETTING: 3,

  // Verloopanalyse (Verloop.gs v1.3)
  VRL_VROEG_DAGEN: 90,
  VRL_MIN_BESTAND: 3,
  VRL_UITGESLOTEN_TEAMS: ['HQ', 'Keuken', 'Logistiek', 'Flexpool Den Haag'],
  VRL_FLEX_UITSLUITEN: true,
  VRL_COHORTEN: [30, 60, 90],

  // Batch D
  TAB_NOTITIES: 'Notities',        // tab in de loonheffing-sheet (Dossier.gs): A Naam B Email C Datum D Auteur E Notitie
  TAB_ARCHIEF: 'Archief',
  BHR_JAREN_DOSSIER: 2,            // AVG-bewaartermijn personeelsdossier (ontslag, sommaties, waarschuwingen) na einde dienstverband
  BHR_JAREN_LOON: 5,               // loonheffingsverklaring-administratie (fiscaal; kopie in de sheets)

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
  // INDIENSTLINK (Drive-export) is vervangen door public/Indiensttredingsformulier_SLA.xlsx (sjablonen.indienstLink) — 16-10-2026
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
