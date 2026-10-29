// Help-inhoud (v0.31.0): handleiding + veelgestelde vragen. Alleen tekst; app.js tekent de Help-tab.
// Aanpassen = hier. Houd het kort, in gewone taal, en noem knoppen zoals ze in het dashboard heten.
window.HR_HELP = {
  secties: [
    { id: 'start', titel: 'Wat is het HR Dashboard', html:
      '<p>Het HR Dashboard is de plek waar HR (Mischa, Jodi, Ymke) het hele traject van een medewerker volgt: <b>instroom → in dienst → uitstroom</b>. Gegevens over medewerkers, contracten en verzuim komen uit <b>Shiftbase</b>; brieven, handtekeningen en dossiers staan in het dashboard zelf.</p>'
      + '<p>Veel gaat automatisch: mails, herinneringen, afvinken en doorsturen naar salaris. Jij beslist en voert de gesprekken. Store managers werken niet in het dashboard; zij krijgen elke maandag een winkelmail.</p>'
      + '<p><b>Rollen:</b> <i>beheerder</i> (alles, ook instellingen), <i>hr</i> (alles behalve instellingen), <i>keuken</i> (Jop: alleen de takenlijst met keukenmedewerkers). Franchisewinkels (Groningen, Haarlem, Amersfoort) staan er bewust niet in.</p>' },
    { id: 'dag', titel: 'Elke dag: het Overzicht', html:
      '<ol><li>Open <b>Overzicht → Te doen</b>. Rood = vandaag, oranje = deze week, grijs = ter info.</li>'
      + '<li>Elke taak heeft een groene hoofdknop (bijv. <i>Besluit vastleggen</i>, <i>Mail</i>, <i>Gesprek vastleggen</i>). Onder <b>⋯</b> staan de andere acties, zoals het dossier openen.</li>'
      + '<li>Al geregeld buiten het dashboard om? Kies onder ⋯ een <i>afhandel</i>-optie. De taak verdwijnt voor een vaste periode en dat wordt gelogd.</li>'
      + '<li>De taken komen uit de controles van vanochtend. Net iets gedaan en staat het er nog? Klik <b>Verse stand</b>.</li>'
      + '<li>Onderaan: <b>Lopende dossiers</b> per stap (wacht op handtekening → klaar voor salaris). Na de salarismail is een dossier afgerond.</li></ol>'
      + '<p>Met <b>Alle winkels</b> rechtsboven filter je het hele dashboard op één winkel. <b>Deze week</b> rechts toont starters, laatste werkdagen en einde proeftijd.</p>' },
    { id: 'auto', titel: 'Wat gaat automatisch', html:
      '<table class="help-tab"><thead><tr><th>Wat</th><th>Wanneer</th><th>Naar</th></tr></thead><tbody>'
      + '<tr><td>Herinneringen loonheffing, ontslagbrief, loonheffingskorting</td><td>dagelijks</td><td>medewerker</td></tr>'
      + '<tr><td>Uitdiensttreding bevestigen na 3 herinneringen (als <i>Automatisch afronden</i> aan staat)</td><td>dagelijks</td><td>medewerker + salaris</td></tr>'
      + '<tr><td>Getekende ontslagbrief naar salaris (als <i>Automatisch naar salaris</i> aan staat)</td><td>direct na tekenen</td><td>Mahdia</td></tr>'
      + '<tr><td>Alles wat klaar is naar salaris</td><td>ma + do 09:00</td><td>Mahdia</td></tr>'
      + '<tr><td>Offboarding-checklist starten en afvinken</td><td>bij de brief + dagelijks</td><td>takenlijst</td></tr>'
      + '<tr><td>Controle: mail niet aangekomen</td><td>elk uur 08–22 u</td><td>HR + taak</td></tr>'
      + '<tr><td>Contracten, verlengingen, aanzegtermijn, proeftijd, verzuim</td><td>dagelijks</td><td>takenlijst</td></tr>'
      + '<tr><td>Shiftbase-datacontrole en dossiercontrole</td><td>1e van de maand (aparte mail)</td><td>HR</td></tr>'
      + '<tr><td>Jubilea volgende week</td><td>maandag</td><td>HR</td></tr>'
      + '<tr><td>Winkelmail per winkel</td><td>maandag 07:50</td><td>store manager</td></tr>'
      + '</tbody></table>'
      + '<p><b>Mails aan HR:</b> alle automatische meldingen voor HR komen gebundeld in één <b>HR-weekoverzicht</b> (maandag om 09:00, na de salarisronde van 08:30). Alleen <i>mail niet aangekomen</i> en een lage check-in komen direct.</p>'
      + '<p>Signalen over keukenmedewerkers gaan naar Jop. Automatische mails gaan alleen echt de deur uit als <code>SIGNALERINGEN_ACTIEF=1</code> in Netlify staat; zie ook <b>Signaleringen</b> voor de laatste runs.</p>' },
    { id: 'instroom', titel: 'Instroom: loonheffing en starters', html:
      '<ul><li><b>Loonheffing</b> — nieuwe medewerkers uit Shiftbase krijgen een uitnodiging (NL/EN) met een uploadlink. Automatisch als dat aan staat op de tab Loonheffing; anders staat het als taak klaar.</li>'
      + '<li>Zonder formulier wordt <b>52% loonheffing</b> ingehouden (anoniementarief). Herinneringen gaan vanzelf; na 3 herinneringen krijg je een taak om zelf contact op te nemen.</li>'
      + '<li>Binnen? Dan staat het onder <i>Klaar voor salaris</i> en gaat het op maandag of donderdag naar Mahdia (of klik <b>→ Salaris</b>).</li>'
      + '<li><b>Check-in 30/60</b> — nieuwe medewerkers krijgen na 30 en 60 dagen een korte vragenlijst. Een lage score geeft een taak: even bellen en vastleggen bij Gesprekken.</li>'
      + '<li><b>Onboarding-checklist</b> — start je vanuit het dossier; de scorekaart meet of hij binnen 21 dagen af is.</li>'
      + '<li><b>Shiftbase-templates</b> — per winkel de contracttemplates (nieuw contract en verlenging) als Word-bestand, met de juiste BV, het adres en de huidige huisregels. De huisregels beheer je hier op één plek, ook voor Contract op maat. Na een wijziging: opnieuw downloaden en in Shiftbase vervangen.</li></ul>' },
    { id: 'contract', titel: 'Contracten, verlengen en proeftijd', html:
      '<ul><li>SLA werkt met <b>7 → 12 → 16 maanden</b>. Het dashboard telt de keten zelf; knippen in Shiftbase rond 1 januari, 1 juli of een verjaardag (jeugdloon) tellen niet als nieuw contract.</li>'
      + '<li><b>Contract loopt af</b> (binnen 60 dagen): klik <i>Besluit vastleggen</i> — verlengen tijdelijk, verlengen vast, niet verlengen of zelf opgezegd. Bij een <b>volle keten</b> kan verlengen alleen nog vast.</li>'
      + '<li>Contracten van 6 maanden of langer: de medewerker moet het besluit uiterlijk <b>1 maand voor het einde</b> schriftelijk weten (aanzegtermijn). Te laat = vergoeding.</li>'
      + '<li><b>Advies store manager</b> — komt via de winkelmail binnen en staat in de taak; het is voorgevuld als je het besluit opent. Het besluit blijft bij HR.</li>'
      + '<li><b>Proeftijd</b> — ongeveer 10 dagen voor het einde verschijnt een taak. Adviseert de store manager <i>stoppen</i>, dan wordt de taak rood: de brief moet vóór het einde van de proeftijd bij de medewerker zijn.</li>'
      + '<li>Klopt de keten niet (bijv. een contract dat geen nieuw contract was)? In het dossier kun je het aantal contracten corrigeren.</li></ul>' },
    { id: 'uitstroom', titel: 'Uitstroom: van brief tot salaris', html:
      '<ol><li><b>Brief versturen</b> — Uitstroom → <i>Nieuwe mail + PDF</i>: ontslagbevestiging (NL/EN), aanzegging of proeftijdbrief. De offboarding-checklist start vanzelf.</li>'
      + '<li><b>Tekenen</b> — de medewerker tekent digitaal via de link in de mail (met een code per mail). Geen reactie: herinneringen gaan vanzelf.</li>'
      + '<li><b>Naar salaris</b> — getekend en geen ⚠? Dan gaat het direct naar Mahdia en staat <i>Verwerkt</i> vanzelf aan. Anders staat het onder <i>Klaar voor salaris</i>: klik <b>→ Salaris</b>.</li>'
      + '<li><b>Offboarding afronden</b> — sleutels en kleding, toegang, getuigschrift en exitgesprek vink je zelf af.</li></ol>'
      + '<p><b>⚠ Dossiercontrole:</b> elk lopend dossier wordt vergeleken met Shiftbase (onleesbare datum, einddatum ≠ uitdienstdatum, geen uitdienstdatum, andere BV of e-mail). Muis op de ⚠ voor uitleg. Zo’n dossier gaat niet automatisch naar salaris.</p>'
      + '<p><b>Fout in een dossier?</b> Gebruik <b>✎ Gegevens wijzigen</b>. Een al verstuurde brief verandert niet mee; stuur zo nodig een nieuwe. Een nieuwe brief op dezelfde regel wist de oude ondertekening en herinneringen.</p>'
      + '<p>Lijsten tonen standaard <b>Lopend</b>; afgeronde dossiers staan onder <b>Afgerond</b> en blijven doorzoekbaar.</p>' },
    { id: 'tekenen', titel: 'Digitaal ondertekenen', html:
      '<ul><li>Brieven met een PDF krijgen een persoonlijke tekenlink. De medewerker vraagt een code aan per mail, leest de PDF en tekent (naam + eventueel handtekening).</li>'
      + '<li>Soorten: <i>akkoord</i> (ontslag, overplaatsing, contract op maat), <i>gezien</i> (waarschuwing, beschikbaarheid) en <i>keuze</i> (oproepaanbod: aanvaard of afgewezen, met opmerking).</li>'
      + '<li>De medewerker krijgt daarna zelf de volledig getekende PDF. Elk tabblad toont onderaan (bij Ontslag bovenaan) een blok <b>Digitaal ondertekenen</b> met alleen zijn eigen documenten: ontslag bij Ontslag &amp; aanzegging, contracten bij Contract op maat, enz.; <b>Intrekken</b> maakt een link ongeldig.</li>'
      + '<li>Links verlopen na 60 dagen. Nieuwe link nodig? ⋯ → 🔗 Uploadlink.</li></ul>' },
    { id: 'winkelmail', titel: 'Winkelmail voor store managers', html:
      '<p>Elke maandag 07:50 krijgt elke winkel een mail met wat er speelt. Een winkel zonder iets te melden krijgt niets. Keuken gaat naar Jop.</p>'
      + '<table class="help-tab"><thead><tr><th>Blok</th><th>Wat de store manager doet</th></tr></thead><tbody>'
      + '<tr><td>Wacht op de medewerker</td><td>aanspreken op de vloer</td></tr>'
      + '<tr><td>Contracten die aflopen (8 weken, geen besluit)</td><td>advies geven via de knop</td></tr>'
      + '<tr><td>Proeftijd loopt af (17 dagen)</td><td>advies geven via de knop</td></tr>'
      + '<tr><td>Nieuwe medewerkers / welkomstcollectie Academy</td><td>inwerken, buddy</td></tr>'
      + '<tr><td>Vertrek deze en volgende week</td><td>sleutels en kleding innemen</td></tr>'
      + '<tr><td>Jubilea en verjaardagen</td><td>aandacht geven; t/m 21 jaar uurloon in Shiftbase verhogen (bedrag CAO Horeca staat erbij)</td></tr>'
      + '<tr><td>Cijfers</td><td>ter info</td></tr></tbody></table>'
      + '<p>Niet in de mail: verzuim per persoon, check-in-antwoorden, exit-redenen, inhoud van brieven. Instellen via <b>Beheer → Winkelmail store managers</b> (adres per winkel, <i>Voorbeeld</i>, <i>Proef naar mij</i>, proefstand).</p>' },
    { id: 'verzuim', titel: 'Verzuim en gesprekken', html:
      '<ul><li>Verzuim komt uit Shiftbase (goedgekeurde ziekmeldingen). Meldingen binnen 4 weken tellen als één periode (Wet verbetering poortwachter).</li>'
      + '<li>Taken bij de <b>poortwachter-mijlpalen</b> (dag 42, 56, 294, 364) en bij <b>frequent verzuim</b> (3+ meldingen in 12 maanden).</li>'
      + '<li>Gesprekken leg je vast bij <b>Dossier → Gesprekken</b>. Bij een verzuimgesprek kies je uit vaste velden: <b>nooit medische informatie</b> (diagnose, klachten, oorzaak) vastleggen — dat is voor de bedrijfsarts.</li></ul>' },
    { id: 'meldingen', titel: 'Meldingen en wat je dan doet', html:
      '<table class="help-tab"><thead><tr><th>Melding</th><th>Wat je doet</th></tr></thead><tbody>'
      + '<tr><td>Mail niet aangekomen</td><td>E-mailadres controleren (Shiftbase en ✎ Gegevens wijzigen), opnieuw versturen, taak afhandelen.</td></tr>'
      + '<tr><td>⚠ bij een dossier</td><td>De afwijking corrigeren in het dossier of in Shiftbase.</td></tr>'
      + '<tr><td>Kon niet automatisch naar salaris</td><td>Document staat nog in Google Drive of de controle vond iets: handmatig met → Salaris.</td></tr>'
      + '<tr><td>Keten vol</td><td>Verlengen kan alleen nog met een vast contract.</td></tr>'
      + '<tr><td>Frequent verzuim / poortwachter</td><td>Gesprek of stap uitvoeren en vastleggen.</td></tr>'
      + '<tr><td>Shiftbase-datacontrole</td><td>Uitdienstdatum, contract, geboortedatum of e-mail aanpassen in Shiftbase.</td></tr>'
      + '<tr><td>CAO-jeugdlonen verouderd</td><td>Mischa vragen de nieuwe loontabel in te vullen (elk half jaar).</td></tr>'
      + '</tbody></table>' },
    { id: 'cijfers', titel: 'Scorekaart en cijfers', html:
      '<p>De <b>Scorekaart</b> zet elke winkel naast het SLA-gemiddelde over 3, 6 of 12 maanden. <span class="badge br">rood</span> = duidelijk slechter, <span class="badge bo">oranje</span> = iets slechter, grijs = te weinig gegevens.</p>'
      + '<ul><li>Uitstroom: verloop, vertrek binnen 90 dagen, eNPS exit, aanzegging op tijd.</li><li>Instroom: uitval ≤ 90 dagen, check-in, onboarding op tijd.</li><li>In dienst: verzuim, meldingsfrequentie, frequent verzuim, verzuimgesprek ≤ 30 d.</li><li>Training: welkomstcollectie en certificaten (Academy).</li><li>Dossiers: loonheffing ≤ 7 d, getekend na.</li></ul>'
      + '<p>Klik een winkel aan voor details en een <b>PDF voor het overleg</b>. Onder Instroom/Uitstroom vind je ook de <b>Verloopanalyse</b>, <b>Vroeg vertrek</b>, <b>Kosten van verloop</b> en het <b>maandrapport</b>.</p>' },
    { id: 'privacy', titel: 'Privacy (AVG)', html:
      '<ul><li>Leg alleen vast wat nodig is; nooit medische informatie, ook niet in notities of gesprekken.</li>'
      + '<li>Alles wat je doet wordt gelogd (Beheer → Toegangslog en het actielog per dossier).</li>'
      + '<li><b>Beheer → Bewaartermijnen</b>: oud-medewerkers voorbij de wettelijke termijn (dossier 2 jaar, loonheffing/kopie ID 5 jaar) kan een beheerder opschonen.</li>'
      + '<li>De winkelmail bevat persoonsgegevens: store managers mogen hem niet doorsturen.</li></ul>' },
    { id: 'handwerk', titel: 'Wat blijft handwerk', html:
      '<ul><li>Het <b>besluit</b> over verlengen, proeftijd en ontslag (de store manager adviseert alleen).</li>'
      + '<li><b>Gesprekken</b> voeren en vastleggen.</li>'
      + '<li>Offboarding: verlof en plus-min-uren, sleutels en kleding, toegang intrekken, getuigschrift, exitgesprek.</li>'
      + '<li><b>Shiftbase</b> bijwerken: contracten, uitdienstdatum, functie, team, geboortedatum.</li>'
      + '<li>Vrije brieven, waarschuwingen en sommaties opstellen.</li></ul>' }
  ],
  faq: [
    { v: 'Ik heb iets afgehandeld, maar de taak staat er nog. Hoe kan dat?', a: 'De takenlijst toont de stand van de controles van vanochtend. Klik <b>Verse stand</b>: de controles draaien opnieuw en de nieuwe stand blijft bewaard. Staat het er dan nog, kies onder ⋯ een afhandel-optie.' },
    { v: 'Waarom ging een getekend dossier niet automatisch naar salaris?', a: 'Dan staat er een ⚠ bij (de dossiercontrole vond een afwijking met Shiftbase), het document staat nog in Google Drive, het dossier is van vóór 1 oktober 2026 of <i>Automatisch naar salaris</i> staat uit. Los de ⚠ op en klik <b>→ Salaris</b>.' },
    { v: 'Er staat een verkeerde datum of BV in een ontslagdossier. Hoe pas ik dat aan?', a: 'Uitstroom → bij de regel <b>✎ Gegevens wijzigen</b>. Is de brief al verstuurd met de foute gegevens, stuur dan een nieuwe brief op dezelfde regel; de oude ondertekening vervalt dan.' },
    { v: 'De medewerker zegt dat de mail niet is aangekomen.', a: 'Kijk eerst of er een taak <i>Mail niet aangekomen</i> staat. Controleer het e-mailadres in Shiftbase en in het dossier, laat ook de spammap checken en verstuur opnieuw. Een nieuwe uploadlink maak je via ⋯ → 🔗 Uploadlink.' },
    { v: 'Hoe telt het dashboard het aantal contracten (de keten)?', a: 'Shiftbase knipt een contract op bij een loonwijziging (1 januari, 1 juli, verjaardag). Die knippen telt het dashboard niet als nieuw contract. Alleen een nieuwe afspraak met een andere looptijd telt. Klopt het toch niet, corrigeer het aantal in het dossier.' },
    { v: 'Bij een taak staat een besluit dat ik niet herken. Wie heeft dat vastgelegd?', a: 'Achter het besluit staat wie het vastlegde en wanneer, bijv. “(Mischa, 22-10)”. Alle besluiten staan ook in Beheer → Toegangslog (actie <i>verlenging-besluit</i>). Klopt het niet: open de taak, ⋯ → <i>Besluit wijzigen</i> → <i>Besluit intrekken</i>.' },
    { v: 'Wat doet de store manager precies met de adviesknop?', a: 'Hij of zij opent zonder inlog een pagina en kiest verlengen / niet verlengen / twijfel (of bij de proeftijd: doorgaan / stoppen / twijfel), met een korte toelichting. Het advies staat daarna in de taak. Het besluit blijft bij HR.' },
    { v: 'Er staat een fout in een verstuurd contract op maat (bijv. het IBAN). Hoe pas ik dat aan?', a: 'Instroom → <b>Contract op maat</b> → bij Verstuurde contracten op <b>Opnieuw gebruiken</b> klikken. Het contract komt terug in het formulier; vul BSN en IBAN opnieuw in (die staan niet in het logboek), verbeter de fout en klik <b>Verstuur ter ondertekening</b>. De oude ondertekenlink vervalt dan vanzelf. Al ondertekend? Dan is een nieuw contract alleen nodig als de afspraken veranderen; een ander IBAN geef je door aan de salarisadministratie.' },
    { v: 'Een huisregel is veranderd. Hoe komt dat in alle contracten?', a: 'Instroom → <b>Shiftbase-templates</b>: pas de regel aan onder Huisregels en klik Opslaan. Download daarna per winkel de zip en vervang de templates in Shiftbase. Contract op maat gebruikt de nieuwe lijst meteen. Al getekende contracten veranderen niet mee.' },
    { v: 'Hoe zet ik de winkelmail aan voor een winkel?', a: 'Beheer → Winkelmail store managers: vul het mailadres van het winkelaccount in, vink <i>meesturen</i> aan, zet <i>Winkelmail aan</i> en haal de proefstand eraf. Met <i>Voorbeeld</i> zie je eerst wat de winkel zou krijgen.' },
    { v: 'Waarom staat een medewerker van Groningen, Haarlem of Amersfoort er niet in?', a: 'Dat zijn franchisewinkels; die horen bewust niet in het HR Dashboard.' },
    { v: 'Waarom krijgt Jop andere meldingen dan wij?', a: 'De keuken valt onder Jop. Alle signalen over keukenmedewerkers gaan naar hem, niet naar HR. Met de keukenrol ziet hij alleen de takenlijst.' },
    { v: 'Een store manager heeft volgens het dashboard een all-in loon. Klopt dat?', a: 'Nee: leidinggevenden (store manager, OPS) en de keuken hebben geen all-in loon maar losse vakantiedagen. Staat de functie in Shiftbase verkeerd, pas die daar aan. Bij een ontslagbrief kun je <i>Geen all-in</i> ook zelf aanvinken.' },
    { v: 'Wanneer moet een aanzegging uiterlijk de deur uit?', a: 'Bij een contract van 6 maanden of langer moet de medewerker uiterlijk <b>1 maand voor de einddatum</b> schriftelijk weten of het contract wordt verlengd. Het dashboard rekent die datum uit en kleurt de taak rood als het krap wordt.' },
    { v: 'Wat als een jonge medewerker jarig is?', a: 'Tot en met 21 jaar stijgt het minimum-uurloon op de verjaardag. De winkelmail meldt het de store manager met het bedrag volgens de CAO Horeca; die past het uurloon in Shiftbase aan. HR krijgt ook een melding via de jeugd-check.' },
    { v: 'Hoe weet ik wat er nieuw is in het dashboard?', a: 'Na een update staat er een groene stip bij <b>Help</b>. Onder <b>Wat is er nieuw</b> staat per versie wat er veranderd is. Je kunt ook op het versienummer bovenaan klikken.' },
    { v: 'Kan ik het dashboard als app op mijn telefoon zetten?', a: 'Ja: open het in de browser en kies <i>Zet op beginscherm</i> (iPhone: deelknop; Android/Chrome: menu ⋮). Het opent dan als app “SLA HR”.' },
    { v: 'Iets werkt niet of klopt niet. Bij wie meld ik dat?', a: 'Bij Mischa, met een screenshot en de naam van de medewerker. Het versienummer staat rechtsboven en onderaan de pagina.' }
  ]
};
