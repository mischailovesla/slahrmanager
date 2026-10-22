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
  // Ontslag/aanzegging: na zoveel automatische herinneringen stopt de mail; de taak blijft rood staan (bellen, of zelf uploaden).
  ONTSLAG_MAX_HERINNERINGEN: 3,
  // Na zoveel dagen zonder handtekening wordt de ontslagbevestiging/aanzegging automatisch gearchiveerd (Mischa, 20-10-2026:
  // "wie na 30 dagen niet getekend heeft, doet dat ook niet meer"). Blijft zichtbaar in het archief, het dossier en de analyses.
  ONTSLAG_ARCHIVEER_DAGEN: 30,

  // Signaleringen (uit Shiftbase.gs v9.4) — stap 4
  // v0.25.7: Keuken valt onder Jop — signalen over keukenmedewerkers gaan naar hem i.p.v. naar HR
  KEUKEN_EMAIL: 'jop@ilovesla.com',
  SIGNALERING_ONTVANGERS: {
    nieuweMedewerkers: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    salaris: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    mto: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',     // herinnering in feb/sep: tijd voor een MTO-ronde // overzicht na de automatische run naar salaris (ma + do)
    aanzegtermijn: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    stilleAfwezigen: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    weekendBeschikbaarheid: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    vakantiepiek: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    dataHygiene: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    bewaartermijn: 'mischa@ilovesla.com',
    contractketen: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    verzuim: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    jeugd: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    oproepaanbod: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    checkin: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    maandrapport: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    jubilea: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    datacontrole: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com',
    zomerpiek: 'mischa@ilovesla.com,jodi@ilovesla.com,ymke@ilovesla.com'
  },
  // v0.26.0: jubilea (jaren in dienst, seintje een week vooruit) en zomerpiek-alert (maart t/m juli, kijkt naar juli/augustus)
  JUBILEUM_JAREN: [1, 2, 5, 10, 15, 20],
  ZOMERPIEK_VAN: '03-01',
  ZOMERPIEK_TOT: '07-31',

  // ---- Fase 2: juridische checks (wettelijke defaults; CAO Horeca-afwijkingen hier aanpassen) ----
  // Ketenregeling (art. 7:668a BW): na 3 tijdelijke contracten of 36 maanden wordt het volgende contract onbepaalde tijd;
  // een onderbreking van > 6 maanden breekt de keten. Signaal zodra het huidige contract binnen KETEN_VENSTER_DAGEN afloopt.
  KETEN_MAX_CONTRACTEN: 3,
  KETEN_MAX_MAANDEN: 36,
  KETEN_ONDERBREKING_MAANDEN: 6,
  KETEN_VENSTER_DAGEN: 60,
  // Standaard looptijden bij SLA (Mischa, 22-10-2026): 7, 12 en 16 maanden. Andere 'hele maanden'-einden in Shiftbase zijn wijzigingen (knips).
  KETEN_LOOPTIJDEN_MAANDEN: [7, 12, 16],
  // Fase 4c: contractverlenging als proces — vanaf 60 dagen vóór het einde een besluit vragen, uiterlijk 35 dagen vóór het einde
  // (5 dagen marge op de wettelijke aanzegtermijn van 1 maand); na een besluit 'verlengen' moet het contract binnen 7 dagen in Shiftbase staan.
  VERLENG_VENSTER_DAGEN: 60,
  VERLENG_BESLUIT_DAGEN: 35,
  VERLENG_SHIFTBASE_DAGEN: 7,
  // Proeftijd (art. 7:652 BW): contract ≤ 6 mnd geen proeftijd; > 6 mnd en < 2 jaar max 1 maand; ≥ 2 jaar of onbepaald max 2 maanden.
  // Alleen geldig als schriftelijk overeengekomen — het signaal zegt daarom "indien overeengekomen".
  PROEFTIJD_SIGNAAL_DAGEN: 10,       // zoveel dagen vóór het einde van de proeftijd
  // Oproepovereenkomst (art. 7:628a lid 5 BW): na 12 maanden verplicht aanbod vaste arbeidsomvang (gemiddelde van die 12 maanden), binnen 1 maand.
  OPROEP_TREFWOORDEN: ['oproep', 'nul', '0-uren', '0 uren', 'min-max', 'min/max', 'flex'],
  OPROEP_MAANDEN: 12,
  OPROEP_SIGNAAL_DAGEN: 30,          // signaal vanaf 30 dagen vóór de 12-maandsgrens
  // Jeugd: minimumjeugdloon stijgt per verjaardag t/m 20 jaar; Arbeidstijdenwet/Nadere regeling kinderarbeid voor < 18.
  JEUGD_LOON_MAX_LEEFTIJD: 20,
  JEUGD_VERJAARDAG_DAGEN: 21,        // zoveel dagen vooruit kijken
  ATW_REGELS: {                      // per leeftijdsgroep: uiterste eindtijd, max uren per dienst, max uren per week
    '15': { tot: '19:00', dienstMaxUur: 8, weekMaxUur: 40, label: '15 jaar: tot 19:00, max 8 u/dienst, 40 u/week' },
    '16-17': { tot: '23:00', dienstMaxUur: 9, weekMaxUur: 45, label: '16–17 jaar: tot 23:00, max 9 u/dienst, 45 u/week' }
  },
  ATW_DAGEN_VOORUIT: 14,
  // Verzuim / Wet verbetering poortwachter (mijlpalen in dagen vanaf de 1e ziektedag); 4-wekenregel: ziekteperiodes < 28 dagen uit elkaar tellen als één.
  VERZUIM_MIJLPALEN: [
    { dag: 42, label: 'Probleemanalyse bedrijfsarts (week 6)' },
    { dag: 56, label: 'Plan van aanpak opstellen (week 8)' },
    { dag: 294, label: 'Ziekmelding bij UWV (week 42)' },
    { dag: 364, label: 'Eerstejaarsevaluatie (week 52)' }
  ],
  VERZUIM_SAMENTEL_DAGEN: 28,
  VERZUIM_SIGNAAL_DAGEN: 7,          // mijlpaal binnen 7 dagen (vooruit) of 7 dagen geleden (gemist)
  VERZUIM_FREQUENT_AANTAL: 3,        // ≥ 3 ziekmeldingen in 12 maanden → frequent-verzuimgesprek
  VERZUIM_TERUGKIJK_DAGEN: 730,
  // Uitstroomredenen (verplicht bij ontslagbevestiging/aanzegging; zichtbaar in Verloopanalyse)
  // Exit-survey (fase 2f): korte vragenlijst in de aanzeggings-/ontslagbrief en -mail i.p.v. een exitgesprek (SLA doet geen exitgesprekken).
  // schaal = 1–5 (1 = helemaal oneens, 5 = helemaal eens), nps = 0–10, keuze = één uit opties, tekst = open.
  EXIT_VRAGEN: [
    { key: 'reden', type: 'keuze', nl: 'Wat is de belangrijkste reden dat je bij SLA weggaat?', en: 'What is the main reason you are leaving SLA?',
      opties: [['andere-baan', 'Andere baan / carrière', 'Another job / career'], ['studie-verhuizing', 'Studie of verhuizing', 'Study or moving'], ['rooster', 'Rooster of uren pasten niet', 'Schedule or hours did not fit'], ['werkdruk', 'Werkdruk of sfeer', 'Workload or atmosphere'], ['leiding', 'Leidinggevende of team', 'Manager or team'], ['salaris', 'Salaris of arbeidsvoorwaarden', 'Pay or conditions'], ['contract', 'Contract niet verlengd', 'Contract not renewed'], ['anders', 'Anders', 'Other']] },
    { key: 'sfeer', type: 'schaal', nl: 'Ik voelde me welkom en gewaardeerd in het team.', en: 'I felt welcome and valued in the team.' },
    { key: 'leiding', type: 'schaal', nl: 'Mijn Store Manager gaf duidelijke sturing en feedback.', en: 'My Store Manager gave clear direction and feedback.' },
    { key: 'onboarding', type: 'schaal', nl: 'Mijn inwerkperiode en trainingen (SLA Academy) hebben me goed voorbereid.', en: 'My onboarding and training (SLA Academy) prepared me well.' },
    { key: 'rooster', type: 'schaal', nl: 'Het rooster en de uren pasten bij mijn situatie.', en: 'The schedule and hours fitted my situation.' },
    { key: 'nps', type: 'nps', nl: 'Hoe waarschijnlijk is het dat je SLA als werkgever aanbeveelt aan een vriend(in)?', en: 'How likely are you to recommend SLA as an employer to a friend?' },
    { key: 'terug', type: 'keuze', nl: 'Zou je in de toekomst weer bij SLA willen werken?', en: 'Would you consider working at SLA again in the future?', opties: [['ja', 'Ja', 'Yes'], ['misschien', 'Misschien', 'Maybe'], ['nee', 'Nee', 'No']], toelichting: true },
    { key: 'opmerking', type: 'tekst', nl: 'Wat had SLA anders kunnen doen om je te behouden, of wat wil je ons nog meegeven?', en: 'What could SLA have done differently to keep you, or what else would you like to tell us?', alleenEigenOntslag: true }
  ],
  EXIT_GELDIG_DAGEN: 90,
  EXIT_AUTO_INHAAL_DAGEN: 7,        // exit-survey automatisch de dag na de laatste werkdag; gemiste dagen tot 7 dagen terug inhalen
  // Fase 3a: check-in na 30 en 60 dagen in dienst (vroege uitstroom voor zijn). Vragen + aan/uit in hr_instellingen
  // ('checkin_vragen', 'checkin_actief'); dit is de standaardlijst. Een keuze-optie met alarm=true (4e element) maakt de check-in 'laag'.
  CHECKIN_VRAGEN: [
    { key: 'naar-zin', type: 'schaal', nl: 'Ik heb het naar mijn zin bij SLA.', en: 'I enjoy working at SLA.' },
    { key: 'ingewerkt', type: 'schaal', nl: 'Ik ben goed ingewerkt en weet wat er van me verwacht wordt.', en: 'I was trained well and know what is expected of me.' },
    { key: 'hulp', type: 'schaal', nl: 'Mijn Store Manager en collega\'s helpen me als ik iets niet weet.', en: 'My Store Manager and colleagues help me when I am unsure.' },
    { key: 'rooster', type: 'schaal', nl: 'Mijn rooster en uren passen bij wat we hebben afgesproken.', en: 'My schedule and hours match what we agreed.' },
    { key: 'blijven', type: 'keuze', nl: 'Zie je jezelf over een halfjaar nog bij SLA werken?', en: 'Do you see yourself still working at SLA in six months?', opties: [['ja', 'Ja', 'Yes'], ['misschien', 'Misschien', 'Maybe'], ['nee', 'Nee', 'No', true]] },
    { key: 'hulpvraag', type: 'tekst', nl: 'Is er iets waar we je mee kunnen helpen?', en: 'Is there anything we can help you with?' }
  ],
  // Medewerkertevredenheidsonderzoek (fase 5); vragen in _lib/mto-vragen.js
  MTO_MIN_N: 4,                      // een winkel/groep pas tonen vanaf zoveel reacties (anonimiteit)
  MTO_LOOPTIJD_DAGEN: 21,            // ronde sluit na zoveel dagen
  MTO_HERINNERING_DAGEN: [7, 14],    // herinneringen aan wie nog niet invulde
  MTO_MAANDEN: [2, 9],               // in deze maanden een seintje aan HR om een ronde te starten
  CHECKIN_MOMENTEN: [30, 60],          // dagen na de eerste werkdag (eerste contract in Shiftbase)
  CHECKIN_VENSTER_DAGEN: 7,            // uitnodigen tot zoveel dagen na het moment (vangt gemiste dagen op; oudere medewerkers krijgen er geen)
  CHECKIN_HERINNERING_DAGEN: 5,        // één herinnering als er na zoveel dagen nog niets is ingevuld
  CHECKIN_GELDIG_DAGEN: 30,            // link geldig na versturen
  CHECKIN_LAAG_SCHAAL: 2,              // een schaalantwoord ≤ dit getal (of een alarm-optie) = lage check-in → mail + taak voor HR             // link werkt tot 90 dagen na versturen
  // Fase 3b: gesprekken vastleggen in het dossier. hint = wat er in het formulier boven de velden staat.
  GESPREK_SOORTEN: [
    { key: 'checkin', label: 'Opvolging check-in', hint: 'Na een lage check-in: vraag door op wat er speelt en spreek iets concreets af (wie doet wat, wanneer).' },
    { key: 'proeftijd', label: 'Proeftijdgesprek', hint: 'Bespreek vóór het einde van de proeftijd wat goed gaat en wat beter moet, en leg de beslissing vast. Opzeggen in de proeftijd kan alleen tot en met de laatste dag (art. 7:652 BW).' },
    { key: 'verzuim', label: 'Verzuimgesprek', hint: 'Leg géén medische informatie vast (AVG): geen diagnose, klachten, oorzaak of behandeling — het dashboard weigert zulke woorden. Kies hieronder de duur, werkhervatting, bedrijfsarts en bereikbaarheid; bij Afspraken alleen wie wat doet en wanneer.' },
    { key: 'waarschuwing', label: 'Correctiegesprek', hint: 'Beschrijf feitelijk wat er is gebeurd (datum, wat, wie erbij was), de reactie van de medewerker (hoor en wederhoor) en wat je hebt afgesproken. Een schriftelijke waarschuwing verstuur je via Dossier → Waarschuwingen.' },
    { key: 'functioneren', label: 'Functioneringsgesprek', hint: 'Wat gaat goed, wat kan beter, ontwikkelwensen en afspraken voor de komende periode.' },
    { key: 'overig', label: 'Overig', hint: '' }
  ],
  GESPREK_KANALEN: ['In de winkel', 'Telefonisch', 'Op kantoor', 'Videobellen'],
  // v0.27.0: verzuimgesprek zonder vrije tekst over 'wat er besproken is' — alleen wat een werkgever mag vastleggen (AVG/UAVG art. 30)
  VERZUIM_VELDEN: [
    { key: 'duur', label: 'Verwachte duur', opties: ['Binnen een week', '1–4 weken', 'Langer dan 4 weken', 'Onbekend'] },
    { key: 'werk', label: 'Werken mogelijk?', opties: ['Nee, nog niet', 'Gedeeltelijk / aangepast werk', 'Ja, volledig', 'In overleg met bedrijfsarts'] },
    { key: 'arts', label: 'Bedrijfsarts', opties: ['Nog niet nodig', 'Ingeschakeld', 'Afspraak gepland', 'Advies ontvangen'] },
    { key: 'contact', label: 'Bereikbaarheid', opties: ['Wekelijks contact afgesproken', 'Medewerker meldt zich zelf', 'Via Store Manager', 'Anders (zie afspraken)'] }
  ],
  GESPREK_VERVOLG_TE_LAAT_DAGEN: 7,     // vervolg zoveel dagen over tijd = rood op de takenlijst
  // Fase 4a: koppeling met SLA Academy (Supabase-project "training"). URL + publishable key zijn openbaar (staan ook in de Academy-app);
  // de toegang zit in de geheime sleutel ACADEMY_HR_SLEUTEL (env) die hr_training_status() controleert.
  ACADEMY_URL: 'https://xiyyyminsswiucnluxbf.supabase.co',
  ACADEMY_KEY: 'sb_publishable_WRtl8X1QhfVWaQt0NrMLrA_q9ueIilJ',
  ACADEMY_CACHE_MIN: 15,               // zo lang onthoudt een function de Academy-stand
  ACADEMY_NOOIT_INGELOGD_DAGEN: 7,     // welkomstmail zoveel dagen geleden en nog nooit ingelogd = signaal
  ACADEMY_WELKOM_DAGEN: 21,            // welkomstcollectie af binnen zoveel dagen na de eerste werkdag (zelfde norm als de onboarding-checklist)
  ACADEMY_CERT_WAARSCHUW_DAGEN: 30,    // certificaat verloopt binnen zoveel dagen = oranje (Academy gebruikt dezelfde grens)
  UITSTROOMREDENEN: ['Eigen keuze: andere baan', 'Eigen keuze: studie/verhuizing', 'Eigen keuze: werk/privé of rooster', 'Einde tijdelijk contract (niet verlengd door SLA)', 'Proeftijd', 'Functioneren', 'Gedrag/huisregels', 'Ontslag op staande voet', 'Wederzijds goedvinden', 'Langdurig ziek', 'Overig/onbekend'],
  LOON_AUTO_MIN_DAGEN: 3,          // automatische loonheffingsuitnodiging: deadline = startdatum, maar minstens vandaag + 3 dagen
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
  SALARIS_AUTO_DAGEN: 60,           // automatisch naar salaris: alleen dossiers met een verzenddatum in de laatste 60 dagen
  SALARIS_AUTO_VANAF: '2026-10-01', // ...en nooit van vóór deze datum: alles daarvoor is al (deels persoonlijk) bij Mahdia aangeleverd
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
  BHR_JAREN_DOSSIER: 2,            // AVG-bewaartermijn personeelsdossier na einde dienstverband (alle dossiertabellen, mails, gesprekken, uploads behalve loonheffing)
  BHR_JAREN_LOON: 5,               // loonheffingsverklaring + kopie-ID + korting: 5 jaar na het einde van het kalenderjaar van uit dienst (fiscaal)
  BHR_JAREN_LOG: 2,               // v0.27.0: actielog, toegangslog (rollend, vanaf het tijdstip)
  BHR_MAANDEN_SIGNALERING: 12,     // v0.27.0: runs van de automatische checks (bevatten namen)
  UPLOAD_GELDIG_DAGEN: 60,         // v0.27.0: persoonlijke upload-/tekenlinks verlopen na 60 dagen (nieuwe link: ⋯ → 🔗 Uploadlink)

  // ---- Fase 1: on-/offboarding-checklists (sjablonen; aanpassen = hier) ----
  CHECKLIST_ONBOARDING: [
    { key: 'contract', label: 'Arbeidsovereenkomst getekend retour (Shiftbase)' },
    { key: 'id', label: 'Identiteit gecontroleerd + kopie ID in dossier (WID, 5 jaar na uitdiensttreding bewaren)' },
    { key: 'loonheffing', label: 'Loonheffingsverklaring ontvangen (anders anoniementarief 52%)' },
    { key: 'bankgegevens', label: 'IBAN + BSN bij salarisadministratie (eerste loonrun)' },
    { key: 'shiftbase', label: 'Shiftbase-account actief, rooster ingepland' },
    { key: 'academy', label: 'SLAcademy: introductie + allergenen/HACCP-instructie afgerond' },
    { key: 'huisregels', label: 'Huisregels + weekendbeschikbaarheid besproken en bevestigd' },
    { key: 'buddy', label: 'Buddy/mentor eerste twee weken aangewezen' },
    { key: 'proeftijd', label: 'Proeftijdgesprek ingepland (uiterlijk week 3)' }
  ],
  CHECKLIST_OFFBOARDING: [
    { key: 'bevestiging', label: 'Ontslagbevestiging / aanzegging verstuurd en ondertekend retour' },
    { key: 'laatstedag', label: 'Laatste werkdag + einddatum in Shiftbase gezet' },
    { key: 'verlof', label: 'Openstaand verlof / plus-min-uren doorgegeven voor de eindafrekening' },
    { key: 'salaris', label: 'Documenten naar salarisadministratie (eindafrekening, transitievergoeding gecheckt)' },
    { key: 'spullen', label: 'Sleutels, kleding, pasjes ingeleverd' },
    { key: 'toegang', label: 'Toegang ingetrokken: Shiftbase, SLAcademy, mail, kassa' },
    { key: 'getuigschrift', label: 'Getuigschrift aangeboden (art. 7:656 BW)' },
    { key: 'exit', label: 'Exitgesprek gevoerd + uitstroomreden vastgelegd' }
  ],

  // Mail / huisstijl (uit Code.gs)
  AFZENDER_TEAM: 'SLA HR Team',
  AFZENDER_NAAM: 'Jop van de Graaf',
  HR_EMAIL: 'hr@ilovesla.com',
  BEDRIJFSNAAM: 'SLA',

  // Loonheffing-flow: links en prefill (v29.4)
  UPLOAD_LOON: '[persoonlijke upload-link]',            // placeholder; bij versturen vervangen door de persoonlijke link (personaliseerUploadLinks)
  UPLOAD_OUDE_LINKS: ['https://docs.google.com/forms/d/e/1FAIpQLSccn1Y4826aho-hIBSrbpw07BbCPAYmSVx2Fjlms08H8XNHgA/viewform?usp=header', 'https://docs.google.com/forms/d/e/1FAIpQLSfI7REFmrvQFDBtfnGTbot_ra2RV6-w_g137FcnD7Dnaakgaw/viewform?usp=sf_link'], // oude Google Forms (in oude/bewerkte teksten): ook vervangen,
  PREFILL_LOON_ENTRY: 'entry.35290118',
  // Ontslag/aanzegging-flow (uit Code.gs): upload-formulier. De brieven zelf staan in _lib/brieftemplates.js
  UPLOAD_ONTSLAG: '[persoonlijke link om te ondertekenen]',
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
  // v0.25.13: franchisewinkels horen niet in het HR-dashboard (Mischa, 22-10-2026). Naast de afdelings-id's ook op teamnaam,
  // zodat Amersfoort (id onbekend) en eventuele extra teams van deze winkels ook wegvallen. \b: Haarlemmerdijk blijft gewoon staan.
  FRANCHISE_NAAM: /\b(haarlem|groningen|amersfoort)\b/i,
  SB_UITGESLOTEN_NAMEN: ['Afwasser T', 'Af Wasser', 'Test Test'],
  VAKANTIE_OPTION_ID: '1019457'
};
