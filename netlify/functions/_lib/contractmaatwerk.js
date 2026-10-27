// ============================================================
// v0.33.0: Contract op maat — volledige arbeidsovereenkomst voor afwijkende situaties die Shiftbase niet kan
// (bijv. eerst een nulurencontract en daarna vaste uren met maandsalaris, of een NS Business Card).
// Basis: de Shiftbase-template "Contract Store Manager - bepaalde tijd" (tekst 1-op-1, 27-10-2026), met bouwstenen:
//   • fasering   — fase 1 en fase 2 met eigen contractvorm (oproep/vaste uren), uren en loon (uur/maand)
//   • ns         — NS Business Card in plaats van "geen reiskostenvergoeding"
//   • extra      — vrij artikel "Aanvullende afspraken"
// Artikelnummers worden automatisch doorgenummerd; verwijzingen gaan via {{ART:sleutel}}.
// Opmaak voor P.maakOpgemaakteBrief: **vet**, "- " = opsomming, lege regel = nieuwe alinea.
// BSN en IBAN zijn optioneel en komen alleen in de PDF, nooit in het logboek (redigeer()).
// ============================================================

const pad2 = n => String(n).padStart(2, '0');
function parseDatum(s) {
  const t = String(s || '').trim(); let m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const nl = d => d ? pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear() : '';
const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function plusMaanden(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1), laatste = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(d.getDate(), laatste)); return x; }
// Einddatum bij een duur in maanden: start 01-11-2026 + 12 mnd → 31-10-2027
const eindVan = (start, maanden) => plusDagen(plusMaanden(start, maanden), -1);
function bedrag(v) {
  let s = String(v == null ? '' : v).replace(/[€\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Number(s); return isFinite(n) && n > 0 ? n : 0;
}
const euro = v => { const n = bedrag(v); return n ? '€ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; };
const getal = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const maandTekst = n => n === 1 ? 'één (1) maand' : n === 2 ? 'twee (2) maanden' : n === 3 ? 'drie (3) maanden' : n === 4 ? 'vier (4) maanden' : n === 6 ? 'zes (6) maanden' : n + ' maanden';
// v0.33.2/0.33.3: SLA Holding BV (kantoor) wijkt af: fulltime = 40 uur, pensioen via a.s.r. (niet PH&C) en GEEN cao
// (dus ook geen functie-indeling Horeca en een eigen overwerkregeling). Alleen voor de holding.
const isHolding = bv => /holding/i.test(String(bv || ''));
const fulltimeVan = bv => isHolding(bv) ? 40 : 38;
// v0.33.5: deeltijd — het ingevulde maandsalaris is het fulltime bedrag; het deeltijdsalaris = fulltime × uren / fulltime-uren
const naarRato = (v, uren, ft) => Math.round(bedrag(v) * uren / ft * 100) / 100;
const plaatsUit = adres => { const m = String(adres || '').match(/\d{4}\s?[A-Z]{2}\s+(.+)$/); return m ? m[1].trim() : 'Amsterdam'; };

// ---- Huisregels (bijlage, woordelijk uit de Shiftbase-template) ----
const HUISREGELS = [
  'Je bent altijd 5 minuten voor je dienst begint aanwezig.',
  'Als je aan het werk bent, heb je altijd bedrijfskleding aan: een SLA-shirt en een nette sloof.',
  'Lang haar draag je altijd in een vlecht of knot.',
  'Je handen zien er verzorgd uit. Geen armbanden, ringen om, restjes nagellak verwijder je voor je dienst begint.',
  'Je zorgt dat je voor je dienst alle berichten in de SLA-app hebt gelezen, zo ben je helemaal op de hoogte van de meest recente ontwikkelingen binnen je winkel en binnen SLA.',
  'Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar.',
  'Je werkt minimaal 2 diensten per week.',
  'Pauzeren doe je buiten de piekuren en nadat alle klusjes zijn gedaan. Je gaat dan apart zitten in privé kleding (even een trui over je SLA-shirt).',
  'De counter en de winkel zijn alleen bestemd voor werk-gerelateerde spullen.',
  'Mobiele telefoons bewaar je bij je privé-spullen en zijn nooit zichtbaar voor de klanten. Een uitzondering hierop is de mobiele telefoon van de bedrijfsleider.',
  'Er wordt niet gegeten op de werkvloer. Als je een drankje hebt staan zet je dit uit het zicht.',
  'Je mag koffie, thee en water drinken tijdens je dienst. Als je zin hebt in een ander drankje zoals sapjes, smoothies of fris, reken je die bij een collega af met personeelskorting.',
  'Bij een dienst langer dan 5,5 uur mag je een salade, bowl of soep eten. Hierbij kies je een salade van het menu of een reguliere stel-zelf-samen met 1 premium. Bij een dienst korter dan 5,5 uur kun je voor of na je dienst een salade, bowl of soep afrekenen voor de personeelsprijs.',
  'Het is niet de bedoeling dat je eten mee naar huis neemt, behalve als je bedrijfsleider hier toestemming voor heeft gegeven.',
  'Als je niet aan het werk bent krijg je – in alle winkels van SLA – op vertoon van je Apprendo account 25% korting.',
  'Als je niet aan het werk bent gedraag je je als klant. Je komt niet achter de counter.',
  'Gesprekken voer je op gepaste toon en nooit als er klanten geholpen moeten worden.',
  'Je praat nooit over klanten of over de kwaliteit of houdbaarheid van het eten als andere klanten dit kunnen horen.',
  'Je hebt altijd dichte schoenen aan tijdens je werk.',
  'Je ziekmelden doe je voor 8.00 uur \'s ochtends telefonisch bij je bedrijfsleider. Een bericht sturen is niet afdoende. Na 8.00 uur ben je zelf verantwoordelijk voor het opvangen van je dienst.',
  'Roken tijdens werktijd mag alleen uit het zicht van de klanten in privé kleding. Dit mag alleen op rustige momenten als het uitkomt.',
  'SLA-meetings zijn verplicht, dit zijn er max 4 per jaar (inclusief 2 menuwissel-meetings). Hiervoor krijg je per meeting 1 uur uitbetaald.',
  'Een koffietraining georganiseerd vanuit SLA wordt uitbetaald. Hoeveel uur is afhankelijk van de duur van de training.',
  'Het is niet toegestaan om onder invloed van alcohol of drugs te zijn op de werkvloer.',
  'SLA hanteert een strikt zero tolerance beleid op grensoverschrijdend gedrag.',
  'Je accepteert en respecteert de ander zoals hij is en discrimineert niet. Iedereen telt mee binnen de SLA-organisatie.',
  'Je houdt rekening met de grenzen die de ander aangeeft.',
  'Je valt de ander niet lastig.',
  'Je maakt op geen enkele wijze misbruik van jouw machtspositie.',
  'Je komt niet ongewenst te dichtbij en raakt de ander niet tegen zijn of haar wil aan.',
  'Als iemand je hindert of lastigvalt dan vraag je hem/haar hiermee te stoppen. Als dat niet helpt, vraag je een ander om hulp.',
  'Je helpt anderen om zich ook aan deze afspraken te houden en spreekt degene die zich daar niet aan houdt erop aan en meldt dit zo nodig bij een van de vertrouwenspersonen.',
  'Vanuit SLA zijn er 2 vertrouwenspersonen die benaderd kunnen worden indien er sprake is van eventueel seksueel grensoverschrijdend gedrag. Dit zijn Jodi Ko (jodi@ilovesla.com) en Ymke Peverelli (ymke@ilovesla.com).'
];

// ---- Invoer normaliseren ----
function lees(p) {
  p = p || {};
  const start = parseDatum(p.startdatum);
  const soort = p.soort === 'onbepaald' ? 'onbepaald' : 'bepaald';
  const maanden = parseInt(p.maanden, 10) || 0;
  const eind = soort === 'bepaald' ? (parseDatum(p.einddatum) || (start && maanden ? eindVan(start, maanden) : null)) : null;
  const f = (x, i) => {
    x = x || {};
    return { van: i === 0 ? start : parseDatum(x.van), tot: parseDatum(x.tot), vorm: x.vorm === 'oproep' ? 'oproep' : 'vast', uren: getal(x.uren), loon: x.loon === 'uur' ? 'uur' : 'maand', bedrag: x.bedrag };
  };
  const fasering = !!(p.fasering && p.fasering.aan);
  const fasen = fasering ? [f(p.fasering.fase1, 0), f(p.fasering.fase2, 1)] : [f({ vorm: p.vorm, uren: p.uren, loon: p.loonsoort, bedrag: p.bedrag }, 0)];
  if (fasering) {
    if (fasen[0].tot && !fasen[1].van) fasen[1].van = plusDagen(fasen[0].tot, 1);
    if (fasen[1].van && !fasen[0].tot) fasen[0].tot = plusDagen(fasen[1].van, -1);
  }
  return {
    naam: String(p.naam || '').trim(), adres: String(p.adres || '').trim(), postcodePlaats: String(p.postcodePlaats || '').trim(),
    geboortedatum: String(p.geboortedatum || '').trim(), geboorteplaats: String(p.geboorteplaats || '').trim(),
    bsn: String(p.bsn || '').replace(/\D/g, ''), iban: String(p.iban || '').replace(/\s/g, '').toUpperCase(),
    bv: String(p.bv || '').trim(), bvAdres: String(p.bvAdres || '').trim(), vertegenwoordiger: String(p.vertegenwoordiger || '').trim() || 'Ymke Peverelli',
    functie: String(p.functie || '').trim(), referentie: String(p.referentie || '').trim(), standplaats: String(p.standplaats || '').trim(),
    soort, start, maanden, eind, proeftijd: parseInt(p.proeftijd, 10) || 0, opzegWn: parseInt(p.opzegWn, 10) || 1,
    fasering, fasen,
    ns: p.ns && p.ns.aan ? { klasse: String(p.ns.klasse) === '1' ? 'eerste' : 'tweede', prive: !!p.ns.prive, ingang: parseDatum(p.ns.ingang) || start } : null,
    extra: String(p.extra || '').replace(/\r/g, '').trim()
  };
}

// ---- Controles: fouten blokkeren, "let op" tonen we alleen ----
function controleer(c) {
  const fouten = [], let_op = [];
  if (!c.naam) fouten.push('Vul de naam van de medewerker in.');
  if (!c.bv) fouten.push('Kies de werkgever (BV).');
  if (!c.functie) fouten.push('Vul de functie in.');
  if (!c.start) fouten.push('Vul een geldige startdatum in.');
  if (c.soort === 'bepaald' && !c.eind) fouten.push('Vul de duur in maanden of de einddatum in.');
  if (c.start && c.eind && c.eind <= c.start) fouten.push('De einddatum ligt vóór de startdatum.');
  c.fasen.forEach((f, i) => {
    const wie = c.fasering ? 'Fase ' + (i + 1) + ': ' : '';
    if (f.vorm === 'vast' && !(f.uren > 0)) fouten.push(wie + 'vul het aantal uren per week in.');
    if (f.uren > fulltimeVan(c.bv)) let_op.push(wie + 'meer dan ' + fulltimeVan(c.bv) + ' uur per week is meer dan een fulltime werkweek.');
    if (!euro(f.bedrag)) fouten.push(wie + 'vul het bruto ' + (f.loon === 'uur' ? 'uurloon' : 'maandsalaris') + ' in.');
    if (f.vorm === 'oproep' && f.loon === 'maand') fouten.push(wie + 'bij een nulurencontract hoort een uurloon, geen maandsalaris.');
  });
  if (c.fasering) {
    const [a, b] = c.fasen;
    if (!a.tot || !b.van) fouten.push('Vul in tot en met wanneer fase 1 loopt.');
    else {
      if (c.start && a.tot < c.start) fouten.push('Fase 1 eindigt vóór de startdatum.');
      if (plusDagen(a.tot, 1).getTime() !== b.van.getTime()) fouten.push('Fase 2 moet direct aansluiten op fase 1 (de dag erna).');
      if (c.eind && b.van > c.eind) fouten.push('Fase 2 begint na het einde van het contract.');
    }
    if (a.vorm === b.vorm && a.uren === b.uren && a.loon === b.loon && euro(a.bedrag) === euro(b.bedrag)) let_op.push('Fase 1 en fase 2 zijn gelijk: dan is fasering niet nodig.');
  }
  // Proeftijd (art. 7:652 BW; de CAO kan afwijken)
  if (c.proeftijd) {
    const duur = c.soort === 'bepaald' && c.start && c.eind ? (c.eind - c.start) / 864e5 : Infinity;
    if (c.soort === 'bepaald' && duur < 183) fouten.push('Bij een contract van 6 maanden of korter mag geen proeftijd worden afgesproken (art. 7:652 lid 4 BW).');
    else if (c.soort === 'bepaald' && duur < 729 && c.proeftijd > 1) let_op.push('Bij een contract korter dan 2 jaar is de wettelijke proeftijd maximaal 1 maand (art. 7:652 BW). ' + (isHolding(c.bv) ? 'Voor de holding geldt geen cao, dus dit is de grens.' : 'tenzij de CAO Horeca langer toestaat. Controleer dit.'));
    else if (c.proeftijd > 2) fouten.push('De proeftijd is maximaal 2 maanden.');
  }
  if (c.opzegWn > 1 && c.soort === 'bepaald') let_op.push('Opzegtermijn werknemer ' + c.opzegWn + ' maanden: voor werkgever geldt dan het dubbele (' + c.opzegWn * 2 + ' maanden).');
  if (c.bsn && c.bsn.length !== 9) let_op.push('Het BSN heeft geen 9 cijfers.');
  if (c.ns && c.ns.prive) let_op.push('NS Business Card met privégebruik: het privévoordeel is loon. Stem met de salarisadministratie af dat het via de werkkostenregeling (eindheffing) loopt.');
  if (c.fasering && c.fasen[0].vorm === 'oproep') let_op.push('Fase 1 is een nulurencontract: zet in Shiftbase eerst het nulurencontract en per ' + nl(c.fasen[1].van) + ' het contract van fase 2, en geef de overgang door aan de salarisadministratie.');
  return { fouten, let_op };
}

// ---- Contracttekst opbouwen ----
function bouw(p) {
  const c = lees(p), ctl = controleer(c);
  const arts = []; // { sleutel, titel, tekst }
  const A = (sleutel, titel, tekst) => arts.push({ sleutel, titel, tekst });
  const [f1, f2] = c.fasen, startNL = nl(c.start);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const faseKop = i => i === 0 ? '**Fase 1** (van ' + startNL + ' tot en met ' + nl(f1.tot) + '): ' : '**Fase 2** (met ingang van ' + nl(f2.van) + '): ';

  // Aard dienstverband
  let t = 'Werknemer is met ingang van ' + startNL + ' beschikbaar voor het verrichten van werkzaamheden voor werkgever.\n\n';
  t += c.soort === 'bepaald'
    ? 'De arbeidsovereenkomst is aangegaan voor bepaalde tijd' + (c.maanden ? ' voor de duur van ' + c.maanden + ' maanden' : '') + ' en eindigt derhalve van rechtswege op ' + nl(c.eind) + '.'
    : 'De arbeidsovereenkomst is aangegaan voor onbepaalde tijd.';
  if (c.fasering) t += '\n\nDe arbeidsovereenkomst kent twee fasen, elk met eigen afspraken over de arbeidsduur en het loon (zie artikel {{ART:werktijden}} en artikel {{ART:salaris}}). Het gaat om één doorlopende arbeidsovereenkomst: de overgang naar fase 2 op ' + nl(f2.van) + ' vindt automatisch plaats, zonder dat daarvoor een nieuwe overeenkomst nodig is.';
  if (c.proeftijd) t += '\n\nEen proeftijd van ' + c.proeftijd + ' maand(en) is van toepassing. Gedurende de proeftijd kan zowel werkgever als werknemer de arbeidsovereenkomst op elk gewenst moment opzeggen.';
  A('aard', 'Aard dienstverband.', t);

  // (Tussentijdse) opzegging
  const wg = c.opzegWn > 1 ? ' Voor werkgever geldt, overeenkomstig artikel 7:672 lid 6 BW, een opzegtermijn van ten minste het dubbele van de voor werknemer geldende termijn, zijnde ' + maandTekst(c.opzegWn * 2) + '.' : ' Voor werkgever geldt de wettelijke opzegtermijn (artikel 7:672 BW).';
  if (c.soort === 'bepaald') A('opzegging', 'Tussentijdse opzegging.', 'Deze arbeidsovereenkomst kan, ook ingeval die verlengd is, wederzijds tussentijds worden opgezegd. Deze tussentijdse opzegging dient schriftelijk te geschieden tegen het einde van een kalendermaand. Voor werknemer geldt een opzegtermijn van ' + maandTekst(c.opzegWn) + '.' + wg);
  else A('opzegging', 'Opzegging.', 'Opzegging van deze arbeidsovereenkomst dient schriftelijk te geschieden tegen het einde van een kalendermaand. Voor werknemer geldt een opzegtermijn van ' + maandTekst(c.opzegWn) + '.' + wg);

  // Aanzegging bij voorbaat (alleen bepaalde tijd)
  if (c.soort === 'bepaald') A('aanzegging', 'Aanzegging bij voorbaat.', 'Werkgever hecht er waarde aan om aan de werknemer aan te zeggen dat deze arbeidsovereenkomst voor bepaalde tijd, nadat die is geëindigd van rechtswege, niet zal worden voortgezet. Aldus wordt hierbij voldaan aan de wettelijke aanzegverplichting van de werkgever als bedoeld in artikel 7:668 BW.\n\nDoor ondertekening van deze arbeidsovereenkomst erkent de werknemer dat de werkgever aan zijn wettelijke aanzegverplichting heeft voldaan. De werknemer zal daarom geen aanspraak kunnen maken op de aanzegboete als bedoeld in artikel 7:668 lid 3 BW.');

  // Functie, taak en standplaats
  A('functie', 'Functie, taak en standplaats.', 'Werknemer zal bij werkgever werkzaamheden verrichten in de functie van ' + c.functie + (c.referentie && !isHolding(c.bv) ? ' (die bij de indeling is vergeleken met de referentienummer(s) ' + c.referentie + ' in het Handboek Referentiefuncties Bedrijfstak Horeca)' : '') + '. De inhoud van de functie is partijen genoegzaam bekend, zodat hiervan geen nadere omschrijving behoeft te worden gegeven.\n\nDe standplaats van werknemer is ' + (c.standplaats || plaatsUit(c.bvAdres)) + '. Werknemer verklaart ermee bekend te zijn, dat de werkzaamheden ook buiten de genoemde standplaats verricht kunnen worden op een door werkgever aan te geven plaats.\n\nWerkgever kan, indien hiervoor redelijke gronden aanwezig zijn, werknemer verzoeken de functie op een andere locatie te vervullen, welk verzoek werknemer niet dan op redelijke gronden zal weigeren. Werkgever kan van werknemer verlangen andere werkzaamheden te verrichten dan die horen bij zijn functie, alleen als dit redelijk is.');

  // Werktijden
  const urenZin = f => f.vorm === 'oproep'
    ? 'werknemer werkt op oproepbasis zonder vaste arbeidsduur (nulurenovereenkomst). Werknemer verricht werkzaamheden wanneer werkgever hem daarvoor oproept en werknemer aan die oproep gehoor geeft. Werkgever roept werknemer ten minste vier dagen van tevoren schriftelijk of elektronisch op (artikel 7:628a BW). Bij een oproep van minder dan drie uur heeft werknemer recht op loon over drie uur.'
    : 'de arbeidsduur bedraagt gemiddeld ' + String(f.uren).replace('.', ',') + ' uur per week.';
  const ft = fulltimeVan(c.bv);
  const alg = 'Een fulltime werkweek bij werkgever bedraagt ' + ft + ' uur per week. De werkzaamheden worden in beginsel verricht tussen 09.00 en 22.00 uur.\n\nWerknemer verklaart zich bereid om, indien werkgever daarom verzoekt, buiten de gebruikelijke werktijden werkzaamheden te verrichten.\n\nWerknemer verklaart zich bereid overwerk te verrichten indien bedrijfsomstandigheden die naar het oordeel van de werkgever vereisen.\n\nOnder overwerk wordt verstaan arbeid gedurende uren die gemaakt worden nadat de contractuele overeengekomen uren overschreden worden en die in opdracht of met toestemming van werkgever is verricht. ' + (isHolding(c.bv) ? 'Overwerk wordt in overleg met werkgever gecompenseerd in vrije tijd (tijd voor tijd), tenzij schriftelijk anders is afgesproken.' : 'Vergoeding van overwerk vindt plaats overeenkomstig de van toepassing zijnde CAO.');
  A('werktijden', 'Werktijden.', c.fasering ? faseKop(0) + urenZin(f1) + '\n\n' + faseKop(1) + urenZin(f2) + '\n\n' + alg : cap(urenZin(f1)) + ' ' + alg);

  // Salaris
  const loonZin = f => f.loon === 'uur'
    ? 'het bruto uurloon van werknemer bedraagt ' + euro(f.bedrag) + ' (exclusief vakantietoeslag).'
    : 'het brutosalaris van werknemer bedraagt ' + euro(f.bedrag) + ' per maand (exclusief vakantietoeslag) op basis van een ' + ft + ' urige werkweek' + (f.uren > 0 && f.uren < ft ? '. Bij de overeengekomen arbeidsduur van gemiddeld ' + String(f.uren).replace('.', ',') + ' uur per week ontvangt werknemer dit salaris naar rato, zijnde ' + euro(naarRato(f.bedrag, f.uren, ft)) + ' bruto per maand (exclusief vakantietoeslag)' : '') + '.';
  const uit = 'De uitbetaling van het loon vindt plaats op de laatste dag van de periode onder verstrekking van een loonstrook. Werknemer geeft hierbij aan werkgever toestemming de opgaven zoals bedoeld in artikel 7.626 BW (loonstrook) en 7.655 BW elektronisch te verstrekken op het opgegeven privé e-mailadres.';
  A('salaris', 'Salaris.', c.fasering ? faseKop(0) + loonZin(f1) + '\n\n' + faseKop(1) + loonZin(f2) + '\n\n' + uit : cap(loonZin(f1)) + '\n\n' + uit);

  // Vakantie
  A('vakantie', 'Vakantie en vakantietoeslag.', 'De werknemer bouwt per kalenderjaar 0,0768 uur (wettelijke) vakantie per gewerkt uur op. Dit komt bij een fulltime dienstverband overeen met 20 dagen vakantie. De werknemer bouwt per kalenderjaar 0,0192 bovenwettelijke vakantie per gewerkt uur op. Dit komt bij een fulltime dienstverband overeen met 5 dagen vakantie.\n\nWettelijke vakantiedagen vervallen een halfjaar na het jaar waarin ze zijn opgebouwd. Bovenwettelijke vakantiedagen verjaren vijf jaar na het jaar waarin ze zijn opgebouwd. Indien werknemer in geval van arbeidsongeschiktheid niet in staat is zijn werkzaamheden te verrichten, wordt werknemer wel geacht zijn vakantie-uren op te nemen voor afloop vervaldatum.\n\nWerkgever stelt na overleg met werknemer de op te nemen vakantiedagen vast.\n\nDe werkgever heeft het recht om – ten laste van het in artikel {{ART:vakantie}} bedoelde aantal vakantiedagen – verplichte vrije dagen aan te wijzen en/of om bepaalde periodes als bedrijfsvakantie aan te wijzen, gedurende welke periode het bedrijf of een bepaalde afdeling daarvan gesloten zijn. De werknemer is dan verplicht om vakantie op te nemen.\n\nDe werknemer heeft recht op een vakantietoeslag van 8 procent over het brutosalaris, zoals omschreven in artikel {{ART:salaris}}. De vakantietoeslag wordt maandelijks aan werknemer uitgekeerd.');

  // Ziekte
  A('ziekte', 'Ziekte.', 'De werknemer is verplicht ieder verzuim wegens ziekte aan de werkgever door te (laten) geven op de eerste ziektedag \'s morgens voor 08.00 uur.\n\nWerknemer dient telefonisch en zo nodig in persoon bereikbaar en beschikbaar te zijn voor contact met de bedrijfsarts en werkgever. Werknemer geeft gehoor aan oproepen van de bedrijfsarts en werkt volledig mee aan de adviezen en mogelijkheden die de bedrijfsarts adviseert ter bevordering van het herstel.\n\nZodra de werknemer na arbeidsongeschiktheid zijn werkzaamheden kan hervatten, meldt hij dit aan zijn werkgever.\n\nIndien de werknemer door ziekte verhinderd is de overeengekomen werkzaamheden te verrichten, ' + (isHolding(c.bv) ? 'zal de werkgever gedurende ten hoogste 104 weken 70% van het gemiddeld uitbetaalde brutoloon over de achterliggende 3 maanden doorbetalen, gedurende de eerste 52 weken ten minste het voor werknemer geldende wettelijk minimumloon (artikel 7:629 BW).' : 'zal de werkgever gedurende de eerste 52 weken 95% van het gemiddeld uitbetaalde brutoloon over de achterliggende 3 maanden doorbetalen. Vanaf de 53e ziekteweek tot aan de 104e ziekteweek zal dit 75% bedragen.') + ' Onder loon wordt in deze bepaling verstaan het in artikel {{ART:salaris}} genoemde loon vermenigvuldigd met het aantal gewerkte uren over de genoemde periode. Als de periode van 3 maanden geen juiste maatstaf voor vaststelling van het loon blijkt te zijn, dan wordt uitgegaan van een periode van 12 maandtijdvakken.\n\n' + (isHolding(c.bv) ? 'Uitbetaling van ziektegeld vindt plaats met inachtneming van twee (2) wachtdagen. Gedurende deze wachtdagen heeft werknemer geen recht op salaris.' : 'Uitbetaling van ziektegeld vindt plaats met inachtneming van één (1) wachtdag. Gedurende deze wachtdag heeft werknemer geen recht op salaris.') + '\n\nPerioden van arbeidsongeschiktheid die elkaar opvolgen binnen een termijn van vier weken worden als aaneengesloten periode beschouwd.');

  // Postcontractueel
  A('postcontractueel', 'Postcontractuele verplichtingen.', 'Zodra en indien de werknemer binnen vier weken nadat het dienstverband is geëindigd ziek wordt (door arbeidsongeschiktheid zijn werkzaamheden niet of gedeeltelijk niet kan verrichten) is hij verplicht dit onmiddellijk schriftelijk te melden aan de werkgever. Deze werknemer – alsook de werknemer die ziek is (door arbeidsongeschiktheid zijn werkzaamheden niet of gedeeltelijk niet kan verrichten) op het moment waarop hij uit dienst treedt – is verplicht om de controlevoorschriften bij ziekte van de werkgever – inclusief re-integratieverplichtingen –, alsmede de instructies van de bedrijfsarts, alsmede alle verplichtingen die hij heeft op grond van de (Ziekte)wet, strikt na te leven.\n\nAl hetgeen herstel van de ziekte en/of arbeidsongeschiktheid belemmert dient de werknemer achterwege te laten, al hetgeen herstel van de ziekte en/of arbeidsongeschiktheid bevordert dient de werknemer te ondernemen, daaronder begrepen door of namens de werkgever aangeboden re-integratie-inspanningen.\n\nBij overtreding van het vorenstaande verbeurt de (ex-)werknemer – ten behoeve van de werkgever – telkens een dadelijk opeisbare boete, zonder dat voorafgaande sommatie of ingebrekestelling is vereist, van € 1.000,- ineens, te vermeerderen met een bedrag van € 250,- per dag voor iedere dag dat de overtreding voortduurt, onverminderd het recht van de werkgever om nakoming van het vorenstaande en/of schadevergoeding te vorderen.');

  // Reiskosten / NS Business Card
  if (c.ns) A('reiskosten', 'Reiskosten en NS Business Card.', 'Werkgever stelt werknemer met ingang van ' + nl(c.ns.ingang) + ' een NS Business Card (' + c.ns.klasse + ' klas) ter beschikking. De kaart is bestemd voor reizen tussen de woning en de werkplek(ken) en voor zakelijke reizen in opdracht van werkgever. '
    + (c.ns.prive ? 'Werknemer mag de kaart ook privé gebruiken. Werkgever brengt het voordeel van privégebruik, voor zover nodig, onder in de werkkostenregeling.' : 'Privégebruik van de kaart is niet toegestaan.')
    + '\n\nNaast de NS Business Card heeft werknemer geen recht op een (andere) reiskostenvergoeding en kan hij ook bij verhuizing geen aanspraak maken op een hogere vergoeding.\n\nDe NS Business Card blijft eigendom van werkgever (zie artikel {{ART:eigendom}}). Werknemer gaat zorgvuldig met de kaart om, meldt verlies of diefstal direct aan werkgever en levert de kaart uiterlijk op de laatste werkdag in.\n\nWerkgever kan de reisgegevens van de kaart inzien om te controleren of de kaart volgens deze afspraken wordt gebruikt. Kosten van gebruik in strijd met deze afspraken en boetes of toeslagen (bijvoorbeeld voor niet in- of uitchecken) komen voor rekening van werknemer en mogen, voor zover de wet dat toestaat, worden verrekend met het loon.\n\nWerkgever kan deze regeling na overleg met werknemer wijzigen of beëindigen als de reden voor de toekenning vervalt, bijvoorbeeld bij een wijziging van functie, werkplek of woonadres.');
  else A('reiskosten', 'Reiskostenvergoeding.', 'Werknemer heeft geen recht op reiskostenvergoeding en kan ook bij verhuizing hier geen aanspraak op maken.');

  A('eigendom', 'Eigendom van de werkgever.', 'Alle goederen en alle informatie in welke vorm dan ook, die de werknemer van of ten behoeve van de werkgever tijdens de arbeidsovereenkomst onder zich heeft, zijn en blijven eigendom van de werkgever. De werknemer is verplicht deze goederen op het eerste verzoek van de werkgever en bij het eindigen van de arbeidsovereenkomst aan de werkgever af te geven.');
  A('pensioen', 'Pensioen.', isHolding(c.bv) ? 'Werknemer neemt deel aan de pensioenregeling van werkgever. Deze pensioenregeling is ondergebracht bij a.s.r.' : 'Werknemer neemt deel aan de pensioenregeling van werkgever. Deze pensioenregeling is ondergebracht bij Stichting Pensioenfonds Horeca & Catering.');

  if (c.extra) A('extra', 'Aanvullende afspraken.', c.extra + '\n\nVoor zover deze aanvullende afspraken afwijken van de overige bepalingen van deze arbeidsovereenkomst, gaan deze aanvullende afspraken voor.');

  const plaats = plaatsUit(c.bvAdres);
  A('nader', 'Nadere bepalingen.', 'Werkgever is bevoegd de in de onderhavige arbeidsovereenkomst opgenomen bepalingen eenzijdig te wijzigen, als werkgever bij de wijziging een zwaarwegend belang heeft.\n\nAlle hiervoor gesloten overeenkomsten komen met het sluiten van deze overeenkomst te vervallen. Nietigheid van een of meer bepalingen van de arbeidsovereenkomst leidt niet tot nietigheid van de andere bepalingen van deze overeenkomst.\n\nDeze overeenkomst wordt beheerst door het Nederlandse recht.\n\nBinnen de onderneming van de werkgever zijn huisregels van toepassing, welke als bijlage aan deze arbeidsovereenkomst wordt gehecht en daarvan deel uitmaakt. Werknemer verklaart door ondertekening van deze overeenkomst een kopie van de huisregels te hebben ontvangen en verklaart de bepalingen uit de huisregels na te komen. Werknemer is ermee bekend en stemt ermee in dat de huisregels eenzijdig door de werkgever kunnen worden gewijzigd.\n\n' + (isHolding(c.bv) ? 'Op deze overeenkomst is geen collectieve arbeidsovereenkomst (cao) van toepassing.' : 'Op deze overeenkomst is de CAO Horeca van toepassing.') + '\n\nOpgemaakt in tweevoud en getekend te ' + plaats + '.');

  // Nummeren en verwijzingen invullen
  const nr = {}; arts.forEach((a, i) => { nr[a.sleutel] = i + 1; });
  const vulRef = s => s.replace(/\{\{ART:(\w+)\}\}/g, (m, k) => String(nr[k] || '?'));
  const regel = (label, waarde) => waarde ? '**' + label + ':** ' + waarde : '';
  const bvDelen = c.bvAdres.split(/,\s*/);
  let tekst = '**ARBEIDSOVEREENKOMST' + (c.functie ? ' ' + c.functie.toUpperCase() : '') + '**\n\nDe ondergetekenden:\n\n'
    + [regel('Bedrijfsnaam', c.bv), regel('Adres', bvDelen[0] || ''), regel('Postcode en plaats', bvDelen.slice(1).join(', '))].filter(Boolean).join('\n')
    + '\n\nhierbij vertegenwoordigd door ' + c.vertegenwoordiger + ',\nhierna te noemen: **"werkgever"**\n\nen\n\n'
    + [regel('Naam', c.naam), regel('Adres', c.adres), regel('Postcode en woonplaats', c.postcodePlaats), regel('Geboortedatum', c.geboortedatum), regel('Geboorteplaats', c.geboorteplaats), regel('BSN', c.bsn), regel('IBAN', c.iban)].filter(Boolean).join('\n')
    + '\n\nhierna te noemen: **"werknemer"**\n\nverklaren met elkaar een arbeidsovereenkomst aan te willen gaan, welke zij als volgt schriftelijk vastleggen:\n\n**ARBEIDSVOORWAARDEN**\n\n';
  tekst += arts.map(a => '**Artikel ' + nr[a.sleutel] + ' ' + a.titel + '**\n\n' + vulRef(a.tekst)).join('\n\n');
  // Ondertekening: werkgever op een lijn van underscores, werknemer op puntjes — P.maakOpgemaakteBrief zet de digitale
  // handtekening van de medewerker op de eerste puntjesregel ná een regel met "de werknemer".
  tekst += '\n\n\n**' + c.bv + '**\n' + c.vertegenwoordiger + '\n\n\n______________________________\nDatum:\n\n\n**De werknemer**\n' + c.naam + '\n\n\n................................................\nDatum:';
  tekst += '\n\n\n**BIJLAGE: HUISREGELS SLA**\n\nWe hebben er niet heel veel, maar de huisregels die we hebben vinden we ook echt heel belangrijk. Wat zijn de huisregels ook alweer?\n\n' + HUISREGELS.map(h => '- ' + h).join('\n');

  const vormTekst = f => (f.vorm === 'oproep' ? '0 uren' : String(f.uren).replace('.', ',') + ' u/wk') + ', ' + (f.loon === 'maand' && f.uren > 0 && f.uren < ft ? euro(naarRato(f.bedrag, f.uren, ft)) + '/mnd (fulltime ' + euro(f.bedrag) + ')' : euro(f.bedrag) + (f.loon === 'uur' ? '/uur' : '/mnd'));
  const samenvatting = [
    c.soort === 'bepaald' ? 'Bepaalde tijd ' + startNL + ' t/m ' + nl(c.eind) : 'Onbepaalde tijd vanaf ' + startNL,
    c.fasering ? 'Fase 1 t/m ' + nl(f1.tot) + ': ' + vormTekst(f1) + ' · Fase 2 vanaf ' + nl(f2.van) + ': ' + vormTekst(f2) : vormTekst(f1),
    c.ns ? 'NS Business Card (' + c.ns.klasse + ' klas' + (c.ns.prive ? ', ook privé' : '') + ')' : '',
    c.extra ? 'aanvullende afspraken' : ''
  ].filter(Boolean).join(' · ');
  return { tekst, titel: 'Arbeidsovereenkomst ' + c.functie + ' - ' + c.naam, samenvatting, fouten: ctl.fouten, let_op: ctl.let_op, c };
}

// Voor het logboek (hr_brieven): zonder BSN en IBAN
const redigeer = tekst => String(tekst || '').replace(/^\*\*BSN:\*\*.*$/m, '**BSN:** (alleen in de PDF)').replace(/^\*\*IBAN:\*\*.*$/m, '**IBAN:** (alleen in de PDF)');

module.exports = { naarRato, isHolding, fulltimeVan, bouw, lees, controleer, redigeer, eindVan, euro, parseDatum, nl, HUISREGELS };
