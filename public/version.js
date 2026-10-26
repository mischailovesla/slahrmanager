// Eén plek voor het versienummer én het logboek "Wat is er nieuw" (Help → Wat is er nieuw).
// Bij elke oplevering: bovenaan een nieuw item toevoegen (nummer, datum, titel, punten in gewone taal voor HR).
// HR_VERSIE (badge en voettekst) komt automatisch uit het bovenste item; package.json volgt het nummer.
window.HR_VERSIES = [
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
