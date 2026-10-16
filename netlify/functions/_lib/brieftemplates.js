// ============================================================
// Brief-PDF's voor ontslag & aanzegging — tekst 1-op-1 overgenomen uit de
// Google Docs-templates (16-10-2026):
//   "Template Ontslagbrief Sla", "Aanzeggingsbrief_template", "Aanzeggingsbrief_template_EN"
// Opmaak: **vet**, *cursief*, "• " = opsomming, lege regel = nieuwe alinea.
// Placeholders: {{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}
// Wijzigen van de brieftekst = dit bestand aanpassen (Mischa's keuze: volledig in code).
// ============================================================
const { AFZENDER_NAAM } = require('./config');
const fs = require('fs');
const path = require('path');
// Handtekening (i.o. = in opdracht) voor de ontslagbevestiging; PNG met transparante achtergrond.
// Ontbreekt het bestand, dan blijft alleen de stippellijn staan.
function handtekening() {
  try { return fs.readFileSync(path.join(__dirname, 'assets', 'handtekening_io_jop.png')); } catch (e) { return null; }
}

const ONTSLAG = `**BEVESTIGING OPZEGGING DIENSTVERBAND {{BV}}**

**Amsterdam, {{HuidigeDatum}}**

**{{Naam}}**
**{{Adres}}**

**Beste {{Naam}},**

Hierbij bevestigen wij dat je op {{DatumOpzegging}} jouw arbeidsovereenkomst hebt opgezegd per {{Einddatum}}.

De laatste dag van je arbeidsovereenkomst is dus {{Einddatum}}. Uiterlijk deze dag lever je jouw eventuele sleutels in. De eindafrekening van salaris, eventueel niet genoten vrije dagen en vakantiegeld zal na afloop van jouw laatste maand plaatsvinden.

Wij wensen je veel succes met je verdere toekomstplannen!

Met vriendelijke groet,


**{{BV}}**
{{HANDTEKENING}}
................................................
i.o. ${AFZENDER_NAAM}


**De werknemer**
{{Naam}}

................................................`;

const AANZEGGING_NL = `{{Naam}}
{{Adres}}

Amsterdam, {{HuidigeDatum}}

**Betreft: Aanzegging einde arbeidsovereenkomst voor bepaalde tijd**

Beste {{Naam}},

Met deze brief informeren wij je formeel dat jouw arbeidsovereenkomst voor bepaalde tijd met **{{BV}}** op **{{Einddatum}}** van rechtswege eindigt. De overeenkomst wordt na deze datum **niet verlengd**.

Hiermee voldoen wij aan de wettelijke aanzegplicht zoals vastgelegd in artikel 7:668 van het Burgerlijk Wetboek, die voorschrijft dat de werkgever uiterlijk één maand voor het einde van een arbeidsovereenkomst voor bepaalde tijd van zes maanden of langer schriftelijk laat weten of de overeenkomst wordt voortgezet.

Deze beslissing is genomen op basis van bedrijfseconomische en/of organisatorische overwegingen en staat los van jouw functioneren persoonlijk. We waarderen jouw inzet gedurende de afgelopen periode.

**Verwachtingen tot de einddatum**

Tot **{{Einddatum}}** blijf je gewoon in dienst bij **{{BV}}** onder de voorwaarden zoals vastgelegd in jouw arbeidsovereenkomst. Concreet betekent dit:

• Je vervult jouw werkzaamheden zoals gebruikelijk en volgens het overeengekomen rooster.
• Je werkt jouw lopende taken en verantwoordelijkheden netjes af en zorgt voor een zorgvuldige overdracht aan jouw collega's en leidinggevende.
• Eventuele resterende vakantie-uren stem je tijdig af met jouw leidinggevende; niet opgenomen uren worden bij de eindafrekening uitbetaald.
• Je gedraagt je tot de laatste werkdag als een goed werknemer in de zin van artikel 7:611 BW.

**Eindafrekening**

Na jouw laatste werkdag ontvang je een eindafrekening met daarin het loon over de laatste periode, de uitbetaling van niet-opgenomen vakantie-uren en het opgebouwde vakantiegeld. De eindafrekening wordt uiterlijk bij de eerstvolgende loonbetaling na het einde van het dienstverband voldaan.

**Inleveren bedrijfseigendommen**

Wij verzoeken je om uiterlijk op jouw laatste werkdag alle bedrijfseigendommen in te leveren bij jouw Store Manager. Hieronder vallen onder andere werkkleding, sleutels, toegangspassen en eventuele andere bedrijfsmiddelen die aan jou ter beschikking zijn gesteld.

**WW-uitkering**

Voor informatie over een eventuele WW-uitkering verwijzen wij je naar het UWV. Het advies is om uiterlijk één week na jouw laatste werkdag een uitkering aan te vragen via werk.nl. Een afschrift van deze brief kun je gebruiken als bewijsstuk.

**Exitgesprek**

We waarderen jouw eerlijke feedback. Voor het einde van jouw dienstverband nodigen we je graag uit voor een kort exitgesprek waarin we jouw ervaringen bespreken. Jouw leidinggevende neemt hierover contact met je op.

Mocht je vragen hebben over deze brief of de afhandeling van het dienstverband, neem dan gerust contact op via hr@ilovesla.com.

We wensen je veel succes in jouw verdere loopbaan.

Met vriendelijke groet,

**${AFZENDER_NAAM}**
SLA HR Team
{{BV}}

*Deze brief is opgesteld conform de aanzegplicht (art. 7:668 BW).*



Voor ontvangst getekend:  ____________________________     Datum:  ____________`;

