// ============================================================
// HR-kant van digitaal ondertekenen (fase 6, ingelogd).
//   GET                                -> { rijen } (laatste 6 maanden)
//   POST { actie:'controleer', hash }  -> hoort een PDF bij een ondertekend (of verstuurd) document?
//   POST { actie:'intrekken', id }     -> open ondertekening intrekken (link werkt daarna niet meer)
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const ON = require('./_lib/ondertekening');

exports.handler = beveiligd('ondertekening-admin', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'controleer') return await ON.controleer(p.hash);
    if (p.actie === 'intrekken') {
      const { data, error } = await admin().from('hr_ondertekening').update({ status: 'ingetrokken', code_hash: null }).eq('id', p.id).eq('status', 'wacht').select('naam,titel');
      if (error) throw new Error(error.message);
      if (!data || !data.length) throw new Error('Niet gevonden of al ondertekend.');
      await logActie({ door: g.email, actie: 'teken-intrekken', bron: 'ondertekening', naam: data[0].naam, details: data[0].titel });
      return { bericht: 'Ingetrokken: ' + data[0].titel };
    }
    throw new Error('Onbekende actie');
  }
  return { rijen: await ON.overzicht() };
});
