// ============================================================
// GET /api/export?tabel=hr_loonheffing[&archief=1]  -> {bestandsnaam, csv} (Excel-vriendelijk: ; en BOM)
// GET /api/export                                      -> lijst van tabellen met aantallen
// Vervangt "even in de sheet kijken" na de overstap naar Supabase (stap 6).
// Leest rechtstreeks uit de Supabase-tabellen (migratie 0006), ongeacht DATA_BRON.
// ============================================================
const { beveiligd, admin, logActie } = require('./_lib/auth');
const T = require('./_lib/tabellen');

function csvCel(v) { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

exports.handler = beveiligd('export', async (event, g) => {
  const qs = event.queryStringParameters || {};
  if (!qs.tabel) {
    const uit = [];
    for (const [naam, d] of Object.entries(T.TABELLEN)) {
      const { count } = await admin().from(naam).select('rij', { count: 'exact', head: true }).is('gearchiveerd_op', null);
      const { count: arch } = await admin().from(naam).select('rij', { count: 'exact', head: true }).not('gearchiveerd_op', 'is', null);
      uit.push({ tabel: naam, label: d.label, rijen: count || 0, archief: arch || 0 });
    }
    return { tabellen: uit };
  }
  const tabel = String(qs.tabel);
  const d = T.TABELLEN[tabel]; if (!d) throw new Error('Onbekende tabel: ' + tabel);
  const metArchief = qs.archief === '1';
  const rijen = [];
  for (let van = 0; ; van += 1000) {
    let q = admin().from(tabel).select('*').order('rij', { ascending: true }).range(van, van + 999);
    if (!metArchief) q = q.is('gearchiveerd_op', null);
    const { data, error } = await q; if (error) throw new Error(error.message);
    rijen.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  const kol = T.kolomNamen(tabel), kop = ['Rij'].concat(T.koppen(tabel));
  if (metArchief) kop.push('Gearchiveerd op', 'Door', 'Bron');
  const regels = [kop.map(csvCel).join(';')];
  for (const r of rijen) {
    const cells = [r.rij].concat(kol.map(k => r[k]));
    if (metArchief) cells.push(r.gearchiveerd_op || '', r.gearchiveerd_door || '', r.gearchiveerd_bron || '');
    if (Array.isArray(r.extra) && r.extra.length) cells.push(...r.extra);
    regels.push(cells.map(csvCel).join(';'));
  }
  await logActie({ door: g.email, actie: 'export', bron: tabel, details: rijen.length + ' rijen' + (metArchief ? ' incl. archief' : '') });
  const naam = d.label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  // JSON met de CSV-tekst: de frontend maakt er een download van (zelfde patroon als dossier-pdf, want de
  // Authorization-header kan niet mee in een gewone link).
  return { bestandsnaam: naam, aantal: rijen.length, csv: '﻿' + regels.join('\r\n') };
});