const AANZEGGING_EN = `{{Naam}}
{{Adres}}

Amsterdam, {{HuidigeDatum}}

**Subject: Notice of non-renewal of fixed-term employment agreement**

Dear {{Naam}},

By means of this letter we formally inform you that your fixed-term employment agreement with **{{BV}}** will end by operation of law on **{{Einddatum}}**. The agreement **will not be renewed** after this date.

With this letter we comply with the statutory notification obligation set out in Article 7:668 of the Dutch Civil Code, which requires the employer to inform the employee in writing, at least one month before the end of a fixed-term employment agreement of six months or longer, whether or not the agreement will be continued.

This decision has been made on the basis of business and/or organisational considerations and is not a reflection on your personal performance. We appreciate your contribution over the past period.

**Expectations until the end date**

Until **{{Einddatum}}** you remain employed by **{{BV}}** under the conditions set out in your employment agreement. In practical terms this means:

• You will continue to perform your duties as usual and according to the agreed schedule.
• You will complete your ongoing tasks and responsibilities properly and ensure a careful handover to your colleagues and supervisor.
• Any remaining holiday hours should be discussed in advance with your supervisor; unused hours will be paid out in the final settlement.
• Until your last working day you will conduct yourself as a good employee within the meaning of Article 7:611 of the Dutch Civil Code.

**Final settlement**

After your last working day you will receive a final settlement covering the salary for the final period, payment of unused holiday hours and accrued holiday allowance. The final settlement will be paid no later than at the next regular payroll run following the end of your employment.

**Returning company property**

We kindly request that you return all company property to your Store Manager no later than your last working day. This includes work clothing, keys, access passes and any other items made available to you by the company.

**Unemployment benefit (WW)**

For information about a possible unemployment benefit (WW-uitkering) we refer you to the UWV. We recommend applying for the benefit no later than one week after your last working day via werk.nl. A copy of this letter can be used as supporting evidence. Please note that UWV communication is primarily in Dutch.

**Exit interview**

We value your honest feedback. Before the end of your employment we would like to invite you for a brief exit interview to discuss your experiences. Your Operations manager will contact you about this.

Should you have any questions about this letter or the handling of your employment, please feel free to contact us at hr@ilovesla.com.

We wish you every success in your future career.

Kind regards,

**${AFZENDER_NAAM}**
SLA HR Team
{{BV}}

*This letter has been drafted in accordance with the statutory notification obligation (Article 7:668 of the Dutch Civil Code).*



Signed for receipt:  ____________________________     Date:  ____________`;

function vul(sjabloon, v) {
  let s = sjabloon;
  Object.keys(v).forEach(k => { s = s.split(k).join(String(v[k] == null ? '' : v[k])); });
  // lege (vetgedrukte) adresregel weghalen als er geen adres is
  return s.split('\n').filter(r => r.trim() !== '****').join('\n');
}

