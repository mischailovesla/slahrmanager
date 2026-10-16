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

module.exports = { ONTSLAG, AANZEGGING_NL, AANZEGGING_EN, OVERPL_NL, OVERPL_EN, STANDPL_NL, STANDPL_EN, vul, handtekening };
