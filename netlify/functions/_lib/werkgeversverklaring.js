// ============================================================
// v0.55.0: Werkgeversverklaring (employer's statement) — bijv. als bewijs van inkomen voor een huurwoning of hypotheek.
// Bouwt de tekst (NL of EN) uit de gegevens van het dossier + het bruto salaris, controleert het formulier en
// maakt de versie voor het logboek zónder salaris (zie redigeer()).
// Opmaak voor P.maakOpgemaakteBrief: **vet**, "- " = opsomming, lege regel = nieuwe alinea, {{HANDTEKENING}}.
// Salaris is gevoelig: alleen personen met salarisinzage (salarisinzage.js) mogen de verklaring opstellen.
// ============================================================
const CATEGORIE = 'Werkgeversverklaring';
const MAANDEN_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MAANDEN_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 'yyyy-mm-dd' of 'dd-mm-yyyy' -> Date (lokale middernacht), anders null
function parseDatum(s) {
  const t = String(s || '').trim(); let m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const datumLang = (d, en) => d ? (en ? MAANDEN_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : d.getDate() + ' ' + MAANDEN_NL[d.getMonth()] + ' ' + d.getFullYear()) : '';
const dagStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function bedrag(v) {
  let s = String(v == null ? '' : v).replace(/[€\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Number(s); return isFinite(n) && n > 0 ? n : 0;
}
const euro = v => { const n = bedrag(v); return n ? '€ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; };
const getal = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const urenTekst = n => String(n).replace('.', ',');

// Een nulurencontract / oproepcontract? Shiftbase-type "Nul uren", "Oproep", "Flex" …
const isOproepType = t => /nul\s*uren|0\s*uren|oproep|flex|zero|on[- ]?call/i.test(String(t || ''));

// p = { naam, functie, bv, bvAdres, startdatum, einddatum, soort ('bepaald'|'onbepaald'), vorm ('vast'|'oproep'),
//       uren, loonsoort ('maand'|'uur'), bedrag, toeslag (% vakantietoeslag), proeftijd (maanden, leeg = niet noemen),
//       doel (vrije tekst, optioneel), taal ('EN'|'NL'), afzenderNaam, afzenderFunctie, datum (override, voor tests) }
function bouw(p, nu) {
  p = p || {}; nu = nu || new Date();
  const fouten = [], let_op = [];
  const en = String(p.taal || 'EN').toUpperCase() !== 'NL';
  const c = {
    naam: String(p.naam || '').trim(), functie: String(p.functie || '').trim(), bv: String(p.bv || '').trim(), bvAdres: String(p.bvAdres || '').trim(),
    soort: p.soort === 'onbepaald' ? 'onbepaald' : 'bepaald', vorm: p.vorm === 'oproep' ? 'oproep' : 'vast',
    loonsoort: p.loonsoort === 'uur' ? 'uur' : 'maand', doel: String(p.doel || '').trim().slice(0, 160), en,
    afzenderNaam: String(p.afzenderNaam || '').trim(), afzenderFunctie: String(p.afzenderFunctie || '').trim()
  };
  c.start = parseDatum(p.startdatum); c.eind = parseDatum(p.einddatum);
  c.uren = getal(p.uren); c.bedrag = bedrag(p.bedrag);
  c.toeslag = String(p.toeslag == null || p.toeslag === '' ? '' : p.toeslag).replace('%', '').trim();
  c.proeftijd = String(p.proeftijd == null ? '' : p.proeftijd).trim();

  if (!c.naam) fouten.push('Vul de naam van de medewerker in.');
  if (!c.functie) fouten.push('Vul de functie in.');
  if (!c.bv) fouten.push('Vul de werkgever (BV) in.');
  if (!c.start) fouten.push('Vul de startdatum van het dienstverband in.');
  if (c.soort === 'bepaald') {
    if (!c.eind) fouten.push('Een contract voor bepaalde tijd heeft een einddatum.');
    else if (c.start && c.eind < c.start) fouten.push('De einddatum ligt vóór de startdatum.');
  }
  if (c.vorm === 'vast' && !(c.uren > 0 && c.uren <= 60)) fouten.push('Vul het aantal contracturen per week in (1 t/m 60).');
  if (!c.bedrag) fouten.push('Vul het bruto ' + (c.loonsoort === 'uur' ? 'uurloon' : 'maandsalaris') + ' in.');
  if (c.vorm === 'oproep' && c.loonsoort === 'maand') fouten.push('Bij een nulurencontract hoort een uurloon, geen maandsalaris.');
  if (c.toeslag !== '' && !(getal(c.toeslag) >= 0 && getal(c.toeslag) <= 20)) fouten.push('Vakantietoeslag: vul een percentage in (bijv. 8).');
  if (c.proeftijd !== '' && !(getal(c.proeftijd) >= 0 && getal(c.proeftijd) <= 2)) fouten.push('Proeftijd: 0, 1 of 2 maanden (of laat leeg).');

  const vandaag = dagStart(nu);
  if (c.start && dagStart(c.start) > vandaag) let_op.push('De medewerker is nog niet in dienst (start ' + datumLang(c.start) + '). De verklaring zegt "treedt in dienst" en is nog geen bewijs van loonbetaling: een verhuurder vraagt soms ook loonstroken.');
  if (c.vorm === 'oproep') let_op.push('Nulurencontract: er staat geen vast aantal uren in. Als bewijs van inkomen is dat zwak, de verhuurder of bank kan er minder mee.');
  if (c.soort === 'bepaald' && c.eind && c.start && c.eind >= c.start) let_op.push('Tijdelijk contract: de verklaring vermeldt de einddatum ' + datumLang(c.eind) + '. Zeg nooit "vast contract" tegen de medewerker zolang dit zo is.');
  if (c.soort === 'bepaald' && c.eind && dagStart(c.eind) < vandaag) let_op.push('De einddatum van het contract ligt al in het verleden.');
  if (!c.afzenderNaam) let_op.push('Er is geen afzendernaam bekend. Stel je naam en handtekening in via "Mijn handtekening".');
  if (c.bedrag && c.loonsoort === 'maand' && c.bedrag < 500) let_op.push('Het ingevulde maandsalaris is wel erg laag. Klopt het bedrag?');

  const L = en ? EN : NL;
  const toeslagTxt = c.toeslag !== '' && getal(c.toeslag) > 0 ? L.exclToeslag(urenTekst(getal(c.toeslag))) : L.zonderToeslag;
  const begin = c.start && dagStart(c.start) > vandaag, regels = [];
  regels.push('**' + L.titel + '**', '', L.datum + ': ' + datumLang(c.datum || nu, en), '', L.aanhef, '');
  regels.push(L.bevestigt(c.bv, c.bvAdres, begin), '');
  regels.push('- **' + L.naam + ':** ' + c.naam);
  regels.push('- **' + L.functie + ':** ' + c.functie);
  regels.push('- **' + L.werkgever + ':** ' + c.bv + (c.bvAdres ? ', ' + c.bvAdres : ''));
  regels.push('- **' + (begin ? L.start : L.sinds) + ':** ' + datumLang(c.start, en));
  regels.push('- **' + L.soort + ':** ' + (c.soort === 'onbepaald' ? L.onbepaald : L.bepaald(datumLang(c.eind, en))));
  regels.push('- **' + L.uren + ':** ' + (c.vorm === 'oproep' ? L.oproep : L.perWeek(urenTekst(c.uren))));
  if (c.proeftijd !== '' && getal(c.proeftijd) > 0) regels.push('- **' + L.proeftijd + ':** ' + L.proeftijdTxt(getal(c.proeftijd)));
  regels.push('- **' + (c.loonsoort === 'uur' ? L.uurloon : L.maandsalaris) + ':** ' + euro(c.bedrag) + (toeslagTxt ? ' ' + toeslagTxt : ''));
  regels.push('');
  regels.push(L.verzoek(c.doel));
  regels.push('', L.vragen, '', L.groet, '', '{{HANDTEKENING}}');
  regels.push('**' + (c.afzenderNaam || 'SLA HR Team') + '**');
  if (c.afzenderFunctie) regels.push(c.afzenderFunctie);
  regels.push(c.bv);
  const tekst = regels.join('\n');
  const titel = L.titel + ' - ' + c.naam;
  const samenvatting = c.naam + ' · ' + c.functie + ' · ' + c.bv + ' · ' + (c.soort === 'onbepaald' ? 'onbepaalde tijd' : 'tot ' + datumLang(c.eind)) + ' · ' + (c.vorm === 'oproep' ? 'oproep' : urenTekst(c.uren) + ' u/week') + ' · ' + euro(c.bedrag) + (c.loonsoort === 'uur' ? ' per uur' : ' per maand') + ' · ' + (en ? 'EN' : 'NL');
  return { fouten, let_op, tekst, titel, samenvatting, c };
}

const NL = {
  titel: 'Werkgeversverklaring', datum: 'Datum', aanhef: 'Aan wie het mag aangaan,',
  bevestigt: (bv, adres, begin) => 'Hierbij bevestigt ' + bv + (adres ? ', gevestigd te ' + adres : '') + ', dat onderstaande medewerker bij ons ' + (begin ? 'in dienst treedt' : 'in dienst is') + ', onder de volgende voorwaarden:',
  naam: 'Naam', functie: 'Functie', werkgever: 'Werkgever', start: 'In dienst vanaf', sinds: 'In dienst sinds', soort: 'Soort contract',
  onbepaald: 'Arbeidsovereenkomst voor onbepaalde tijd', bepaald: e => 'Arbeidsovereenkomst voor bepaalde tijd, eindigend van rechtswege op ' + e,
  uren: 'Contracturen', oproep: 'Oproepbasis (geen vast aantal uren)', perWeek: u => u + ' uur per week',
  proeftijd: 'Proeftijd', proeftijdTxt: n => 'De arbeidsovereenkomst bevat een proeftijd van ' + n + ' ' + (n === 1 ? 'maand' : 'maanden'),
  maandsalaris: 'Bruto maandsalaris', uurloon: 'Bruto uurloon',
  exclToeslag: pct => '(exclusief ' + pct + '% vakantietoeslag)', zonderToeslag: '',
  verzoek: doel => 'Deze verklaring is op verzoek van de medewerker opgesteld' + (doel ? ' ' + doel : '') + ' en is juist op de datum waarop zij is afgegeven.',
  vragen: 'Heeft u vragen? Neem dan contact met ons op via hr@ilovesla.com.', groet: 'Met vriendelijke groet,'
};
const EN = {
  titel: 'Employer\'s statement', datum: 'Date', aanhef: 'To whom it may concern,',
  bevestigt: (bv, adres, begin) => 'Hereby ' + bv + (adres ? ', located at ' + adres : '') + ', confirms that the employee below ' + (begin ? 'will start employment with us' : 'is employed by us') + ', under the following terms:',
  naam: 'Name', functie: 'Position', werkgever: 'Employer', start: 'Employment starts', sinds: 'Employed since', soort: 'Type of contract',
  onbepaald: 'Employment agreement for an indefinite period', bepaald: e => 'Fixed-term employment agreement, ending automatically on ' + e,
  uren: 'Contract hours', oproep: 'On-call basis (no fixed number of hours)', perWeek: u => u + ' hours per week',
  proeftijd: 'Probationary period', proeftijdTxt: n => 'The employment agreement includes a probationary period of ' + n + ' ' + (n === 1 ? 'month' : 'months'),
  maandsalaris: 'Gross monthly salary', uurloon: 'Gross hourly wage',
  exclToeslag: pct => '(excluding ' + pct + '% holiday allowance)', zonderToeslag: '',
  verzoek: doel => 'This statement was issued at the request of the employee' + (doel ? ' ' + doel : '') + ' and is accurate as of the date of issue.',
  vragen: 'If you have any questions, please contact us at hr@ilovesla.com.', groet: 'Kind regards,'
};

// Logboek: salaris eruit (de logregel is voor alle HR-gebruikers zichtbaar in het dossier, onder Vrije brieven)
function redigeer(tekst) {
  return String(tekst || '').replace(/^(- \*\*(?:Bruto maandsalaris|Bruto uurloon|Gross monthly salary|Gross hourly wage):\*\* ).*$/gm, '$1€ •••');
}

module.exports = { CATEGORIE, bouw, redigeer, parseDatum, datumLang, isOproepType, euro, bedrag };
