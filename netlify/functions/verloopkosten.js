// ============================================================
// Fase 5c: aannames voor de kosten van verloop (de berekening zelf zit in /api/scorekaart, veld `kosten`).
//   GET                         -> { params, standaard, posten, tarieven, perVervanging }
//   POST { params }             -> opslaan (alleen admin)
//   POST { herstel: true }      -> standaard terugzetten (alleen admin)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const VK = require('./_lib/verloopkosten');

exports.handler = beveiligd('verloopkosten', async (event, g) => {
  if (event.httpMethod === 'POST') {
    if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de aannames aanpassen.');
    const p = body(event);
    const nieuw = await VK.opslaan(p.herstel ? null : (p.params || {}), g.email);
    const pv = VK.perVervanging(nieuw);
    await logActie({ door: g.email, actie: 'instelling', bron: 'verloopkosten', veld: 'verloop_kosten', nieuw: 'EUR ' + pv.totaal, details: p.herstel ? 'standaard' : JSON.stringify(nieuw) });
    return { bericht: (p.herstel ? 'Standaard teruggezet' : 'Aannames opgeslagen') + ': één vervanging kost nu € ' + pv.totaal.toLocaleString('nl-NL') + '.', params: nieuw };
  }
  const { p, standaard } = await VK.params();
  return { params: p, standaard, posten: VK.POSTEN, tarieven: VK.TARIEVEN, perVervanging: VK.perVervanging(p) };
});