// --- Overplaatsing / standplaatswijziging (Docs-templates Overplaatsing_NL/EN, Standplaatswijziging_NL/EN) ---
// Placeholders: {{Naam}} {{HuidigeBV}} {{NieuweBV}} {{DatumIndiensttreding}} {{IngangsdatumOverplaatsing}}
//               {{Functie}} {{HuidigeStandplaats}} {{Standplaats}} {{HuidigeDatum}}
const OVERPL_NL = `{{HuidigeBV}}
{{HuidigeDatum}}

**Betreft: bevestiging interne overplaatsing met behoud van dienstjaren**

Beste {{Naam}},

In navolging op onze gesprekken bevestigen wij hierbij jouw overplaatsing binnen de SLA-groep.

Per {{IngangsdatumOverplaatsing}} word je formeel overgedragen van {{HuidigeBV}} naar {{NieuweBV}}. Dit gebeurt via contractsoverneming op grond van artikel 6:159 BW. Concreet betekent dit dat al jouw rechten en plichten uit de huidige arbeidsovereenkomst integraal overgaan naar {{NieuweBV}}, zonder onderbreking van je dienstverband.

Concreet houdt dit het volgende in:

- Jouw oorspronkelijke datum indiensttreding ({{DatumIndiensttreding}}) blijft leidend voor de berekening van dienstjaren, vakantiedagen, transitievergoeding en alle overige aanspraken op basis van anciënniteit.
- Jouw functie blijft: {{Functie}}.
- Jouw nieuwe standplaats wordt: {{Standplaats}}.
- Jouw arbeidsvoorwaarden (salaris, contracturen, contracttype, opgebouwde vakantiedagen en overige toezeggingen) blijven ongewijzigd.
- De ketenregeling en eventuele lopende termijnen lopen door alsof er geen werkgeverswissel heeft plaatsgevonden.

Voor de goede orde merken wij op dat contractsoverneming alleen rechtsgeldig is wanneer alle drie de partijen - jij, {{HuidigeBV}} en {{NieuweBV}} - hiermee schriftelijk akkoord gaan. Wij vragen je daarom dit document te ondertekenen voor akkoord en te uploaden via de link in de begeleidende e-mail.

Heb je vragen over deze overplaatsing of de gevolgen daarvan, neem dan gerust contact op via hr@ilovesla.com.

Met vriendelijke groet,

Namens {{HuidigeBV}} en {{NieuweBV}}
SLA HR Team



**Voor akkoord met de overplaatsing en de contractsoverneming zoals hierboven beschreven:**

Naam: {{Naam}}

Datum: _______________________

Handtekening: _______________________`;

const OVERPL_EN = `{{HuidigeBV}}
{{HuidigeDatum}}

**Subject: confirmation of internal transfer with retention of years of service**

Dear {{Naam}},

Following our conversations, we hereby confirm your transfer within the SLA group.

As of {{IngangsdatumOverplaatsing}}, you will be formally transferred from {{HuidigeBV}} to {{NieuweBV}}. This takes place by way of contract assumption pursuant to article 6:159 of the Dutch Civil Code. In practice, this means that all rights and obligations under your current employment contract transfer in full to {{NieuweBV}}, without any interruption of your employment.

Specifically, this means the following:

- Your original start date ({{DatumIndiensttreding}}) remains the basis for calculating years of service, holiday entitlement, transition payment and any other entitlements based on seniority.
- Your position remains: {{Functie}}.
- Your new place of work will be: {{Standplaats}}.
- Your employment conditions (salary, contracted hours, contract type, accrued holiday days and any other commitments) remain unchanged.
- The chain rule and any ongoing terms continue as if no change of employer had taken place.

For the sake of clarity, contract assumption is only legally valid when all three parties - you, {{HuidigeBV}} and {{NieuweBV}} - agree to it in writing. We therefore ask you to sign this document for approval and upload it via the link in the accompanying email.

If you have any questions about this transfer or its implications, please feel free to contact us at hr@ilovesla.com.

Kind regards,

On behalf of {{HuidigeBV}} and {{NieuweBV}}
SLA HR Team



**I agree to the transfer and contract assumption as described above:**

Name: {{Naam}}

Date: _______________________

Signature: _______________________`;

