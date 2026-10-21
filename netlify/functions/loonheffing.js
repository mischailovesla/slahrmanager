// GET  /api/loonheffing - alle loonheffingsdossiers (voor de tab) + templates + stand automatisch uitnodigen
// POST /api/loonheffing { actie:'auto', aan } - automatisch uitnodigen nieuwe medewerkers aan/uit (alleen admin)
// POST /api/loonheffing { actie:'voorbeeld' } - voorbeeld van de automatische (NL + EN) uitnodiging
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const I = require('./_lib/instellingen');
exports.handler = beveiligd('loonheffing', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'auto') {
      if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan automatisch uitnodigen aan- of uitzetten.');
      const aan = p.aan === true || p.aan === 'true';
      await I.schrijf('loon_auto', aan, g.email);
      await logActie({ door: g.email, actie: 'instelling', bron: 'loonheffing', veld: 'loon_auto', nieuw: aan ? 'aan' : 'uit', details: aan ? 'Automatisch uitnodigen nieuwe medewerkers: aan' : 'Automatisch uitnodigen nieuwe medewerkers: uit' });
      return { auto: aan, bericht: aan ? 'Aan: nieuwe medewerkers uit Shiftbase krijgen bij de eerstvolgende run (elke 4 uur) automatisch de uitnodiging (NL + EN). HR krijgt een overzicht.' : 'Uit: HR krijgt weer één keer per dag een lijstje met nieuwe medewerkers zonder uitnodiging.' };
    }
    if (p.actie === 'voorbeeld') {
      const dl = require('./_lib/signaleringen').loonDeadline('', new Date());
      return { subject: T.LOON_TWEETALIG_ONDERWERP.uitnodiging, html: T.loonHtmlTweetalig('uitnodiging', 'Voorbeeld Medewerker', dl) };
    }
    throw new Error('Onbekende actie');
  }
  const rijen = await S.getLoonheffing();
  return { rijen, auto: (await I.lees('loon_auto', false)) === true, templates: T.LOON_TEMPLATES.map(x => ({ key: x.key, label: x.label, taal: x.taal, type: x.type, subject: x.subject })) };
});
