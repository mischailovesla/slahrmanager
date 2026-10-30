// v0.35.2: keuzelijst nationaliteit voor het indiensttredingsformulier.
// euer = EU, EER (IJsland, Liechtenstein, Noorwegen) of Zwitserland: vrij werken in NL, geen extra controle op werkvergunning.
// Overige nationaliteiten → HR-controle (Wet arbeid vreemdelingen: verblijfsdocument / mag werken?).
// 'XX' = anders (vrije tekst). Nederlandse staat bovenaan, daarna alfabetisch op de Nederlandse naam.
const L = [
  ['NL', 'Nederlandse', 'Dutch', 1], ['BE', 'Belgische', 'Belgian', 1], ['BG', 'Bulgaarse', 'Bulgarian', 1], ['CY', 'Cypriotische', 'Cypriot', 1], ['DK', 'Deense', 'Danish', 1],
  ['DE', 'Duitse', 'German', 1], ['EE', 'Estse', 'Estonian', 1], ['FI', 'Finse', 'Finnish', 1], ['FR', 'Franse', 'French', 1], ['GR', 'Griekse', 'Greek', 1],
  ['HU', 'Hongaarse', 'Hungarian', 1], ['IE', 'Ierse', 'Irish', 1], ['IT', 'Italiaanse', 'Italian', 1], ['HR', 'Kroatische', 'Croatian', 1], ['LV', 'Letse', 'Latvian', 1],
  ['LT', 'Litouwse', 'Lithuanian', 1], ['LU', 'Luxemburgse', 'Luxembourgish', 1], ['MT', 'Maltese', 'Maltese', 1], ['AT', 'Oostenrijkse', 'Austrian', 1], ['PL', 'Poolse', 'Polish', 1],
  ['PT', 'Portugese', 'Portuguese', 1], ['RO', 'Roemeense', 'Romanian', 1], ['SI', 'Sloveense', 'Slovenian', 1], ['SK', 'Slowaakse', 'Slovak', 1], ['ES', 'Spaanse', 'Spanish', 1],
  ['CZ', 'Tsjechische', 'Czech', 1], ['SE', 'Zweedse', 'Swedish', 1], ['IS', 'IJslandse', 'Icelandic', 1], ['LI', 'Liechtensteinse', 'Liechtenstein', 1], ['NO', 'Noorse', 'Norwegian', 1],
  ['CH', 'Zwitserse', 'Swiss', 1],
  ['AF', 'Afghaanse', 'Afghan', 0], ['AL', 'Albanese', 'Albanian', 0], ['DZ', 'Algerijnse', 'Algerian', 0], ['US', 'Amerikaanse', 'American', 0], ['AR', 'Argentijnse', 'Argentinian', 0],
  ['AM', 'Armeense', 'Armenian', 0], ['AU', 'Australische', 'Australian', 0], ['BY', 'Belarussische', 'Belarusian', 0], ['BA', 'Bosnische', 'Bosnian', 0], ['BR', 'Braziliaanse', 'Brazilian', 0],
  ['GB', 'Britse', 'British', 0], ['CA', 'Canadese', 'Canadian', 0], ['CL', 'Chileense', 'Chilean', 0], ['CN', 'Chinese', 'Chinese', 0], ['CO', 'Colombiaanse', 'Colombian', 0],
  ['EG', 'Egyptische', 'Egyptian', 0], ['ER', 'Eritrese', 'Eritrean', 0], ['ET', 'Ethiopische', 'Ethiopian', 0], ['PH', 'Filipijnse', 'Filipino', 0], ['GE', 'Georgische', 'Georgian', 0],
  ['GH', 'Ghanese', 'Ghanaian', 0], ['IN', 'Indiase', 'Indian', 0], ['ID', 'Indonesische', 'Indonesian', 0], ['IQ', 'Iraakse', 'Iraqi', 0], ['IR', 'Iraanse', 'Iranian', 0],
  ['IL', 'Israëlische', 'Israeli', 0], ['JP', 'Japanse', 'Japanese', 0], ['CV', 'Kaapverdische', 'Cape Verdean', 0], ['XK', 'Kosovaarse', 'Kosovar', 0], ['LB', 'Libanese', 'Lebanese', 0],
  ['MA', 'Marokkaanse', 'Moroccan', 0], ['MX', 'Mexicaanse', 'Mexican', 0], ['MD', 'Moldavische', 'Moldovan', 0], ['ME', 'Montenegrijnse', 'Montenegrin', 0], ['NZ', 'Nieuw-Zeelandse', 'New Zealander', 0],
  ['NG', 'Nigeriaanse', 'Nigerian', 0], ['MK', 'Noord-Macedonische', 'North Macedonian', 0], ['UA', 'Oekraïense', 'Ukrainian', 0], ['PK', 'Pakistaanse', 'Pakistani', 0], ['PE', 'Peruaanse', 'Peruvian', 0],
  ['RU', 'Russische', 'Russian', 0], ['RS', 'Servische', 'Serbian', 0], ['SO', 'Somalische', 'Somali', 0], ['SR', 'Surinaamse', 'Surinamese', 0], ['SY', 'Syrische', 'Syrian', 0],
  ['TH', 'Thaise', 'Thai', 0], ['TN', 'Tunesische', 'Tunisian', 0], ['TR', 'Turkse', 'Turkish', 0], ['VE', 'Venezolaanse', 'Venezuelan', 0], ['VN', 'Vietnamese', 'Vietnamese', 0],
  ['ZA', 'Zuid-Afrikaanse', 'South African', 0], ['KR', 'Zuid-Koreaanse', 'South Korean', 0]
];
const NATIONALITEITEN = [L[0]].concat(L.slice(1).sort((a, b) => a[1].localeCompare(b[1], 'nl'))).map(x => ({ code: x[0], nl: x[1], en: x[2], euer: !!x[3] }))
  .concat([{ code: 'XX', nl: 'Anders, namelijk…', en: 'Other…', euer: false }]);
const PER_CODE = Object.fromEntries(NATIONALITEITEN.map(x => [x.code, x]));
module.exports = { NATIONALITEITEN, PER_CODE };
