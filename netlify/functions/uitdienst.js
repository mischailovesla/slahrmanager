// ============================================================
// v0.19.4: Bevestiging uitdiensttreding zonder handtekening
// GET  /api/uitdienst                               -> { actief }
// POST /api/uitdienst { actie:'voorbeeld', rij? }   -> { subject, html, pdf, bestandsnaam }  (rij leeg = voorbeeld met testgegevens)
// POST /api/uitdienst { actie:'bevestig', rij }     -> bevestiging naar de medewerker + salaris + archiveren (elke HR-rol)
// POST /api/uitdienst { actie:'actief', aan }       -> automatisch na de 3e herinnering aan/uit (alleen admin)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const UD = require('./_lib/uitdienst');
const I = require('./_lib/instellingen');
const S = require('./_lib/sheets');

const VOORBEELD = { rij: 0, naam: 'Voorbeeld Medewerker', email: 'voorbeeld@example.com', bedrijf: 'SLA Ceintuur BV', adres: 'Voorbeeldstraat 1, 1000 AA Amsterdam', opzegging: '01-10-2026', einddatum: '31-10-2026', verzenddatum: '02-10-2026 10:00', type: 'ontslag' };

exports.handler = beveiligd('uitdienst', async (event, g) => {
  if (event.httpMethod !== 'POST') return { actief: await UD.actief(), reactieDagen: UD.REACTIE_DAGEN };
  const p = body(event);
  if (p.actie === 'actief') {
    if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan dit aan- of uitzetten.');
    const aan = !!p.aan; I.vergeet(UD.SLEUTEL); await I.schrijf(UD.SLEUTEL, aan, g.email);
    await logActie({ door: g.email, actie: 'instelling', bron: 'ontslag', veld: UD.SLEUTEL, nieuw: aan ? 'aan' : 'uit', details: aan ? 'Bevestiging uitdiensttreding automatisch na de 3e herinnering: aan' : 'Bevestiging uitdiensttreding automatisch: uit' });
    return { actief: aan, bericht: aan ? 'Aan: na de 3e herinnering krijgt de medewerker automatisch een bevestiging van de uitdiensttreding, gaat er een seintje naar salaris en wordt het dossier gearchiveerd.' : 'Uit: na 3 herinneringen stopt het dashboard en blijft de taak staan; na 30 dagen wordt het dossier stil gearchiveerd.' };
  }
  const rij = parseInt(p.rij, 10) || 0;
  const r = rij ? (await S.getOntslag()).find(x => x.rij === rij) : VOORBEELD;
  if (!r) throw new Error('Dossier niet gevonden (rij ' + rij + ').');
  if (p.actie === 'voorbeeld') {
    if (rij) r.manager = await require('./_lib/allin').isManager({ email: r.email, naam: r.naam });
    const soort = rij ? await UD.soortVan(r) : 'ontslag', t = UD.teksten(r, soort), pdf = await UD.pdfVan(r, soort);
    return { subject: t.subject, html: t.html, pdf: pdf.toString('base64'), bestandsnaam: UD.bestandsnaam(r), soort };
  }
  if (p.actie === 'bevestig') {
    if (!rij) throw new Error('Kies een dossier.');
    const uit = await UD.bevestig(r, g.email);
    return { bericht: 'Uitdiensttreding van ' + r.naam + ' bevestigd' + (uit.salaris === 'verstuurd' ? ', salaris ingelicht' : '') + ' en dossier gearchiveerd.' };
  }
  throw new Error('Onbekende actie.');
});
