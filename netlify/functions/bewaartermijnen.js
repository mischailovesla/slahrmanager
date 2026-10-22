// ============================================================
// /api/bewaartermijnen — v0.27.0 (Beheer → Bewaartermijnen)
// GET                                   -> overzicht: wie is over de termijn, per categorie, + logboeken
// POST {actie:'verwijder', keys:[...]}  -> (admin) verwijder/anonimiseer de gekozen personen; server rekent opnieuw
// POST {actie:'logboeken'}              -> (admin) logboeken ouder dan hun termijn opschonen
// Zie _lib/bewaartermijnen.js voor de regels.
// ============================================================
const { beveiligd, body } = require('./_lib/auth');
const B = require('./_lib/bewaartermijnen');

exports.handler = beveiligd('bewaartermijnen', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan gegevens definitief verwijderen.');
    if (p.actie === 'verwijder') {
      const r = await B.verwijderPersonen(p.keys, g.email);
      return Object.assign({ bericht: r.personen + ' persoon/personen opgeschoond: ' + r.rijen + ' regels verwijderd, ' + r.geanonimiseerd + ' geanonimiseerd, ' + r.bestanden + ' bestand(en) verwijderd' + (r.fouten.length ? ' · ' + r.fouten.length + ' fout(en)' : '') }, r);
    }
    if (p.actie === 'logboeken') {
      const r = await B.logboekenOpschonen(g.email);
      return { bericht: 'Logboeken opgeschoond: ' + r.map(x => x.tabel.replace(/^hr_/, '') + ' ' + x.verwijderd).join(', '), logboeken: r };
    }
    throw new Error('Onbekende actie');
  }
  const o = await B.overzicht();
  return Object.assign(o, { magVerwijderen: g.rol === 'admin' });
});