const STANDPL_NL = `{{HuidigeBV}}
{{HuidigeDatum}}

**Betreft: bevestiging wijziging standplaats**

Beste {{Naam}},

In navolging op onze gesprekken bevestigen wij hierbij de wijziging van jouw standplaats binnen {{HuidigeBV}}.

Per {{IngangsdatumOverplaatsing}} wijzigt jouw werklocatie van {{HuidigeStandplaats}} naar {{Standplaats}}. Je blijft in dienst bij {{HuidigeBV}}, jouw arbeidsovereenkomst loopt ongewijzigd door en er is dus geen sprake van een nieuwe werkgever of een nieuw dienstverband.

Concreet houdt dit het volgende in:

- Jouw datum indiensttreding ({{DatumIndiensttreding}}) en alle daaraan verbonden aanspraken (dienstjaren, vakantiedagen, anciënniteit, ketenregeling) blijven volledig in stand.
- Jouw functie blijft: {{Functie}}.
- Jouw nieuwe standplaats wordt: {{Standplaats}}.
- Jouw arbeidsvoorwaarden (salaris, contracturen, contracttype, opgebouwde vakantiedagen en overige toezeggingen) blijven ongewijzigd.
- De wijziging betreft uitsluitend de fysieke werkplek; alle overige afspraken uit jouw arbeidsovereenkomst blijven onverkort van kracht.

Op grond van artikel 7:613 BW respectievelijk de wijzigingsclausule in jouw arbeidsovereenkomst vragen wij je deze standplaatswijziging schriftelijk te bevestigen. Wij verzoeken je dit document te ondertekenen voor akkoord en te uploaden via de link in de begeleidende e-mail.

Heb je vragen over deze wijziging, neem dan gerust contact op via hr@ilovesla.com.

Met vriendelijke groet,

Namens {{HuidigeBV}}
SLA HR Team



**Voor akkoord met de wijziging van standplaats zoals hierboven beschreven:**

Naam: {{Naam}}

Datum: _______________________

Handtekening: _______________________`;

const STANDPL_EN = `{{HuidigeBV}}
{{HuidigeDatum}}

**Subject: confirmation of change of place of work**

Dear {{Naam}},

Following our conversations, we hereby confirm the change of your place of work within {{HuidigeBV}}.

As of {{IngangsdatumOverplaatsing}}, your place of work will change from {{HuidigeStandplaats}} to {{Standplaats}}. You will remain employed by {{HuidigeBV}}, your employment contract continues unchanged, and there is no new employer or new employment relationship.

Specifically, this means the following:

- Your start date ({{DatumIndiensttreding}}) and all related entitlements (years of service, holiday entitlement, seniority, chain rule) remain fully in place.
- Your position remains: {{Functie}}.
- Your new place of work will be: {{Standplaats}}.
- Your employment conditions (salary, contracted hours, contract type, accrued holiday days and any other commitments) remain unchanged.
- This change concerns only the physical place of work; all other agreements in your employment contract remain fully in force.

Pursuant to article 7:613 of the Dutch Civil Code and the modification clause in your employment contract, we ask you to confirm this change of workplace in writing. We kindly request that you sign this document for approval and upload it via the link in the accompanying email.

If you have any questions about this change, please feel free to contact us at hr@ilovesla.com.

Kind regards,

On behalf of {{HuidigeBV}}
SLA HR Team



**I agree to the change of place of work as described above:**

Name: {{Naam}}

Date: _______________________

Signature: _______________________`;

// --- Proeftijd (Docs-templates PROEFTIJD_WG_NL/EN, PROEFTIJD_WN_NL/EN; Proeftijd.gs v1) ---
// Placeholders: {{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}
const PROEFTIJD_WG_NL = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Betreft: Beëindiging arbeidsovereenkomst tijdens de proeftijd**

Beste {{Naam}},

Hierbij bevestigen wij dat {{BV}} de arbeidsovereenkomst met jou op {{DatumOpzegging}} tijdens de proeftijd heeft beëindigd, op grond van het proeftijdbeding in jouw arbeidsovereenkomst (artikel 7:652 juncto 7:676 van het Burgerlijk Wetboek).

Jouw dienstverband eindigt per {{Einddatum}}. Op grond van artikel 7:676 BW geldt tijdens de proeftijd geen opzegtermijn.

