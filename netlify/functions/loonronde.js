// ============================================================
// v0.56.0: Loonadministratie — de maandelijkse aanlevering aan Mahdia (HRM Online)
// GET  /api/loonronde?jaar&maand                  -> checklist (4 stappen met deadline, afgevinkt of niet)
// GET  /api/loonronde?stap=uurloners&jaar&maand   -> uren per uurloner (per BV/winkel) + ziektecontrole (6e); &ververs=1 = opnieuw uit Shiftbase
// GET  /api/loonronde?stap=mutaties&jaar&maand    -> mutaties vastloners + wachtdagen + uitdienst + concept-mail (18e)
// POST /api/loonronde {actie:'afvinken', jaar, maand, stap, klaar}      -> stap (de)afvinken
// POST /api/loonronde {actie:'export', jaar, maand}                     -> Excel met uren + ziektecontrole ({ base64, bestandsnaam })
// POST /api/loonronde {actie:'mail', jaar, maand, onderwerp, tekst, opnieuw?} -> mail naar salarisadministratie (cc jezelf), vinkt mutaties + uitdienst af
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const L = require('./_lib/loonronde');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');
const D = require('./_lib/datum');

const voornaam = n => String(n || '').trim().split(/\s+/)[0] || 'HR';

exports.handler = beveiligd('loonronde', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event), per = L.periode(p.jaar, p.maand);
    if (p.actie === 'afvinken') {
      const st = await L.zetStap(per.jaar, per.maand, String(p.stap || ''), !!p.klaar, g.email);
      await logActie({ door: g.email, actie: 'loonronde', bron: 'loonronde', veld: String(p.stap), nieuw: p.klaar ? 'klaar' : 'open', details: per.label + ': ' + p.stap + (p.klaar ? ' afgevinkt' : ' weer open gezet') });
      return { stappen: L.stappenOverzicht(per.jaar, per.maand, st), mail: st.mail };
    }
    if (p.actie === 'export') {
      const res = await L.laadUurloners(per.jaar, per.maand, false);
      const buf = L.maakXlsx(L.uurlonersBladen(res));
      await logActie({ door: g.email, actie: 'export', bron: 'loonronde', veld: 'uren', details: 'Uren uurloners ' + per.label + ' (' + res.uren.totaal.medewerkers + ' medewerkers, ' + res.uren.totaal.uren + ' uur)' });
      return { base64: buf.toString('base64'), bestandsnaam: 'Uren_uurloners_' + per.sleutel + '.xlsx' };
    }
    if (p.actie === 'mail') {
      const onderwerp = String(p.onderwerp || '').trim(), tekst = String(p.tekst || '').trim();
      if (!onderwerp || !tekst) throw new Error('Onderwerp en tekst zijn verplicht.');
      const st0 = await L.leesStatus(per.jaar, per.maand);
      if (st0.mail && !p.opnieuw) return { success: false, alVerstuurd: true, bericht: 'Deze mail is al verstuurd op ' + st0.mail.tijd + ' door ' + st0.mail.door + '. Wil je hem opnieuw sturen?' };
      const html = T.slaWrap(T.slaHead('#009f4b', 'HR &middot; Loonadministratie') + '<tr><td style="padding:28px 36px"><div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333d3a;white-space:pre-wrap">' + T.esc(tekst) + '</div></td></tr>' + T.slaFoot());
      const resendId = await M.verstuur({ to: C.SALARIS_EMAIL, cc: g.email, subject: onderwerp, text: tekst, html, tags: [{ name: 'bron', value: 'loonronde' }, { name: 'type', value: 'mutaties' }] });
      const tijd = D.stempel();
      await M.logMail({ door: g.email, bron: 'loonronde', type: 'mutaties', naar: C.SALARIS_EMAIL, naam: '', onderwerp, taal: 'NL', rij: 0, resend_id: resendId });
      await logActie({ door: g.email, actie: 'mail', bron: 'loonronde', veld: 'naar-salaris', nieuw: tijd, details: onderwerp });
      const st = await L.zetMail(per.jaar, per.maand, { tijd, door: g.email, naar: C.SALARIS_EMAIL, onderwerp }, g.email);
      return { bericht: 'Verstuurd naar ' + C.SALARIS_EMAIL + ' (kopie naar jezelf). Mutaties en uitdienst zijn afgevinkt.', stappen: L.stappenOverzicht(per.jaar, per.maand, st), mail: st.mail };
    }
    throw new Error('Onbekende actie.');
  }
  const q = event.queryStringParameters || {}, std = L.standaardMaand();
  const jaar = q.jaar || std.jaar, maand = q.maand || std.maand;
  if (q.stap === 'uurloners') return L.laadUurloners(jaar, maand, q.ververs === '1');
  if (q.stap === 'mutaties') return L.laadMutaties(jaar, maand, voornaam(g.naam));
  return L.status(jaar, maand);
});
