// ============================================================
// v0.48.0: minimale xlsx-lezer zonder extra npm-pakket (zip.js + zlib).
//   lees(buf) -> { kop: [kolomnamen], rijen: [[waarden]] }  (eerste werkblad)
// Getallen blijven getallen (datums dus als Excel-serienummer), tekst blijft tekst.
// Genoeg voor de Shiftbase-export "Urenregistratie"; geen formules, geen opmaak.
// ============================================================
const Z = require('./zip');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function ontsnap(s) {
  return String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] != null ? ENT[e] : m;
  });
}
// Tekst uit een <si> of <is>: alle <t>-stukken achter elkaar (ook rich text)
function tekstVan(xml) { let s = '', m; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; while ((m = re.exec(xml))) s += m[1]; return ontsnap(s); }
function kolomIndex(ref) { const l = String(ref).replace(/\d+/g, ''); let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; }

function lees(buf) {
  let bestanden;
  try { bestanden = Z.lees(buf); } catch (e) { throw new Error('Dit is geen geldig Excel-bestand (.xlsx).'); }
  const vind = n => bestanden.find(b => b.naam === n);
  const shared = [];
  const ss = vind('xl/sharedStrings.xml');
  if (ss) { const x = ss.data.toString('utf8'); let m; const re = /<si>([\s\S]*?)<\/si>/g; while ((m = re.exec(x))) shared.push(tekstVan(m[1])); }
  // Eerste werkblad volgens workbook.xml + rels; anders sheet1.xml
  let pad = 'xl/worksheets/sheet1.xml';
  try {
    const wb = vind('xl/workbook.xml').data.toString('utf8'), rels = vind('xl/_rels/workbook.xml.rels').data.toString('utf8');
    const rid = (wb.match(/<sheet\s[^>]*r:id="([^"]+)"/) || [])[1];
    const doel = rid && (rels.match(new RegExp('<Relationship\\s[^>]*Id="' + rid + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('<Relationship\\s[^>]*Target="([^"]+)"[^>]*Id="' + rid + '"')) || [])[1];
    if (doel) pad = doel.startsWith('/') ? doel.slice(1) : 'xl/' + doel.replace(/^\.\//, '');
  } catch (e) { /* standaardpad */ }
  const blad = vind(pad) || bestanden.find(b => /^xl\/worksheets\/[^/]+\.xml$/.test(b.naam));
  if (!blad) throw new Error('Geen werkblad gevonden in het Excel-bestand.');
  const xml = blad.data.toString('utf8');
  const rijen = [];
  let rm; const reRij = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  while ((rm = reRij.exec(xml))) {
    const rij = []; const inhoud = rm[1] || '';
    let cm; const reCel = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    while ((cm = reCel.exec(inhoud))) {
      const attr = cm[1] || '', binnen = cm[2] || '';
      const ref = (attr.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const t = (attr.match(/\bt="(\w+)"/) || [])[1] || 'n';
      const v = (binnen.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let w = null;
      if (t === 's') w = v == null ? '' : (shared[parseInt(v, 10)] || '');
      else if (t === 'inlineStr') w = tekstVan(binnen);
      else if (t === 'str') w = ontsnap(v || '');
      else if (t === 'b') w = v === '1';
      else if (v != null && v !== '') w = Number(v);
      const i = ref ? kolomIndex(ref) : rij.length;
      rij[i] = w;
    }
    rijen.push(rij);
  }
  if (!rijen.length) return { kop: [], rijen: [] };
  const kop = rijen[0].map(k => String(k == null ? '' : k).trim());
  return { kop, rijen: rijen.slice(1).filter(r => r.some(x => x != null && x !== '')) };
}

module.exports = { lees, kolomIndex };