**Reden van beëindiging**
Op jouw verzoek geven wij de reden van de beëindiging schriftelijk op (artikel 7:676 lid 2 BW). Je kunt hiervoor contact opnemen via hr@ilovesla.com.

**Eindafrekening**
Bij de eerstvolgende salarisverwerking ontvang je de eindafrekening, waarin het resterende salaris, opgebouwd vakantiegeld en eventuele niet-genoten vakantiedagen worden verrekend.

**Bedrijfseigendommen**
Wij verzoeken je uiterlijk op jouw laatste werkdag alle bedrijfseigendommen (waaronder kleding, sleutels en pasjes) in te leveren bij jouw Store Manager.

Wij verzoeken je deze brief voor ontvangst te ondertekenen en te uploaden via de link in de begeleidende e-mail.

Met vriendelijke groet,

${AFZENDER_NAAM}
{{BV}}



**Voor ontvangst ondertekend:**

Naam: {{Naam}}

Datum: _______________________

Handtekening: _______________________`;

const PROEFTIJD_WG_EN = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Subject: Termination of employment agreement during the probationary period**

Dear {{Naam}},

We hereby confirm that {{BV}} terminated your employment agreement on {{DatumOpzegging}} during the probationary period, based on the probationary clause in your employment agreement (Article 7:652 in conjunction with Article 7:676 of the Dutch Civil Code).

Your employment ends on {{Einddatum}}. Pursuant to Article 7:676 of the Dutch Civil Code, no notice period applies during the probationary period.

**Reason for termination**
Upon your request, we will provide the reason for the termination in writing (Article 7:676 paragraph 2 of the Dutch Civil Code). You can contact us at hr@ilovesla.com.

**Final settlement**
With the next payroll run you will receive the final settlement, in which your remaining salary, accrued holiday allowance and any untaken holiday days will be settled.

**Company property**
We kindly request that you return all company property (including clothing, keys and passes) to your Store Manager no later than your last working day.

Please sign this letter for receipt and upload it via the link in the accompanying email.

Kind regards,

${AFZENDER_NAAM}
{{BV}}



**Signed for receipt:**

Name: {{Naam}}

Date: _______________________

Signature: _______________________`;

const PROEFTIJD_WN_NL = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Betreft: Bevestiging van jouw opzegging tijdens de proeftijd**

Beste {{Naam}},

Hierbij bevestigen wij de ontvangst van jouw opzegging op {{DatumOpzegging}}, waarmee je de arbeidsovereenkomst met {{BV}} tijdens de proeftijd hebt beëindigd (artikel 7:652 juncto 7:676 van het Burgerlijk Wetboek).

Jouw dienstverband eindigt daarmee per {{Einddatum}}. Op grond van artikel 7:676 BW geldt tijdens de proeftijd geen opzegtermijn.

**Eindafrekening**
Bij de eerstvolgende salarisverwerking ontvang je de eindafrekening, waarin het resterende salaris, opgebouwd vakantiegeld en eventuele niet-genoten vakantiedagen worden verrekend.

**Bedrijfseigendommen**
Wij verzoeken je uiterlijk op jouw laatste werkdag alle bedrijfseigendommen (waaronder kleding, sleutels en pasjes) in te leveren bij jouw Store Manager.

Met het ondertekenen van deze brief bevestig je dat je zelf, uit vrije wil en ondubbelzinnig, de arbeidsovereenkomst tijdens de proeftijd hebt opgezegd.

Wij verzoeken je deze brief voor akkoord te ondertekenen en te uploaden via de link in de begeleidende e-mail. Wij danken je voor jouw inzet en wensen je veel succes.

Met vriendelijke groet,

${AFZENDER_NAAM}
{{BV}}



**Voor akkoord ondertekend:**

Naam: {{Naam}}

Datum: _______________________

