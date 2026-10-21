// ============================================================
// MTO-vragenlijst (gelijk aan de Google Forms van februari 2026, zodat rondes vergelijkbaar blijven met de nulmeting).
// 8 thema's x 5 stellingen (1 = helemaal mee oneens ... 5 = helemaal mee eens), daarna eNPS (0–10), topprioriteit
// (één thema) en een optionele open vraag. Sleutels (w1..v5) NIET wijzigen: daarop worden rondes vergeleken.
// In de Engelse tekst wordt {lg} vervangen door 'store manager' (SLA makers) of 'operation manager' (store managers).
// ============================================================
const THEMAS = [
  { key: 'werkplezier', nl: 'Werkplezier & energie', en: 'Job satisfaction & energy', vragen: [
    ['w1', 'Ik ga over het algemeen met plezier naar mijn werk.', 'I generally enjoy going to work.'],
    ['w2', 'Ik voel me gemotiveerd om mijn werk goed te doen.', 'I feel motivated to do my job well.'],
    ['w3', 'Ik heb het gevoel dat mijn werk betekenisvol is.', 'I feel that my work is meaningful.'],
    ['w4', 'Ik kan mezelf zijn op het werk.', 'I can be myself at work.'],
    ['w5', 'Aan het einde van mijn werkdag heb ik meestal nog voldoende energie over.', 'At the end of my working day, I usually have enough energy left.']] },
  { key: 'leidinggevende', nl: 'Leidinggevende', en: 'Manager', vragen: [
    ['l1', 'Mijn leidinggevende is benaderbaar als ik iets nodig heb.', 'My {lg} is available if I need something.'],
    ['l2', 'Mijn leidinggevende geeft duidelijke verwachtingen en prioriteiten.', 'My {lg} gives clear expectations and priorities.'],
    ['l3', 'Ik krijg regelmatig feedback die mij helpt beter te worden.', 'I get regular feedback that helps me get better.'],
    ['l4', 'Mijn leidinggevende behandelt medewerkers eerlijk en met respect.', 'My {lg} treats employees fairly and with respect.'],
    ['l5', 'Mijn leidinggevende ondersteunt mij als het druk of lastig is.', 'My {lg} supports me when it is busy or difficult.']] },
  { key: 'samenwerking', nl: 'Samenwerking & sfeer', en: 'Collaboration & atmosphere', vragen: [
    ['s1', 'In mijn team helpen we elkaar als dat nodig is.', 'In my team we help each other when necessary.'],
    ['s2', 'De sfeer in mijn team is goed.', 'The atmosphere in my team is good.'],
    ['s3', 'Ik voel me veilig om mijn mening te geven in mijn team.', 'I feel safe to express my opinion in my team.'],
    ['s4', 'Problemen of irritaties worden in mijn team op een goede manier besproken.', 'Problems or irritations are discussed in a good way in my team.'],
    ['s5', 'De samenwerking tussen collega’s in mijn store/team verloopt soepel.', 'The collaboration between colleagues in my store/team is running smoothly.']] },
  { key: 'werkdruk', nl: 'Werkdruk & planning', en: 'Work pressure & planning', vragen: [
    ['d1', 'De werkdruk is voor mij goed vol te houden.', 'The workload is easy for me to maintain.'],
    ['d2', 'De personeelsplanning is meestal realistisch voor wat er moet gebeuren.', 'Staff planning is usually realistic for what needs to be done.'],
    ['d3', 'Ik kan mijn pauzes meestal nemen zoals bedoeld.', 'I can usually take my breaks as intended.'],
    ['d4', 'Ik heb voldoende tijd om mijn werk goed en zorgvuldig te doen.', 'I have enough time to do my work well and carefully.'],
    ['d5', 'Als het te druk is, wordt er meegedacht over oplossingen.', 'If it is too busy, solutions are thought of.']] },
  { key: 'ontwikkeling', nl: 'Ontwikkeling & training', en: 'Development & training', vragen: [
    ['o1', 'Ik krijg voldoende training om mijn werk goed te kunnen doen.', 'I get enough training to do my job well.'],
    ['o2', 'Ik weet wat ik kan doen om mezelf verder te ontwikkelen.', 'I know what I can do to develop myself further.'],
    ['o3', 'Ik zie kansen om door te groeien binnen de organisatie.', 'I see opportunities to grow within the organization.'],
    ['o4', 'Nieuwe collega’s worden goed ingewerkt.', 'New colleagues are well trained.'],
    ['o5', 'Ik krijg de ruimte om te leren van fouten.', 'I get the space to learn from mistakes.']] },
  { key: 'beloning', nl: 'Beloning & waardering', en: 'Reward & appreciation', vragen: [
    ['b1', 'Ik voel me gewaardeerd voor wat ik doe.', 'I feel appreciated for what I do.'],
    ['b2', 'Mijn salaris past bij mijn werk en verantwoordelijkheden.', 'My salary matches my work and responsibilities.'],
    ['b3', 'Goede prestaties worden gezien en erkend.', 'Good performance is seen and recognized.'],
    ['b4', 'Ik krijg complimenten of waardering als ik het goed doe.', 'I get compliments or appreciation when I do it right.'],
    ['b5', 'De verdeling van werk en beloning voelt eerlijk.', 'The distribution of work and remuneration feels fair.']] },
  { key: 'communicatie', nl: 'Communicatie & betrokkenheid', en: 'Communication & engagement', vragen: [
    ['c1', 'Ik ben goed op de hoogte van wat er speelt in de organisatie.', 'I am well aware of what is going on in the organization.'],
    ['c2', 'Veranderingen die mijn werk raken worden op tijd en duidelijk uitgelegd.', 'Changes that affect my work are explained on time and clearly.'],
    ['c3', 'Ik weet bij wie ik terecht kan met vragen of ideeën.', 'I know who I can contact with questions or ideas.'],
    ['c4', 'Er wordt geluisterd naar suggesties van medewerkers.', 'Suggestions from employees are listened to.'],
    ['c5', 'Ik voel me betrokken bij beslissingen die invloed hebben op mijn werk.', 'I feel involved in decisions that affect my work.']] },
  { key: 'veiligheid', nl: 'Veiligheid & werkmiddelen', en: 'Safety & work equipment', vragen: [
    ['v1', 'Ik heb de juiste middelen/systemen om mijn werk goed te doen.', 'I have the right resources/systems to do my job well.'],
    ['v2', 'Problemen met materiaal of systemen worden snel opgelost.', 'Problems with material or systems are solved quickly.'],
    ['v3', 'Ik voel me veilig op mijn werkplek.', 'I feel safe in my workplace.'],
    ['v4', 'Er is voldoende aandacht voor een gezonde en veilige werkhouding/werkomgeving.', 'There is sufficient attention for a healthy and safe working posture/work environment.'],
    ['v5', 'Ik weet wat ik moet doen bij onveilige situaties of incidenten.', 'I know what to do in case of unsafe situations or incidents.']] }
];
const SLEUTELS = [].concat(...THEMAS.map(t => t.vragen.map(v => v[0])));
const THEMA_VAN = {}; THEMAS.forEach(t => t.vragen.forEach(v => { THEMA_VAN[v[0]] = t.key; }));
const ENPS = { nl: 'Hoe waarschijnlijk is het dat je SLA zou aanraden als werkgever aan vrienden of familie?', en: 'How likely is it that you would recommend SLA as an employer to friends or family?' };
const PRIORITEIT = { nl: 'Welk thema heeft volgens jou de hoogste prioriteit om te verbeteren?', en: 'Which theme do you think has the highest priority to improve?' };
const OPEN = { nl: 'Wat zou jouw werk bij SLA nog beter maken?', en: 'What would make your work at SLA even better?' };

