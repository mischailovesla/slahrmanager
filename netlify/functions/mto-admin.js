// ============================================================
// HR-kant van het MTO (fase 5, ingelogd).
//   GET  /api/mto-admin?ronde=<id>&groep=alle|medewerker|manager&winkel=  -> rapport + rondes + open ronde
//   GET  /api/mto-admin?kandidaten=1                                       -> wie er een uitnodiging zou krijgen
//   GET  /api/mto-admin?csv=<ronde id>                                     -> anonieme CSV
//   GET  /api/mto-admin?pdf=winkel|sla|bundel&ronde&groep&winkel           -> PDF-rapport (base64)
//   POST { actie:'start', naam? }       -> ronde starten + eerste blok mails (rest: actie 'versturen', herhaald)
//   POST { actie:'versturen', ronde }   -> volgende blok uitnodigingen
//   POST { actie:'sluiten', ronde }     -> ronde nu sluiten
//   POST { actie:'nulmeting' }          -> Google-Forms-resultaten van februari 2026 importeren (één keer)
//   POST { actie:'voorbeeld', taal, groep } -> voorbeeldlink (slaat niets op)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const MTO = require('./_lib/mto');
const U = require('./_lib/uploads');

exports.handler = beveiligd('mto-admin', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'voorbeeld') return { link: U.site() + '/mto.html?t=' + U.tekenToken({ s: 'mto', i: p.groep === 'manager' ? 'voorbeeld-manager' : 'voorbeeld' }) + (String(p.taal).toUpperCase() === 'EN' ? '&taal=en' : '') };
    if (p.actie === 'start') {
      const r = await MTO.start(g.email, p.naam);
      await logActie({ door: g.email, actie: 'mto-start', bron: 'mto', veld: r.ronde.naam, nieuw: String(r.aantal), details: r.aantal + ' uitnodigingen' + (r.zonderEmail.length ? ', ' + r.zonderEmail.length + ' zonder e-mail' : '') + (r.vertrekkers ? ', ' + r.vertrekkers + ' vertrekkers overgeslagen' : '') });
      const d = await MTO.versturenDeel(r.ronde.id, g.email, 6000);
      return { ronde: r.ronde.id, naam: r.ronde.naam, aantal: r.aantal, zonderEmail: r.zonderEmail.map(x => x.naam), vertrekkers: r.vertrekkers, verstuurd: d.verstuurd, rest: d.rest };
    }
    if (p.actie === 'versturen') { if (!p.ronde) throw new Error('Geen ronde opgegeven.'); return await MTO.versturenDeel(p.ronde, g.email, 7000); }
    if (p.actie === 'sluiten') {
      if (!p.ronde) throw new Error('Geen ronde opgegeven.');
      const r = await MTO.sluiten(p.ronde, g.email); if (!r) throw new Error('Ronde niet gevonden of al gesloten.');
      await logActie({ door: g.email, actie: 'mto-sluiten', bron: 'mto', veld: r.naam });
      return { bericht: r.naam + ' is gesloten. De link werkt niet meer.' };
    }
    if (p.actie === 'nulmeting') {
      const r = await MTO.importNulmeting(g.email);
      await logActie({ door: g.email, actie: 'mto-import', bron: 'mto', veld: r.naam, nieuw: String(r.aantal) });
      return { ronde: r.id, bericht: r.aantal + ' reacties van de ' + r.naam.toLowerCase() + ' geïmporteerd.' };
    }
    throw new Error('Onbekende actie');
  }
  const q = event.queryStringParameters || {};
  if (q.kandidaten) {
    const k = await MTO.kandidaten();
    const tel = {}; k.uit.forEach(x => { tel[x.groep] = (tel[x.groep] || 0) + 1; });
    return { aantal: k.uit.length, perGroep: tel, zonderEmail: k.zonderEmail.map(x => ({ naam: x.naam, winkel: x.winkel })), vertrekkers: k.vertrekkers.length,
      managers: k.uit.filter(x => x.groep === 'manager').map(x => ({ naam: x.naam, winkel: x.winkel, functie: x.functie })) };
  }
  if (q.csv) return { csv: await MTO.exportCsv(q.csv) };
  if (q.pdf) {
    const PDF = require('./_lib/mto-pdf');
    const res = await MTO.pdfSecties(q.ronde || null, q.groep || 'alle', q.pdf === 'sla' ? '' : q.pdf === 'bundel' ? '*' : String(q.winkel || ''));
    const buf = await PDF.maakMtoPdf(res, g.email);
    await logActie({ door: g.email, actie: 'mto-rapport', bron: 'mto', veld: res.ronde.naam, nieuw: q.pdf === 'winkel' ? String(q.winkel || '') : q.pdf });
    return { pdf: buf.toString('base64'), bestandsnaam: PDF.bestandsnaam(res), overgeslagen: res.overgeslagen || [] };
  }
  const r = await MTO.rapport(q.ronde || null, q.groep || 'alle', q.winkel || '');
  r.open = r.rondes.find(x => x.status === 'open') || null;
  r.nulmetingGedaan = r.rondes.some(x => x.bron === 'import');
  r.instellingen = { minN: MTO.MIN_N, looptijd: MTO.LOOPTIJD, herinner: MTO.HERINNER, maanden: MTO.MAANDEN };
  return r;
});