Handtekening: _______________________`;

const PROEFTIJD_WN_EN = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Subject: Confirmation of your resignation during the probationary period**

Dear {{Naam}},

We hereby confirm receipt of your resignation on {{DatumOpzegging}}, by which you terminated your employment agreement with {{BV}} during the probationary period (Article 7:652 in conjunction with Article 7:676 of the Dutch Civil Code).

Your employment therefore ends on {{Einddatum}}. Pursuant to Article 7:676 of the Dutch Civil Code, no notice period applies during the probationary period.

**Final settlement**
With the next payroll run you will receive the final settlement, in which your remaining salary, accrued holiday allowance and any untaken holiday days will be settled.

**Company property**
We kindly request that you return all company property (including clothing, keys and passes) to your Store Manager no later than your last working day.

By signing this letter you confirm that you yourself, voluntarily and unambiguously, terminated the employment agreement during the probationary period.

Please sign this letter for approval and upload it via the link in the accompanying email. We thank you for your efforts and wish you all the best.

Kind regards,

${AFZENDER_NAAM}
{{BV}}



**Signed for approval:**

Name: {{Naam}}

Date: _______________________

Signature: _______________________`;

// --- Officiële waarschuwing (Template_Waarschuwing_NL/EN; waarschuwing.gs v1.2) ---
// Placeholders: {{Naam}} {{Adres}} {{BV}} {{Winkel}} {{DatumOvertreding}} {{Overtredingen}} {{Toelichting}} {{HuidigeDatum}}
const WRS_NL = `{{BV}}
{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Betreft: Officiële schriftelijke waarschuwing**

Beste {{Naam}},

Met deze brief geven wij je een officiële schriftelijke waarschuwing. Deze waarschuwing wordt opgenomen in jouw personeelsdossier bij {{BV}}, winkel {{Winkel}}.

**Aanleiding**

Op of rond {{DatumOvertreding}} hebben wij het volgende geconstateerd:

{{Toelichting}}

**Overtreden regel(s)**

De volgende regel(s) en/of instructie(s) zijn overtreden:

{{Overtredingen}}

**Juridische basis**

De huisregels van SLA zijn bij het aangaan van jouw arbeidsovereenkomst als bijlage aan de overeenkomst gehecht; zij maken daarvan deel uit en je hebt door ondertekening verklaard de bepalingen na te komen. Voor zover het bovenstaande betrekking heeft op HACCP- en voedselveiligheidsvoorschriften, volgt de plicht deze na te leven bovendien uit de Warenwet, de CAO Horeca die op jouw arbeidsovereenkomst van toepassing is, en het instructierecht van de werkgever (art. 7:660 BW) in samenhang met goed werknemerschap (art. 7:611 BW).

**Wat wij van je verwachten**

Wij verwachten dat je de betreffende regels vanaf heden volledig naleeft. Deze waarschuwing is een formele stap: bij herhaling of bij het overtreden van andere regels of instructies kunnen verdergaande maatregelen volgen, waaronder gevolgen voor de urentoedeling, het al dan niet verlengen van jouw arbeidsovereenkomst of - in ernstige gevallen - beëindiging van het dienstverband.

Wij hechten eraan te benadrukken dat deze waarschuwing bedoeld is om helderheid te geven en herhaling te voorkomen. Wil je hierover in gesprek, of is er iets waardoor het naleven voor jou lastig is? Neem dan contact op met jouw Store Manager of met HR via hr@ilovesla.com. We denken graag mee.

Een kopie van deze brief wordt bewaard in jouw personeelsdossier.

Met vriendelijke groet,

${AFZENDER_NAAM}
HR - {{BV}}
hr@ilovesla.com`;

const WRS_EN = `{{BV}}
{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Re: Official written warning**

Dear {{Naam}},

With this letter we are issuing you an official written warning. This warning will be added to your personnel file at {{BV}}, store {{Winkel}}.

**Reason**

On or around {{DatumOvertreding}} we established the following:

{{Toelichting}}

**Rule(s) violated**

The following rule(s) and/or instruction(s) have been violated (quoted in Dutch as legally agreed):

{{Overtredingen}}

**Legal basis**

When you entered into your employment agreement, the SLA house rules were attached to the agreement as an annex; they form part of the agreement, and by signing you declared that you would comply with them. Where the above concerns HACCP and food safety instructions, the obligation to comply additionally follows from the Dutch Commodities Act (Warenwet), the CAO Horeca collective labour agreement applicable to your contract, and the employer's right of instruction (art. 7:660 Dutch Civil Code) in combination with good employee conduct (art. 7:611).

**What we expect from you**

We expect you to fully comply with the relevant rules from now on. This warning is a formal step: in the event of repetition, or violation of other rules or instructions, further measures may follow, including consequences for the allocation of hours, the renewal of your employment contract or - in serious cases - termination of employment.

We want to emphasise that this warning is intended to provide clarity and prevent repetition. If you would like to discuss this, or if something is making compliance difficult for you, please contact your Store Manager or HR at hr@ilovesla.com. We are happy to help.

A copy of this letter will be kept in your personnel file.

Kind regards,

${AFZENDER_NAAM}
HR - {{BV}}
hr@ilovesla.com`;

