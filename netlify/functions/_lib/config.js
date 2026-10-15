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
    overplaatsing: { id: '150zw8o-3MpjxXX4960qAWV2PsLxv0OTL8mq8FpiYUiQ', tab: 'Overplaatsing' }
  },

  // Extra log-tabs voor het dossier. Deze zitten in modules (Waarschuwing.gs,
  // Proeftijd.gs, VrijeBrief.gs, Korting.gs, Beschikbaarheid.gs) waarvan de
  // sheet-structuur hier nog niet bekend is. Vul aan: {label, id, tab, naamKol, emailKol, datumKol}
  // naamKol/emailKol/datumKol = 0-based kolomindex.
  DOSSIER_EXTRA_TABS: [
    // { label:'Waarschuwingen', id:'...', tab:'Waarschuwingen', naamKol:0, emailKol:1, datumKol:5 },
  ],

  AANZEG_VENSTER_DAGEN: 42,

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
