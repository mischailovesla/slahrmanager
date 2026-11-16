// ============================================================
// v0.49.0 /api/declaraties — HR-kant van de declaraties uit SLA Academy.
//   GET  ?status=open|betaald|afgewezen|alle            -> { rijen, tellingen, openBedrag }
//   POST { actie:'betaald', ids:[...], datum? }          -> zet ingediende declaraties op betaald (datum = vandaag als leeg)
//   POST { actie:'afgewezen', id, reden, mail? }         -> afwijzen met reden; medewerker krijgt een mail (tenzij mail:false)
//   POST { actie:'heropen', id }                         -> terug naar 'ingediend'
//   POST { actie:'bon', id }                             -> { url } tijdelijke link naar het bonnetje
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const D = require('./_lib/declaraties');
const M = require('./_lib/mail');

const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = n => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumNL = iso => iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : '';

function afwijsMail(r, reden) {
  const en = r.taal === 'en', voornaam = String(r.naam || '').split(' ')[0];
  const regel = en ? (eur(r.bedrag) + ' at ' + r.leverancier + ' on ' + datumNL(r.aankoop_datum)) : (eur(r.bedrag) + ' bij ' + r.leverancier + ' op ' + datumNL(r.aankoop_datum));
  const subject = en ? 'Your expense claim was not approved' : 'Je declaratie is niet goedgekeurd';
  const text = en
    ? 'Hi ' + voornaam + ',\n\nYour expense claim (' + regel + ') was not approved.\n\nReason: ' + reden + '\n\nYou can submit a corrected claim in SLA Academy (Profile → Expenses). Questions? Just reply to this email.\n\nKind regards,\nSLA HR Team'
    : 'Hoi ' + voornaam + ',\n\nJe declaratie (' + regel + ') is niet goedgekeurd.\n\nReden: ' + reden + '\n\nJe kunt een verbeterde declaratie indienen in SLA Academy (Profiel → Declaraties). Vragen? Beantwoord gewoon deze mail.\n\nGroet,\nSLA HR Team';
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#333d3a;line-height:1.5">' + escH(text).replace(/\n/g, '<br>') + '</div>';
  return { subject, text, html };
}