// --- Weekendbeschikbaarheid, eerste kennisgeving (Template_Beschikbaarheid_NL/EN; Beschikbaarheid.gs v1.2) ---
// Placeholders: {{Naam}} {{Adres}} {{BV}} {{Winkel}} {{DataOnderbouwing}} {{Ingangsdatum}} {{HuidigeDatum}}
const BESCHIKB_NL = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Betreft: Beschikbaarheid weekenddiensten - eerste schriftelijke kennisgeving**

Beste {{Naam}},

Bij jouw indiensttreding bij {{BV}} heb je kennisgenomen van en ingestemd met de huisregels van SLA. Hierin is onder meer het volgende vastgelegd:

*"Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar."*

Deze afspraak bestaat omdat weekenddiensten het lastigst in te vullen zijn. Wanneer een deel van het team structureel niet beschikbaar is in het weekend, komt deze last onevenredig terecht bij collega's die dat wél zijn. Alleen als iedereen zich aan deze afspraak houdt, kunnen we de roosters van {{Winkel}} eerlijk en werkbaar verdelen over het hele team.

Uit onze beschikbaarheids- en roostergegevens blijkt dat jouw opgegeven beschikbaarheid hier de afgelopen periode structureel niet aan voldoet:

{{DataOnderbouwing}}

**Wat we van je verwachten**

Wij vragen je om per direct, en uiterlijk per {{Ingangsdatum}}, jouw beschikbaarheid in Shiftbase aan te passen zodat deze voldoet aan de huisregels: minimaal 2 beschikbare diensten op vrijdag, zaterdag of zondag.

De huisregels maken onderdeel uit van de afspraken bij jouw dienstverband. Als werkgever mogen wij op grond van artikel 7:660 BW redelijke voorschriften stellen over de wijze waarop het werk wordt georganiseerd; van jou als werknemer mag op grond van artikel 7:611 BW (goed werknemerschap) worden verwacht dat je hieraan meewerkt.

**Wat er gebeurt als je beschikbaarheid niet wijzigt**

Wanneer jouw beschikbaarheid na {{Ingangsdatum}} nog steeds niet voldoet aan de huisregels: (1) volgt een gesprek met jouw Store Manager; (2) kan een officiële schriftelijke waarschuwing worden opgenomen in jouw personeelsdossier; (3) wegen wij jouw beschikbaarheid mee bij de toedeling van uren en diensten; en (4) weegt dit mee in de beslissing over het al dan niet verlengen van jouw arbeidsovereenkomst voor bepaalde tijd.

Is er een persoonlijke omstandigheid (studie, zorgtaken, tweede baan) waardoor je structureel niet aan deze afspraak kunt voldoen? Neem dan vóór {{Ingangsdatum}} contact op met jouw Store Manager of met HR via hr@ilovesla.com, zodat we samen kunnen kijken wat er mogelijk is.

We vertrouwen erop dat we hiermee samen tot een goede oplossing komen.

Met vriendelijke groet,

${AFZENDER_NAAM}
HR - SLA Hoofdkantoor
{{BV}}`;

const BESCHIKB_EN = `{{HuidigeDatum}}

{{Naam}}
{{Adres}}

**Subject: Weekend shift availability - first written notice**

Dear {{Naam}},

When you joined {{BV}}, you read and agreed to the SLA house rules. These include the following rule:

*"You are available for a minimum of 2 shifts on Friday, Saturday or Sunday."* (original Dutch: "Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar.")

This rule exists because weekend shifts are the hardest to fill. When part of the team is structurally unavailable at weekends, this burden falls disproportionately on colleagues who are available. Only when everyone honours this agreement can we distribute the schedules of {{Winkel}} fairly and workably across the whole team.

