# Zo werkt de HR-mail opruimer

4 november 2026 · Mischa Kamstra

## Waarom

Het script houdt de inbox van hr@ilovesla.com bij: het sorteert, ruimt ruis op en laat zien waar nog een antwoord nodig is. Er stonden op 4 november **2.162 gesprekken** in de inbox, waarvan 126 ongelezen. Daardoor raakten echte vragen van medewerkers en winkels ondergesneeuwd.

- **30% is ruis die niemand leest:** 643 periodeverslagen van HRM Online, waarvan 69 ongelezen.
- **Sinds oktober komen er bijna 3 sollicitaties per dag binnen** via werkenbij.
- **Belangrijke mail raakt uit beeld:** in 2026 al 74 ontslagmails en 68 aanvragen voor nieuwe medewerkers van winkels.

## Wat je gaat zien

Links in Gmail verschijnen twee nieuwe labels bovenaan en een map **Auto** met sublabels. Je eigen labels (1.0 Opvolgen, 6. Bewaren, Loonopdracht enzovoort) blijven gewoon bestaan.

| Label | Betekenis |
| --- | --- |
| **Actie nodig** | Het laatste bericht is van iemand anders: wij moeten nog antwoorden. Verdwijnt vanzelf zodra hr@ heeft geantwoord. |
| **Wacht op antwoord** | Wij hebben als laatste gemaild en hebben al 3 dagen niets gehoord. Tijd om na te bellen of te herinneren. |
| Auto/Instroom/… | Nieuwe medewerker, Contract, Loonheffing |
| Auto/In dienst/… | Verlof, Ziek |
| Auto/Uitstroom/Ontslag | Opzeggingen en ontslagmails |
| Auto/Salaris/… | Periodeverslagen, Loonstroken, HRM Online, Vragen medewerkers |
| Auto/Werving/… | Sollicitaties, Reacties kandidaat |
| Auto/Overheid | UWV en Belastingdienst |
| Auto/Systeem, Auto/Ruis/… | Systeemmeldingen, afwezigheidsberichten, onbestelbare mail |
| Auto/Opgeruimd (oud) | Gelezen mail ouder dan 60 dagen die uit de inbox is gehaald |

## Wat er automatisch gebeurt

Elke 15 minuten krijgt nieuwe mail een label. Wat ruis is, gaat na een vaste termijn gelezen uit de inbox. Elke ochtend rond 07:00 worden *Actie nodig* en *Wacht op antwoord* bijgewerkt.

| Soort mail | Label | Wat het script doet |
| --- | --- | --- |
| Periodeverslagen HRM Online | Salaris/Periodeverslagen | Na 2 dagen gelezen + uit de inbox |
| Kopie loonstroken (contracten@) | Salaris/Loonstroken | Meteen gelezen + uit de inbox |
| Afwezigheidsberichten | Ruis/Afwezig | Meteen gelezen + uit de inbox |
| Systeemmeldingen (Google, Exact, Uber, Apprendo, Drive) | Systeem | Na 3 dagen gelezen + uit de inbox |
| Nieuwe sollicitatie (werkenbij) | Werving/Sollicitaties | Na 7 dagen gelezen + uit de inbox |
| Reactie van een kandidaat | Werving/Reacties kandidaat | Blijft staan, telt mee voor Actie nodig |
| Ontslag, nieuwe medewerker, contract, loonheffing, salarisvragen, verlof, ziek, UWV | eigen label (zie hierboven) | Blijft staan, telt mee voor Actie nodig |
| Onbestelbare mail | Ruis/Bounces | Blijft staan: het mailadres van iemand klopt niet |
| Overige mail van HRM Online | Salaris/HRM Online | Blijft staan, telt mee voor Actie nodig |
| Alle gelezen mail ouder dan 60 dagen | Opgeruimd (oud) | Uit de inbox, behalve als er Actie nodig op staat |

Uit de inbox betekent gearchiveerd: de mail staat nog in *Alle berichten* en onder het label.

## Wat het script nooit doet

- **Nooit verwijderen.** Het script labelt, markeert als gelezen en archiveert. Niets gaat naar de prullenbak.
- **Nooit mail van collega's of winkels opruimen.** Mail van een @ilovesla.com-adres krijgt alleen een label. De uitzondering zijn de systeemadressen werkenbij@ en contracten@.
- **Nooit jullie eigen labels aanraken.** Mail met een ster, of met een label als 1.0 Opvolgen, 5. Wachten op.., 6. Bewaren, Loonopdracht, Loonaangifte of Ontslagformulier, blijft in de inbox.
- **Nooit iets versturen.** Het script mailt niemand en beantwoordt niets.
- **Eerst een proefrun.** In de proefstand verandert er niets; je ziet in het logboek-sheet *HR-mail opruimen – logboek* (in de Drive van hr@) wat er zou gebeuren.

## Zo werk je ermee

1. Begin de dag met het label **Actie nodig**. Daar staat alles wat nog een antwoord van HR nodig heeft, nieuwste bovenaan.
2. Beantwoord vanuit hr@. Het label verdwijnt de volgende ochtend vanzelf.
3. Kijk één keer per dag bij **Wacht op antwoord**: wie herinner je of bel je na?
4. Zoek je iets dat al uit de inbox is? Klik op het label onder Auto, of zoek gewoon in Gmail.
5. Wil je dat een mail blijft staan? Geef hem een ster of een van jullie eigen labels.

## Veelgestelde vragen

**Ik mis een mail, waar is hij?** Kijk onder het label in de map Auto, of in *Alle berichten*. Er wordt nooit iets verwijderd.

**Een mail kreeg het verkeerde label.** De indeling gaat op afzender en woorden in het onderwerp. Haal het label gewoon weg of zet het goede erop. Gebeurt het vaker, meld het bij Mischa, dan wordt de regel aangepast.

**Hoe snel krijgt nieuwe mail een label?** Binnen 15 minuten. *Actie nodig* en *Wacht op antwoord* worden één keer per dag bijgewerkt, rond 07:00.

**Kan ik een mail in de inbox houden?** Ja: geef hem een ster of een van jullie eigen labels (1.0 Opvolgen, 6. Bewaren enzovoort).

**Wie beheert het script?** Mischa. Het draait in Google Apps Script onder het hr@-account. Aanpassingen of vragen gaan via hem.