// Vragenlijst voor de invulpagina, in één taal, met de juiste leidinggevende per groep
function voorPagina(taal, groep) {
  const en = String(taal).toUpperCase() === 'EN', lg = groep === 'manager' ? 'operation manager' : 'store manager';
  return {
    themas: THEMAS.map(t => ({ key: t.key, titel: en ? t.en : t.nl, vragen: t.vragen.map(v => ({ key: v[0], tekst: en ? v[2].replace('{lg}', lg) : v[1] })) })),
    enps: en ? ENPS.en : ENPS.nl, prioriteit: en ? PRIORITEIT.en : PRIORITEIT.nl, open: en ? OPEN.en : OPEN.nl,
    prioriteitOpties: THEMAS.map(t => ({ key: t.key, label: en ? t.en : t.nl }))
  };
}
// Antwoorden controleren; alle 40 stellingen + eNPS + prioriteit verplicht, open vraag optioneel
function valideer(p, taal) {
  const en = String(taal).toUpperCase() === 'EN', a = p && p.antwoorden || {}, uit = {};
  const mist = SLEUTELS.filter(k => { const n = Number(a[k]); if (!Number.isInteger(n) || n < 1 || n > 5) return true; uit[k] = n; return false; });
  if (mist.length) throw new Error(en ? 'Please answer all statements (' + mist.length + ' still open).' : 'Beantwoord alle stellingen (nog ' + mist.length + ' open).');
  const enps = Number(p.enps);
  if (!Number.isInteger(enps) || enps < 0 || enps > 10) throw new Error(en ? 'Please answer the recommendation question (0–10).' : 'Beantwoord de aanbevelingsvraag (0–10).');
  const prioriteit = String(p.prioriteit || '');
  if (!THEMAS.some(t => t.key === prioriteit)) throw new Error(en ? 'Please choose the theme with the highest priority.' : 'Kies het thema met de hoogste prioriteit.');
  return { antwoorden: uit, enps, prioriteit, opmerking: String(p.opmerking || '').trim().slice(0, 2000) };
}

module.exports = { THEMAS, SLEUTELS, THEMA_VAN, ENPS, PRIORITEIT, OPEN, voorPagina, valideer };