exports.handler = beveiligd('declaraties', async (event, g) => {
  const db = admin();
  if (event.httpMethod === 'GET') {
    const st = (event.queryStringParameters || {}).status || 'open';
    let q = db.from('hr_declaraties').select('*').order('created_at', { ascending: false }).limit(1000);
    if (st === 'open') q = q.eq('status', 'ingediend');
    else if (D.STATUS.includes(st)) q = q.eq('status', st);
    const [r, t] = await Promise.all([q, db.from('hr_declaraties').select('status,bedrag,email,aankoop_datum')]);
    if (r.error) {
      if (/hr_declaraties/.test(r.error.message)) return { ontbreekt: true, rijen: [], tellingen: {}, openBedrag: 0 };
      throw new Error(r.error.message);
    }
    const alle = D.markeerDubbel((t.data || []).map(x => Object.assign({}, x)));
    const dubbelSet = new Set(alle.filter(x => x.dubbel).map(x => x.email + '|' + x.aankoop_datum + '|' + Number(x.bedrag).toFixed(2)));
    const tellingen = { ingediend: 0, betaald: 0, afgewezen: 0 }; let openBedrag = 0;
    alle.forEach(x => { tellingen[x.status] = (tellingen[x.status] || 0) + 1; if (x.status === 'ingediend') openBedrag += Number(x.bedrag); });
    const rijen = (r.data || []).map(x => ({ id: x.id, ingediend: x.created_at, naam: x.naam, email: x.email, winkel: x.winkel, winkel_code: x.winkel_code, datum: x.aankoop_datum, leverancier: x.leverancier,
      bedrag: Number(x.bedrag), omschrijving: x.omschrijving, iban: D.ibanMooi(x.iban), iban_naam: x.iban_naam, bon_mime: (x.bon || {}).mime || '', status: x.status, betaald_op: x.betaald_op, reden: x.afgewezen_reden || '',
      verwerkt_door: x.verwerkt_door || '', verwerkt_op: x.verwerkt_op, dubbel: x.status !== 'afgewezen' && dubbelSet.has(x.email + '|' + x.aankoop_datum + '|' + Number(x.bedrag).toFixed(2)) }));
    return { rijen, tellingen, openBedrag: Math.round(openBedrag * 100) / 100 };
  }

  const p = body(event);
  if (p.actie === 'bon') {
    const { data: r } = await db.from('hr_declaraties').select('bon,naam').eq('id', String(p.id || '')).maybeSingle();
    if (!r) throw new Error('Declaratie niet gevonden.');
    if (r.bon && r.bon.drive) return { url: r.bon.drive };   // overgezet uit het Google Form: bonnetje staat in Drive
    const { data, error } = await db.storage.from(D.BUCKET).createSignedUrl(r.bon.pad, 300);
    if (error) throw new Error('Opslag: ' + error.message);
    return { url: data.signedUrl };
  }
  if (p.actie === 'betaald') {
    const ids = (Array.isArray(p.ids) ? p.ids : [p.id]).map(String).filter(Boolean);
    if (!ids.length) throw new Error('Geen declaraties gekozen.');
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(p.datum || '')) ? p.datum : D.isoVandaag();
    const { data, error } = await db.from('hr_declaraties').update({ status: 'betaald', betaald_op: datum, verwerkt_door: g.email, verwerkt_op: new Date().toISOString(), afgewezen_reden: null })
      .in('id', ids).eq('status', 'ingediend').select('id,naam,bedrag');
    if (error) throw new Error(error.message);
    for (const x of data || []) await logActie({ door: g.email, actie: 'declaratie', bron: 'declaraties', veld: 'betaald', naam: x.naam, nieuw: datum, details: x.id + ' · ' + eur(x.bedrag) });
    return { aantal: (data || []).length, totaal: (data || []).reduce((a, x) => a + Number(x.bedrag), 0) };
  }
  if (p.actie === 'afgewezen') {
    const reden = String(p.reden || '').trim().slice(0, 500);
    if (reden.length < 3) throw new Error('Geef een reden op (de medewerker krijgt die te zien).');
    const { data: r, error } = await db.from('hr_declaraties').update({ status: 'afgewezen', afgewezen_reden: reden, betaald_op: null, verwerkt_door: g.email, verwerkt_op: new Date().toISOString() })
      .eq('id', String(p.id || '')).eq('status', 'ingediend').select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error('Declaratie niet gevonden of al verwerkt.');
    await logActie({ door: g.email, actie: 'declaratie', bron: 'declaraties', veld: 'afgewezen', naam: r.naam, nieuw: reden, details: r.id + ' · ' + eur(r.bedrag) });
    let mail = '';
    if (p.mail !== false) {
      try {
        const m = afwijsMail(r, reden), id = await M.verstuur({ to: r.email, subject: m.subject, text: m.text, html: m.html, tags: [{ name: 'bron', value: 'declaratie' }] });
        await M.logMail({ door: g.email, bron: 'declaraties', type: 'afgewezen', naar: r.email, naam: r.naam, onderwerp: m.subject, taal: r.taal, resend_id: id });
        mail = 'verstuurd';
      } catch (e) { mail = 'mislukt: ' + e.message; }
    }
    return { mail };
  }
  if (p.actie === 'heropen') {
    const { data: r, error } = await db.from('hr_declaraties').update({ status: 'ingediend', betaald_op: null, afgewezen_reden: null, verwerkt_door: null, verwerkt_op: null })
      .eq('id', String(p.id || '')).select('id,naam,status').maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error('Declaratie niet gevonden.');
    await logActie({ door: g.email, actie: 'declaratie', bron: 'declaraties', veld: 'heropend', naam: r.naam, details: r.id });
    return {};
  }
  throw new Error('Onbekende actie');
});
// voor tests
exports._afwijsMail = afwijsMail;