Our availability and scheduling records show that your stated availability has structurally not met this rule over the recent period:

{{DataOnderbouwing}}

**What we expect from you**

We ask you to update your availability in Shiftbase immediately, and no later than {{Ingangsdatum}}, so that it complies with the house rules: a minimum of 2 available shifts on Friday, Saturday or Sunday.

The house rules form part of the agreements under your employment. As an employer, we are entitled under Article 7:660 of the Dutch Civil Code (BW) to issue reasonable instructions regarding the organisation of work; as an employee, you are expected under Article 7:611 BW (acting as a good employee) to cooperate with these.

**What happens if your availability does not change**

If your availability still does not comply with the house rules after {{Ingangsdatum}}: (1) a meeting with your Store Manager will follow; (2) an official written warning may be added to your personnel file; (3) your availability will be taken into account when allocating hours and shifts; and (4) this will be taken into account in the decision on whether or not to renew your fixed-term employment contract.

Is there a personal circumstance (studies, care responsibilities, a second job) that structurally prevents you from meeting this rule? Please contact your Store Manager or HR at hr@ilovesla.com before {{Ingangsdatum}}, so we can look at what is possible together.

We trust that we will find a good solution together.

Kind regards,

${AFZENDER_NAAM}
HR - SLA Head Office
{{BV}}`;

// --- Ontslag op staande voet (OoSV.gs v1.0, programmatisch opgebouwd; aangetekend + e-mail) ---
// Placeholders: {{Naam}} {{Adres}} {{BV}} {{Aanhef}} {{Datum}} {{DatumConstatering}} {{Gronden}} {{Wederhoor}} (blok)
const OOSV = `{{BV}}

**AANGETEKEND EN PER E-MAIL**

{{Naam}}
{{Adres}}

Datum: {{Datum}}
**Betreft: Ontslag op staande voet**

Geachte {{Aanhef}} {{Naam}},

Hierbij delen wij u mede dat {{BV}} de arbeidsovereenkomst met u met onmiddellijke ingang opzegt wegens een dringende reden, als bedoeld in artikel 7:677 juncto artikel 7:678 van het Burgerlijk Wetboek. Uw dienstverband eindigt derhalve per heden, {{Datum}}.

**Dringende reden(en)**
Op {{DatumConstatering}} is het volgende geconstateerd:

*{{Gronden}}*

Deze gedraging(en) vormen, zowel afzonderlijk als in onderlinge samenhang bezien, een dringende reden die het ontslag op staande voet rechtvaardigt.
{{Wederhoor}}
**Gevolgen**
Per de datum van dit ontslag wordt de loonbetaling stopgezet. U ontvangt binnen de wettelijke termijn een eindafrekening van het u nog toekomende salaris, opgebouwde vakantiedagen en vakantietoeslag tot en met heden. Wij verzoeken u alle bedrijfseigendommen (waaronder sleutels, kleding en pasjes) per omgaande in te leveren bij uw vestiging.

**Bezwaar**
Indien u zich niet met dit ontslag kunt verenigen, kunt u binnen twee maanden na heden de kantonrechter verzoeken het ontslag te vernietigen dan wel om toekenning van een vergoeding (artikel 7:681 BW).

Deze brief wordt u zowel per e-mail als per aangetekende post toegezonden.

Hoogachtend,

**${AFZENDER_NAAM}**
{{BV}}
hr@ilovesla.com`;
const OOSV_WEDERHOOR = `
**Hoor en wederhoor**
Op {{Wederhoor}} bent u in de gelegenheid gesteld uw zienswijze op het geconstateerde te geven. Hetgeen u naar voren heeft gebracht leidt niet tot een ander oordeel.
`;

module.exports = { ONTSLAG, AANZEGGING_NL, AANZEGGING_EN, OVERPL_NL, OVERPL_EN, STANDPL_NL, STANDPL_EN,
  PROEFTIJD_WG_NL, PROEFTIJD_WG_EN, PROEFTIJD_WN_NL, PROEFTIJD_WN_EN, WRS_NL, WRS_EN, BESCHIKB_NL, BESCHIKB_EN, OOSV, OOSV_WEDERHOOR, vul, handtekening };
