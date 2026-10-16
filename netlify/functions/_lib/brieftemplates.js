// ============================================================
// Brief-PDF's voor ontslag & aanzegging — tekst 1-op-1 overgenomen uit de
// Google Docs-templates (16-10-2026):
//   "Template Ontslagbrief Sla", "Aanzeggingsbrief_template", "Aanzeggingsbrief_template_EN"
// Opmaak: **vet**, *cursief*, "• " = opsomming, lege regel = nieuwe alinea.
// Placeholders: {{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}
// Wijzigen van de brieftekst = dit bestand aanpassen (Mischa's keuze: volledig in code).
// ============================================================
const { AFZENDER_NAAM } = require('./config');

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
${AFZENDER_NAAM}

................................................


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

module.exports = { ONTSLAG, AANZEGGING_NL, AANZEGGING_EN, vul };
