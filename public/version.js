// Eén plek voor het versienummer én het logboek "Wat is er nieuw" (Help → Wat is er nieuw).
// Bij elke oplevering: bovenaan een nieuw item toevoegen (nummer, datum, titel, punten in gewone taal voor HR).
// HR_VERSIE (badge en voettekst) komt automatisch uit het bovenste item; package.json volgt het nummer.
window.HR_VERSIES = [
  { nummer: '0.34.4', datum: '28-10-2026', titel: 'Shiftbase-templates: gegevens in een tabel', punten: [
    'De gegevens van werkgever en werknemer bovenaan de contracten staan nu in een tabel (zonder lijnen). Shiftbase zette ze bij het uploaden scheef.',
    'Het Store Manager-contract had als titel nog “Contract Sla maker”. Dat is nu “Contract Store Manager”.'
  ] },
  { nummer: '0.34.3', datum: '28-10-2026', titel: 'Contracten op naam van de eigenaar', punten: [
    'Alle Shiftbase-templates en Contract op maat zeggen nu: werkgever vertegenwoordigd door <b>Jop van de Graaf</b> (eigenaar). Bij een wissel van operations manager hoeft er niets te veranderen.'
  ] },
  { nummer: '0.34.2', datum: '28-10-2026', titel: 'Fix: Shiftbase-templates downloaden', punten: [
    'Downloaden van Shiftbase-templates gaf de melding “no such file or directory”. Opgelost: het dashboard vindt de templates nu ook na het online zetten.'
  ] },
  { nummer: '0.34.1', datum: '28-10-2026', titel: 'Shiftbase-templates gelijkgetrokken', punten: [
    'Alle contracttemplates zeggen nu hetzelfde: loon <b>rond de 14e van de volgende maand</b>, werktijden <b>vanaf 09.00</b> en functie-indeling Sla maker <b>A.3.I</b>, Junior Store Manager A.4.I en Store Manager A.5.I.',
    'De regel “eerste zes maanden alleen loon als je hebt gewerkt” staat alleen nog in het eerste contract van een Sla maker (oproep). Bij verlengingen, onbepaalde tijd en vaste uren is hij weg.',
    'Store Manager-contracten zeggen niet meer “indien opgeroepen”: zij hebben vaste uren.',
    'Verlengingen gebruiken de functie uit Shiftbase ({job_title}) en hebben nu ook de huisregels als bijlage.'
  ] },
  { nummer: '0.34.0', datum: '28-10-2026', titel: 'Shiftbase-templates per winkel', punten: [
    'Nieuw onder Instroom: <b>Shiftbase-templates</b>. Per winkel download je de contracttemplates voor Shiftbase als Word-bestand: Sla maker, Junior Store Manager en Store Manager, plus de verlengingen en het Sla maker-contract voor onbepaalde tijd. BV, adres, standplaats en plaats van ondertekening staan er per winkel al goed in.',
    'Downloaden kan per template, per winkel als zip, per soort voor alle winkels, of alles in één keer.',
    'De <b>huisregels</b> beheer je nu op één plek. Ze gaan in de templates én in Contract op maat. De korting staat er nu met je <b>SLAcademy-account</b> in, niet meer met Apprendo.',
    'HQ (SLA Holding BV) staat er niet bij: deze teksten gaan uit van de cao Horeca, 38 uur en PH&amp;C.'
  ] },
  { nummer: '0.33.5', datum: '27-10-2026', titel: 'Contract op maat: deeltijd', punten: [
    'Bij een deeltijdcontract (bijv. 24 of 32 uur) vul je het <b>fulltime</b> maandsalaris in. Het contract noemt dan beide bedragen: het fulltime salaris (38 uur, holding 40 uur) én het salaris naar rato voor de afgesproken uren. Ook de samenvatting toont het deeltijdbedrag.'
  ] },
  { nummer: '0.33.4', datum: '27-10-2026', titel: 'Herinnering adres aanvullen', punten: [
    'Medewerkers zonder adres in Shiftbase krijgen op de <b>1e van elke maand</b> zelf een mail (NL/EN) om hun adres aan te vullen in de Shiftbase-app. Wie uit dienst gaat, krijgt hem niet.',
    'Een ontbrekende <b>functie</b> blijft een taak voor HR: die hoort bij het contract en kan de medewerker niet zelf invullen.'
  ] },
  { nummer: '0.33.3', datum: '27-10-2026', titel: 'Contract op maat: afspraken holding', punten: [
    'Kies je bij Contract op maat <b>HQ · SLA Holding BV</b>, dan staat in het contract een fulltime werkweek van <b>40 uur</b> (salaris op basis van 40 uur) en <b>pensioen via a.s.r.</b> in plaats van Pensioenfonds Horeca &amp; Catering. Voor de winkels blijft het 38 uur en PH&amp;C.',
    'De holding valt <b>niet onder een cao</b>: het contract zegt dan dat er geen cao van toepassing is, zonder functie-indeling Horeca, en overwerk wordt gecompenseerd in vrije tijd (tijd voor tijd).',
    'Ziekte bij de holding: <b>70%</b> loondoorbetaling (maximaal 104 weken, het eerste jaar minimaal het minimumloon) en <b>2 wachtdagen</b>. Winkels: 95% / 75% en 1 wachtdag.'
  ] },
  { nummer: '0.33.1', datum: '27-10-2026', titel: 'Kantoor onder SLA Holding BV', punten: [
    'Medewerkers van kantoor (team HQ in Shiftbase) vallen nu onder <b>SLA Holding BV</b>, Amstelveenseweg 124 in Amsterdam. Bij contract op maat, brieven, waarschuwingen en overplaatsingen kun je HQ als werkgever kiezen; de BV vult zich vanzelf in.',
    'HQ blijft uitgesloten van de winkelmail, de weekend- en stille-afwezigencontrole en het verloop per winkel.'
  ] },
  { nummer: '0.33.0', datum: '27-10-2026', titel: 'Contract op maat', punten: [
    'Nieuw onder Instroom: <b>Contract op maat</b>, voor afwijkende contracten die niet in Shiftbase kunnen. De tekst is gelijk aan de Shiftbase-template (Store Manager, bepaalde tijd).',
    'Bouwstenen: <b>fasering</b> (bijv. eerst een nulurencontract met uurloon, daarna vaste uren met maandsalaris), <b>NS Business Card</b> (2e of 1e klas, met of zonder privégebruik) en een vrij artikel <b>Aanvullende afspraken</b>. Artikelen worden automatisch doorgenummerd.',
    'Het dashboard controleert onderweg o.a. de proeftijd (geen proeftijd bij een contract van 6 maanden of korter) en of fase 2 aansluit op fase 1.',
    'PDF bekijken of direct versturen: de medewerker ondertekent digitaal, net als bij de andere brieven. BSN en IBAN staan alleen in de PDF, niet in het logboek.',
    'Zet het contract daarna nog wel in Shiftbase (bij fasering ook de overgang), voor het rooster en de salarisadministratie.'
  ] },
  { nummer: '0.32.3', datum: '26-10-2026', titel: 'HR-weekoverzicht op maandag om 09:00', punten: [
    'Het HR-overzicht (was: dagoverzicht) is nu een <b>weekoverzicht</b>: elke maandag om <b>09:00</b>, zomer en winter.',
    'Op maandag gaat om 08:30 alles automatisch naar salaris; in het weekoverzicht zie je meteen wat er naar Mahdia is gestuurd. Wat donderdag naar salaris gaat, staat in het overzicht van de maandag erna.',
    'Van dagelijkse controles (contracten, verzuim) staat alleen de laatste stand in de mail. Tussendoor zie je ze als taak op het Overzicht in het dashboard.',
    'Winkelmail: aflopende contracten staan er nu <b>8 weken</b> van tevoren in (was 6). De store manager krijgt zo een paar maandagen de tijd om advies te geven, vóór HR uiterlijk 35 dagen voor het einde beslist.'
  ] },
  { nummer: '0.32.2', datum: '26-10-2026', titel: 'Datacontrole maandelijks, weekendbeschikbaarheid uit de mail', punten: [
    'De Shiftbase-datacontrole komt nu <b>één keer per maand</b> (op de 1e) als aparte mail, niet meer elke maandag in het dagoverzicht.',
    'Weekendbeschikbaarheid staat niet meer in de mail. Wie drie weekenden geen dienst had, zie je nog wel als taak op het Overzicht.'
  ] },
  { nummer: '0.32.1', datum: '26-10-2026', titel: 'Test-dagoverzicht', punten: [
    'Een test van het HR-dagoverzicht kan naar jezelf: draai bij Signaleringen een paar checks als Droogloop; de test bundelt die voorbeelden in één mail.'
  ] },
  { nummer: '0.32.0', datum: '26-10-2026', titel: 'Eén HR-dagoverzicht in plaats van losse mails', punten: [
    'Alle automatische meldingen voor HR (contracten, verzuim, jeugd, oproepaanbod, datacontrole, jubilea, salaris, nieuwe medewerkers enz.) komen nu in <b>één mail per werkdag</b> rond 11:00. Maandag bevat ook het weekend.',
    'Mails aan medewerkers gaan gewoon direct. Alleen <i>mail niet aangekomen</i> en een lage check-in komen ook nog los, omdat die snel opvolging nodig hebben.',
    'Keukenmeldingen gaan in een eigen dagoverzicht naar Jop.'
  ] },
  { nummer: '0.31.5', datum: '26-10-2026', titel: 'Oproepaanbod: alleen nieuwe meldingen', punten: [
    'Het dashboard meldt een aanbod vaste arbeidsomvang alleen nog rond de 12-maandsgrens (vanaf 30 dagen ervoor tot 30 dagen erna). Oude grenzen verdwijnen: SLA doet het aanbod altijd.',
    'Aanbod buiten het dashboard gedaan? Kies bij de taak ⋯ → <i>Aanbod al gedaan</i>; de taak verdwijnt tot de volgende jaargrens.'
  ] },
  { nummer: '0.31.4', datum: '26-10-2026', titel: 'Takenlijst weer overzichtelijk', punten: [
    '<b>Oproepaanbod</b>: geen taken meer met “gemiddeld 0 u/week”. De roosters worden in blokken opgehaald, wie in 12 maanden geen diensten had valt weg, en bij een verstreken grens telt de meest recente 12-maandsgrens.',
    '<b>Arbeidstijdenwet</b>: één taak per medewerker met alle diensten erin, in plaats van één taak per dienst.',
    'Een geboortedatum die niet kan kloppen (bijv. 0 jaar oud) geeft geen jeugdloon- of ATW-taken meer, maar een melding <i>Geboortedatum klopt niet</i> in de datacontrole.'
  ] },
  { nummer: '0.31.3', datum: '26-10-2026', titel: 'Datacontrole-mail overzichtelijker', punten: [
    'De maandagmail <b>Shiftbase-datacontrole</b> begint met een tabel per soort (aantal), daarna per soort wat je moet doen en maximaal 8 voorbeelden.',
    'Geen valse meldingen meer over overlappende contracten: een contract dat eindigt op de dag dat het volgende begint is normaal in Shiftbase.',
    '<i>Contract loopt door na uitdienst</i> alleen nog voor wie in de laatste 60 dagen is vertrokken.',
    'Dossiercontrole: 1 dag verschil tussen dossier en Shiftbase is geen fout meer, en medewerkers van HQ, keuken en logistiek worden nu wel gevonden.'
  ] },
  { nummer: '0.31.2', datum: '23-10-2026', titel: 'Besluiten: wie en wanneer', punten: [
    'Bij een contracttaak met een besluit staat nu wie het vastlegde en wanneer, bijv. “besluit: Medewerker stopt zelf (Mischa, 22-10)”.',
    'Bij <b>Besluit vastleggen</b> vraagt het dashboard eerst: “Besluit vastleggen voor [naam] … Klopt dat?” — zo komt een besluit niet per ongeluk bij de verkeerde medewerker.'
  ] },
  { nummer: '0.31.1', datum: '23-10-2026', titel: 'Help: inhoud scrolt mee', punten: [
    'De inhoudsopgave links in Help blijft nu in beeld als je naar beneden scrolt.'
  ] },
  { nummer: '0.31.0', datum: '23-10-2026', titel: 'Help in de app', punten: [
    'Nieuwe knop <b>Help</b> rechts in het menu: uitleg over het hele systeem, een zoekbalk en veelgestelde vragen.',
    '<b>Wat is er nieuw</b>: na elke update zie je een groene stip bij Help tot je de nieuwe punten hebt bekeken.',
    'Klik op het versienummer bovenaan om direct naar Wat is er nieuw te gaan.'
  ] },
  { nummer: '0.30.0', datum: '23-10-2026', titel: 'Verzuim in de scorekaart', punten: [
    'Scorekaart: <b>Frequent verzuim</b> — deel van de medewerkers met 3 of meer ziekmeldingen in 12 maanden, per winkel.',
    'Scorekaart: <b>Verzuimgesprek ≤ 30 d</b> — deel van die gevallen met een vastgelegd verzuimgesprek binnen 30 dagen.',
    'Beide staan ook in de PDF per winkel en in het maandrapport.'
  ] },
  { nummer: '0.29.0', datum: '23-10-2026', titel: 'Proeftijd-advies en jeugdloon', punten: [
    'Winkelmail: blok <b>Proeftijd loopt af</b> met een knop waarmee de store manager advies geeft (doorgaan / stoppen / twijfel).',
    'Het advies staat bij de proeftijdtaak; bij <i>stoppen</i> wordt de taak rood met de uiterste datum voor de brief.',
    'Verjaardagen t/m 21 jaar: de winkelmail noemt het nieuwe minimum-uurloon volgens de CAO Horeca (niet-vakkracht en vakkracht).'
  ] },
  { nummer: '0.28.3', datum: '22-10-2026', titel: 'App-icoon', punten: [
    'Favicon en app-icoon; het dashboard kan via “Zet op beginscherm” als app op telefoon of computer.'
  ] },
  { nummer: '0.28.2', datum: '22-10-2026', titel: 'Uurloon bij verjaardag', punten: [
    'Winkelmail: wie 21 of jonger wordt, krijgt een ⚠ “uurloon aanpassen in Shiftbase per …”.'
  ] },
  { nummer: '0.28.1', datum: '22-10-2026', titel: 'Verjaardagen in de winkelmail', punten: [
    'Winkelmail: blok <b>Jarig deze week</b> (naam en dag).'
  ] },
  { nummer: '0.28.0', datum: '22-10-2026', titel: 'Winkelmail voor store managers', punten: [
    'Elke maandag per winkel een weekoverzicht: wie nog moet tekenen of een formulier moet inleveren, aflopende contracten, nieuwe medewerkers, vertrek, jubilea en verloopcijfers.',
    'Bij aflopende contracten geeft de store manager zonder inlog <b>advies over verlengen</b>; dat staat daarna in de verlengingstaak en is voorgevuld bij het besluit.',
    'Instellen via Beheer → Winkelmail store managers (adressen, voorbeeld, proefstand).'
  ] },
  { nummer: '0.27.5', datum: '22-10-2026', titel: 'Direct naar salaris na tekenen', punten: [
    'Met <i>Automatisch naar salaris</i> aan gaat een getekende ontslagbevestiging of aanzegging meteen naar Mahdia — behalve als de dossiercontrole iets vindt.',
    'De schakelaar staat nu ook op de pagina Uitstroom.'
  ] },
  { nummer: '0.27.4', datum: '22-10-2026', titel: 'Mail niet aangekomen', punten: [
    'Elk uur controleert het dashboard of verstuurde mails zijn afgeleverd. Bounce of spam → mail aan HR en een rode taak.'
  ] },
  { nummer: '0.27.3', datum: '22-10-2026', titel: 'Offboarding automatisch', punten: [
    'De offboarding-checklist start bij het versturen van de brief en vinkt zelf af: ondertekend, naar salaris, uitdienstdatum in Shiftbase.'
  ] },
  { nummer: '0.27.2', datum: '22-10-2026', titel: 'Dossiercontrole en doorlooptijden', punten: [
    'Lopende ontslagdossiers worden vergeleken met Shiftbase (datums, einddatum, BV, e-mail); afwijkingen krijgen een ⚠.',
    'Scorekaart: <b>Loonheffing ≤ 7 d</b>, <b>Getekend na</b> en het blok <b>Doorlooptijden dossiers</b>.'
  ] },
  { nummer: '0.27.1', datum: '22-10-2026', titel: 'Lopende dossiers tot salaris', punten: [
    'Dossiers blijven bij Lopende dossiers staan tot ze naar salaris zijn gestuurd.',
    'Een nieuwe brief op een bestaande regel wist de oude ondertekening en herinneringen.',
    'Ontslagdossier: knop <b>✎ Gegevens wijzigen</b>. Verse stand in de takenlijst wordt bewaard.'
  ] },
  { nummer: '0.27.0', datum: '22-10-2026', titel: 'AVG-pakket', punten: [
    'Beheer → Bewaartermijnen: per oud-medewerker de wettelijke bewaartermijn, met opschonen door een beheerder.',
    'Verzuimgesprek zonder vrije tekst over medische zaken; upload- en tekenlinks verlopen na 60 dagen.'
  ] }
];
(function () {
  var v = window.HR_VERSIES[0];
  window.HR_VERSIE = { nummer: v.nummer, datum: v.datum, stap: v.titel, omschrijving: v.punten.map(function (p) { return p.replace(/<[^>]+>/g, ''); }).join(' ') };
})();
