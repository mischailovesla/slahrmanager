// Gedeelde helpers - zelfde semantiek als in Code.gs
// v0.38.3: hoort een ingevulde naam bij deze persoon? Minstens één naamdeel van 3+ letters gemeen (voornaam of achternaam).
function naamPast(a, b) {
  const delen = x => normNaam(x).split(' ').filter(d => d.length >= 3);
  const A = delen(a), B = new Set(delen(b));
  if (!A.length || !B.size) return true; // te weinig om te beoordelen
  return A.some(d => B.has(d));
}
function normNaam(s) {
  s = String(s || '').toLowerCase();
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* noop */ }
  return s.replace(/[^a-z0-9]+/g, ' ').trim();
}

// dd-mm-yyyy (optioneel HH:mm) -> Date, anders null
// v0.43.2: ook 30.11.2026, 2026-11-30 en '30 november 2026' (vrij ingevulde einddatums in ontslagbrieven)
const MAANDEN_NL = { jan: 1, januari: 1, feb: 2, februari: 2, mrt: 3, maart: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, augustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12, january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10 };
function parseNLDatum(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = t.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/)) && MAANDEN_NL[m[2]]) return new Date(+m[3], MAANDEN_NL[m[2]] - 1, +m[1]);
  return null;
}

function dagenTot(datum, vanaf) {
  if (!datum) return null;
  const v = vanaf ? new Date(vanaf) : new Date();
  v.setHours(0, 0, 0, 0);
  return Math.round((datum - v) / 864e5);
}

function vandaagNL() {
  return new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

// Drive-URL -> weergavelink /file/d/<id>/view. Bewust NIET de uc?export=download-variant uit Code.gs:
// die gebruikt in Chrome altijd het eerste ingelogde Google-account en geeft dan "toegang aanvragen"
// bij collega's met meerdere accounts, ook al hebben ze rechten. De weergavelink laat van account wisselen.
function toDownloadUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  let m = url.match(/\/d\/([-\w]{25,})/);
  let id = m ? m[1] : '';
  if (!id) { m = url.match(/[?&]id=([-\w]{25,})/); if (m) id = m[1]; }
  return id ? 'https://drive.google.com/file/d/' + id + '/view' : url;
}

// Vind kolomindexen op kolomkop (vindResponseKolommen in Code.gs)
function vindKolommen(headerRij, specs) {
  const res = {};
  for (const k in specs) res[k] = -1;
  (headerRij || []).forEach((h, c) => {
    const hl = String(h || '').toLowerCase();
    for (const k in specs) {
      if (res[k] > -1) continue;
      if (specs[k].some(s => s && hl.indexOf(s) > -1)) res[k] = c;
    }
  });
  return res;
}

module.exports = { naamPast, normNaam, parseNLDatum, dagenTot, vandaagNL, toDownloadUrl, vindKolommen };
