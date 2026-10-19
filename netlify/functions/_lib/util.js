// Gedeelde helpers - zelfde semantiek als in Code.gs
function normNaam(s) {
  s = String(s || '').toLowerCase();
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* noop */ }
  return s.replace(/[^a-z0-9]+/g, ' ').trim();
}

// dd-mm-yyyy (optioneel HH:mm) -> Date, anders null
function parseNLDatum(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
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

module.exports = { normNaam, parseNLDatum, dagenTot, vandaagNL, toDownloadUrl, vindKolommen };
