// ============================================================
// v0.53.0 Algemene HACCP-brief aan het team (net als de teambrief Eindtijd & afsluiten):
// "HACCP hoort bij je werk". Geen waarschuwing, wel de afspraken (HR57–HR61) zwart op wit, met ingangsdatum.
// Opmaak en {variabelen}/[[blokken]] werken zoals in _lib/eindtijd.js (vul, naarHtml).
// ============================================================
const CATEGORIE = 'HACCP';

const NL = {
  onderwerp: 'HACCP hoort bij je werk bij SLA{winkel_kort}',
  tekst: `Beste {voornaam},

Bij SLA werken we elke dag met verse producten. Onze gasten moeten erop kunnen vertrouwen dat alles wat ze bij ons eten veilig is. Daarom werken we volgens **HACCP**: we meten temperaturen, controleren leveringen en leggen dat vast in de HACCP-lijsten in SLA Winkel.

Dat is geen extraatje naast je werk. **Het is je werk**, net zo goed als een salade maken of de kassa afsluiten.
[[cijfers]]
In {winkel} zijn over {periode} **{gemist} van de {verplicht} verplichte HACCP-lijsten niet afgerond** ({pct}%). Dat moet en kan beter.
[[/cijfers]]
**Waarom is dit zo belangrijk?**

- **Voedselveiligheid:** een te warme koeling of een niet gecontroleerde levering kan gasten ziek maken.
- **De NVWA controleert onaangekondigd.** Ontbreken de registraties, dan kan dat een boete of een maatregel voor de hele winkel opleveren.
- **Samen sterk:** als iedereen het goed doet, kunnen we met een gerust hart zeggen dat ons eten veilig is.

**Dit spreken we af, vanaf {ingangsdatum}:**

1. **Iedereen die in het tijdvak van een lijst werkt, is samen verantwoordelijk** dat de lijst vóór de deadline is afgerond.
2. **De leidinggevende van de dienst** verdeelt de lijsten aan het begin van de dienst en controleert of ze af zijn.
3. **Registreer naar waarheid.** Vul alleen in wat je echt hebt gemeten of gecontroleerd. Een meting invullen die niet is gedaan, zien we als een ernstige overtreding.
4. **Gebruik alleen je eigen naam en winkelcode** en deel je code niet.
5. **Lukt het niet (op tijd)?** Meld het vóór de deadline bij je leidinggevende en noteer de afwijking in de lijst, bijvoorbeeld "koeling te warm, product apart gezet".

Deze afspraken horen bij de huisregels van SLA. We houden bij welke lijsten niet worden afgerond en wie er op dat moment op het rooster stond. Worden de afspraken niet nageleefd, dan kan dat leiden tot een schriftelijke waarschuwing.

Weet je niet precies hoe een lijst werkt? Vraag het je storemanager of volg in SLA Academy de trainingen **Basis voedselveiligheid** en **HACCP in practice**.

Dank je wel dat je hier samen met ons werk van maakt.

Met vriendelijke groet,

{afzender_naam}
{afzender_functie}, SLA`
};

const EN = {
  onderwerp: 'HACCP is part of your job at SLA{winkel_kort}',
  tekst: `Dear {voornaam},

At SLA we work with fresh products every day. Our guests must be able to trust that everything they eat with us is safe. That is why we work according to **HACCP**: we check temperatures, inspect deliveries and record this in the HACCP lists in SLA Winkel.

This is not something extra on top of your work. **It is your work**, just like making a salad or closing the till.
[[cijfers]]
In {winkel}, **{gemist} of the {verplicht} mandatory HACCP lists were not completed** over {periode} ({pct}%). This must and can be better.
[[/cijfers]]
**Why is this so important?**

- **Food safety:** a fridge that is too warm or a delivery that was not checked can make guests ill.
- **The NVWA (food safety authority) inspects without notice.** Missing records can lead to a fine or measures for the whole store.
- **Stronger together:** if everyone does their part, we can say with confidence that our food is safe.

**This is what we agree, from {ingangsdatum}:**

1. **Everyone working during the time slot of a list is jointly responsible** for completing the list before the deadline.
2. **The shift leader** assigns the lists at the start of the shift and checks that they are done.
3. **Record truthfully.** Only fill in what you actually measured or checked. Filling in a check that was not done is a serious violation.
4. **Only use your own name and store code**, and do not share your code.
5. **Not possible (on time)?** Tell your shift leader before the deadline and note the deviation in the list, for example "fridge too warm, product set aside".

These agreements are part of the SLA house rules. We keep track of which lists are not completed and who was on the schedule at that time. Not following these agreements can lead to a written warning.

Not sure how a list works? Ask your store manager or follow the trainings **Basic food safety** and **HACCP in practice** in SLA Academy.

Thank you for making this a priority together with us.

Kind regards,

{afzender_naam}
{afzender_functie}, SLA`
};

const SJABLONEN = { NL, EN };
module.exports = { CATEGORIE, SJABLONEN };
