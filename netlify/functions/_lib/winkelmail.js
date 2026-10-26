// ============================================================
// v0.28.0: wekelijkse winkelmail aan de store manager (maandag, zonder login)
// Store managers werken niet in het HR-dashboard; ze krijgen per winkel alleen wat ze moeten weten of doen:
//   1. Wacht op de medewerker  — ontslagbrief nog niet getekend, loonheffingsformulier nog niet binnen
//   2. Contracten die aflopen  — binnen 8 weken, nog geen besluit → knop "Geef advies" (advies.html, zonder login)
//   2b. Proeftijd loopt af     — binnen 17 dagen → knop "Geef advies" (doorgaan / stoppen / twijfel) (v0.29.0)
//   3. Nieuwe medewerkers      — start deze week; welkomstcollectie Academy nog niet af
//   4. Vertrek                 — laatste werkdag deze of volgende week (+ sleutels/kleding innemen)
//   5. Jubilea                 — volgende week 1, 2, 5, 10… jaar in dienst
//   5b. Verjaardagen           — deze week jarig (v0.28.1; naam + dag; leeftijd alleen t/m 21 jr: uurloon aanpassen, v0.28.2)
//   6. Cijfers                 — bestand, in-/uitstroom en verloop (3 maanden) naast SLA
// Bewust NIET: verzuim per persoon, check-in-antwoorden, exit-redenen, inhoud van brieven (AVG).
// Instelling 'winkelmail' (hr_instellingen): { aan, proef, adressen: { winkel: e-mail }, uit: [winkel] }
//   proef = alles naar C.WINKELMAIL_PROEF (Mischa) met "[Proef → adres]" in het onderwerp.
//   bouw(data, winkel)  puur: blokken voor één winkel
//   html(winkel, blokken, ...) mail-HTML; laad() alle gegevens; verstuurAlles(opts)
// ============================================================
const C = require('./config');
const T = require('./sjablonen');
const { normNaam, parseNLDatum } = require('./util');

const F = 'font-family:Arial,sans-serif;';
const esc = T.esc;
const ADVIES_DAGEN = 56;           // v0.32.3: contracten die binnen 8 weken aflopen (was 6): SM ziet het ~3 maandagen vóór de besluitdeadline (35 dagen)
const ADVIES_GELDIG_DAGEN = 21;    // advieslink 3 weken geldig
const STANDAARD = { aan: false, proef: true, adressen: {}, uit: [] };

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nl = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dagNaam = d => ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
const isVerz = s => /^(Verzonden|Verstuurd)/.test(String(s || ''));
const vandaagNL = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); d.setHours(0, 0, 0, 0); return d; };

// ---- advieslink (zonder login, getekend token) ----
function adviesToken(it) { return require('./uploads').tekenToken({ s: 'advies', k: it.soort === 'proeftijd' ? 'proeftijd' : 'verlenging', m: String(it.mid), e: it.eindIso, n: it.naam, w: it.winkel || '', d: iso(vandaagNL()) }); }
function leesAdviesToken(t) {
  const U = require('./uploads'), d = U.leesGetekend(t, 'Ongeldige link.');
  if (d.s !== 'advies' || !d.m || !/^\d{4}-\d{2}-\d{2}$/.test(d.e || '')) throw new Error('Ongeldige link.');
  d.k = d.k === 'proeftijd' ? 'proeftijd' : 'verlenging';
  if (U.tokenLeeftijdDagen(d.d) > ADVIES_GELDIG_DAGEN) { const e = new Error('Deze link is verlopen. Volgende week staat er een nieuwe in de winkelmail, of mail HR.'); e.verlopen = true; throw e; }
  return d;
}
const adviesLink = it => require('./uploads').site() + '/advies.html?t=' + encodeURIComponent(adviesToken(it));

// ---- puur: blokken voor één winkel ----
// data = { vandaag, med, loon, ontslag, verlengingen, academy, jubilea, offboarding, cijfers }
function bouw(data, winkel) {
  const v = data.vandaag, vi = iso(v), w = winkel;
  const winkelVan = maakWinkelVan(data.med);
  const inWinkel = r => winkelVan(r) === w;
  const dagenSinds = s => { const d = parseNLDatum(String(s || '').split(' ')[0]); return d ? Math.round((v - d) / 864e5) : null; };
  const b = { wacht: [], contracten: [], proeftijd: [], nieuw: [], vertrek: [], jubilea: [], jarig: [], cijfers: null };

  // 1. wacht op de medewerker
  for (const r of data.ontslag || []) {
    if (!isVerz(r.status) || r.ondertekend === 'Ja' || r.mahdia === 'Ja' || r.gearchiveerd || !inWinkel(r)) continue;
    const e = parseNLDatum(r.einddatum); if (e && e < plus(v, -7)) continue;
    b.wacht.push({ naam: r.naam, wat: (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslagbevestiging') + ' nog niet getekend', dagen: dagenSinds(r.verzenddatum), tip: 'Vraag of de mail met de tekenlink is binnengekomen (ook in de spam).' });
  }
  for (const r of data.loon || []) {
    if (!isVerz(r.status) || r.ontvangen === 'Ja' || r.mahdia === 'Ja' || !inWinkel(r)) continue;
    const d = dagenSinds(r.verzenddatum); if (d === null || d > 60) continue;
    b.wacht.push({ naam: r.naam, wat: 'Loonheffingsformulier nog niet ingeleverd', dagen: d, tip: 'Zonder formulier wordt 52% loonheffing ingehouden op de eerste loonstrook.' });
  }
  b.wacht.sort((a, c) => (c.dagen || 0) - (a.dagen || 0));

  // 2. contracten die aflopen zonder besluit
  for (const it of data.verlengingen || []) {
    if (it.winkel !== w || it.status !== 'besluit-nodig' || it.dagenTotEinde > ADVIES_DAGEN) continue;
    const k = it.keten || {};
    b.contracten.push({ naam: it.naam, einddatum: it.einddatum, dagen: it.dagenTotEinde, mid: it.mid, eindIso: it.eindIso, winkel: it.winkel,
      keten: k.vol ? 'Keten vol: verlengen kan alleen met een vast contract' : k.laatste ? 'Volgende contract is het laatste tijdelijke' : (k.aantal ? 'Nu het ' + k.aantal + 'e contract' : ''),
      advies: it.smAdvies || null });
  }
  b.contracten.sort((a, c) => a.dagen - c.dagen);

  // 2b. proeftijd loopt af (v0.29.0) — data.proeftijd uit laad(): { naam, mid, winkel, start, eindIso, einddatum, dagen, advies }
  for (const p of data.proeftijd || []) if (p.winkel === w) b.proeftijd.push(Object.assign({ soort: 'proeftijd' }, p));
  b.proeftijd.sort((a, c) => a.dagen - c.dagen);

  // 3. nieuwe medewerkers: start deze week + welkomstcollectie niet af
  const tot = plus(v, 6);
  for (const m of data.med || []) {
    if (m.winkelNaam !== w) continue;
    const s = parseNLDatum(m.indienst); if (s && s >= v && s <= tot) b.nieuw.push({ naam: m.naam, wat: 'Begint ' + dagNaam(s) + (m.functie ? ' als ' + m.functie : ''), tip: 'Buddy aanwijzen en de eerste diensten samen doen.' });
  }
  if (data.academy) {
    const A = require('./academy');
    for (const m of data.academy) {
      if (m.winkel !== w) continue;
      const x = A.beoordeel(m, vi);
      if (x.welkomTelt && !x.welkomAf && x.dagenInDienst <= 120) b.nieuw.push({ naam: m.naam, wat: 'Welkomstcollectie SLAcademy nog niet af (' + x.dagenInDienst + ' dagen in dienst)', tip: 'Plan er tijd voor in tijdens een rustige dienst.' });
    }
  }

  // 4. vertrek: laatste werkdag deze of volgende week
  const tot2 = plus(v, 13);
  for (const r of data.ontslag || []) {
    if (!isVerz(r.status) || !inWinkel(r)) continue;
    const e = parseNLDatum(r.einddatum); if (!e || e < v || e > tot2) continue;
    const spullen = (data.offboarding || []).some(c => normNaam(c.naam) === normNaam(r.naam) && (c.items || []).some(i => i.key === 'spullen' && !i.klaar));
    b.vertrek.push({ naam: r.naam, wat: 'Laatste werkdag ' + dagNaam(e), tip: spullen ? 'Sleutels, kleding en pasjes innemen en even laten weten aan HR.' : '' });
  }

  // 5. jubilea volgende week
  for (const j of data.jubilea || []) if (j.winkel === w) b.jubilea.push({ naam: j.naam, wat: j.jaren + ' jaar in dienst op ' + dagNaam(j.datum), tip: '' });

  // 5b. verjaardagen deze week (vandaag t/m zondag; mail gaat op maandag) — m.verjaardag = volgende verjaardag (jjjj-mm-dd)
  const zondag = plus(v, (7 - v.getDay()) % 7);
  for (const m of data.med || []) {
    if (m.winkelNaam !== w || !m.verjaardag) continue;
    const vm = String(m.verjaardag).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!vm) continue;
    const d = new Date(+vm[1], +vm[2] - 1, +vm[3]); if (d < v || d > zondag) continue;
    // v0.28.2: jeugdloon — t/m 21 jaar stijgt het (minimum)uurloon op de verjaardag; dat moet de SM handmatig in Shiftbase aanpassen
    const wordt = m.leeftijd == null ? null : (d.getTime() === v.getTime() ? m.leeftijd : m.leeftijd + 1);
    const loon = wordt != null && wordt >= 14 && wordt <= (C.JEUGD_LOON_MAX_LEEFTIJD || 20) + 1;
    b.jarig.push({ naam: m.naam, wat: 'Jarig op ' + dagNaam(d) + (loon ? ' — wordt ' + wordt : ''), datum: d, loon,
      tip: loon ? 'Uurloon aanpassen in Shiftbase per ' + d.getDate() + '-' + (d.getMonth() + 1) + '-' + d.getFullYear() + ': ' + jeugdloonTekst(wordt) : '' });
  }
  b.jarig.sort((a, c) => a.datum - c.datum);

  // 6. cijfers
  if (data.cijfers) {
    const wv = (data.cijfers.winkels || []).find(x => x.naam === w), t = data.cijfers.totaal;
    if (wv) b.cijfers = { periode: data.cijfers.periode, bestand: wv.bestandEind, instroom: wv.instroom, uitstroom: wv.uitstroom, verloop: wv.verloop, slaVerloop: t ? t.verloop : null };
  }
  b.leeg = !b.wacht.length && !b.contracten.length && !b.proeftijd.length && !b.nieuw.length && !b.vertrek.length && !b.jubilea.length && !b.jarig.length;
  return b;
}

// winkel van een dossierregel: via Shiftbase-id, e-mail of naam
function maakWinkelVan(med) {
  const id = {}, em = {}, nn = {};
  (med || []).forEach(m => { id[String(m.id)] = m.winkelNaam; if (m.email) em[String(m.email).toLowerCase()] = m.winkelNaam; nn[normNaam(m.naam)] = m.winkelNaam; });
  return r => (r.mid && id[String(r.mid)]) || (r.email && em[String(r.email).toLowerCase()]) || nn[normNaam(r.naam)] || '';
}

// ---- mail-HTML ----
function html(winkel, b, opts) {
  opts = opts || {};
  const blok = (titel, kleur, items, intro) => !items.length ? '' :
    '<p style="' + F + 'font-size:13px;font-weight:700;color:' + kleur + ';margin:22px 0 8px;text-transform:uppercase;letter-spacing:.5px">' + titel + ' (' + items.length + ')</p>'
    + (intro ? '<p style="' + F + 'font-size:12px;color:#888078;margin:0 0 8px">' + intro + '</p>' : '')
    + items.map(i => '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="padding:12px 14px;background:#f8f3f0;border-radius:8px;border-left:4px solid ' + kleur + '"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 3px">' + esc(i.naam) + '</p><p style="' + F + 'font-size:13px;color:#333d3a;margin:0">' + i.html + '</p>' + (i.tip ? '<p style="' + F + 'font-size:12px;color:#888078;margin:4px 0 0">' + esc(i.tip) + '</p>' : '') + '</td></tr></table>').join('');
  const knop = (url, tekst) => '<a href="' + esc(url) + '" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#009f4b;color:#fff;border-radius:6px;text-decoration:none;font-weight:700;' + F + 'font-size:13px">' + tekst + '</a>';
  const metDagen = x => esc(x.wat) + (x.dagen != null ? ' <span style="color:#888078">· ' + x.dagen + ' dagen geleden verstuurd</span>' : '');
  const contr = b.contracten.map(x => ({ naam: x.naam, tip: '', html: 'Contract loopt af op <strong>' + esc(x.einddatum) + '</strong> (over ' + x.dagen + ' dagen)' + (x.keten ? '<br><span style="color:#888078">' + esc(x.keten) + '</span>' : '')
    + (x.advies ? '<br><span style="color:#006b30">✓ Jouw advies: <strong>' + esc(x.advies.label) + '</strong></span> ' + (opts.links !== false ? knop(adviesLink(x), 'Advies wijzigen') : '') : '<br>' + (opts.links !== false ? knop(adviesLink(x), 'Geef je advies') : '<em>[knop: Geef je advies]</em>')) }));
  let c = '';
  if (b.cijfers) {
    const x = b.cijfers, pct = v => v == null ? '-' : String(v).replace('.', ',') + '%';
    c = '<p style="' + F + 'font-size:13px;font-weight:700;color:#333d3a;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px">Cijfers ' + esc(winkel) + ' · ' + esc(x.periode) + '</p>'
      + '<table cellpadding="0" cellspacing="0" style="' + F + 'font-size:13px;color:#333d3a;border-collapse:collapse">'
      + [['Medewerkers', x.bestand], ['Nieuw begonnen', x.instroom], ['Vertrokken', x.uitstroom], ['Verloop', pct(x.verloop) + ' <span style="color:#888078">(SLA ' + pct(x.slaVerloop) + ')</span>']]
        .map(r => '<tr><td style="padding:3px 18px 3px 0;color:#888078">' + r[0] + '</td><td style="padding:3px 0;font-weight:700">' + r[1] + '</td></tr>').join('') + '</table>';
  }
  const inhoud = blok('Wacht op de medewerker', '#c0392b', b.wacht.map(x => ({ naam: x.naam, html: metDagen(x), tip: x.tip })), 'Spreek ze even aan op de vloer.')
    + blok('Contracten die aflopen', '#e8824a', contr, 'Wil je deze medewerker verlengen? Geef je advies met de knop (geen inlog nodig); HR neemt het besluit en regelt de brief.')
    + blok('Proeftijd loopt af', '#e8824a', b.proeftijd.map(x => ({ naam: x.naam, tip: '', html: 'Proeftijd eindigt op <strong>' + esc(x.einddatum) + '</strong> (over ' + x.dagen + ' dagen) · in dienst sinds ' + esc(x.start)
        + (x.advies ? '<br><span style="color:#006b30">✓ Jouw advies: <strong>' + esc(x.advies.label) + '</strong></span> ' + (opts.links !== false ? knop(adviesLink(x), 'Advies wijzigen') : '') : '<br>' + (opts.links !== false ? knop(adviesLink(x), 'Geef je advies') : '<em>[knop: Geef je advies]</em>')) })),
      'Gaat deze medewerker door na de proeftijd? Stoppen kan alleen tót en mét de laatste dag van de proeftijd, en HR moet de brief dan op tijd versturen: geef je advies dus zo snel mogelijk.')
    + blok('Nieuwe medewerkers', '#009f4b', b.nieuw.map(x => ({ naam: x.naam, html: esc(x.wat), tip: x.tip })))
    + blok('Vertrek', '#888078', b.vertrek.map(x => ({ naam: x.naam, html: esc(x.wat), tip: x.tip })))
    + blok('Jubilea volgende week', '#009f4b', b.jubilea.map(x => ({ naam: x.naam, html: esc(x.wat), tip: 'Laat het niet ongemerkt voorbijgaan: een kaartje of iets lekkers doet veel.' })))
    + blok('Jarig deze week', '#e8824a', b.jarig.map(x => ({ naam: x.naam, html: '🎂 ' + esc(x.wat) + (x.loon ? '<br><strong style="color:#c0392b">⚠ ' + esc(x.tip) + '</strong>' : ''), tip: '' })), 'Even feliciteren op de vloer of in de groepsapp maakt verschil.' + (b.jarig.some(x => x.loon) ? ' <strong>Let op de ⚠: daar moet het uurloon in Shiftbase omhoog.</strong>' : ''))
    + c;
  const intro = b.leeg ? 'Deze week staat er niets open voor ' + esc(winkel) + '. Goed bezig!' : 'Dit speelt er deze week in <strong>' + esc(winkel) + '</strong>:';
  return T.slaWrap(T.slaHead('#009f4b', 'HR &middot; Weekoverzicht ' + esc(winkel)) + '<tr><td style="padding:30px 34px 26px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 12px">Hallo,</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0">' + intro + '</p>'
    + inhoud + '<p style="' + F + 'font-size:12px;color:#888078;margin:24px 0 0;line-height:1.6">Vragen? Mail HR (hr@ilovesla.com). Deze mail bevat persoonsgegevens: niet doorsturen.</p>'
    + '<p style="' + F + 'font-size:11px;color:#aaa;margin:14px 0 0;text-align:center">Automatisch weekoverzicht van het SLA HR Dashboard · elke maandag</p></td></tr>' + T.slaFoot());
}
function plain(winkel, b) {
  const r = [], lijst = (t, l, f) => { if (l.length) r.push('\n' + t.toUpperCase() + '\n' + l.map(f).join('\n')); };
  lijst('Wacht op de medewerker', b.wacht, x => '- ' + x.naam + ': ' + x.wat + (x.dagen != null ? ' (' + x.dagen + ' dagen)' : ''));
  lijst('Contracten die aflopen — geef je advies via de knop in de mail', b.contracten, x => '- ' + x.naam + ': loopt af ' + x.einddatum + (x.advies ? ' — jouw advies: ' + x.advies.label : ''));
  lijst('Proeftijd loopt af — geef je advies via de knop in de mail', b.proeftijd, x => '- ' + x.naam + ': proeftijd eindigt ' + x.einddatum + (x.advies ? ' — jouw advies: ' + x.advies.label : ''));
  lijst('Nieuwe medewerkers', b.nieuw, x => '- ' + x.naam + ': ' + x.wat);
  lijst('Vertrek', b.vertrek, x => '- ' + x.naam + ': ' + x.wat);
  lijst('Jubilea volgende week', b.jubilea, x => '- ' + x.naam + ': ' + x.wat);
  lijst('Jarig deze week', b.jarig, x => '- ' + x.naam + ': ' + x.wat + (x.loon ? '\n  LET OP: ' + x.tip : ''));
  return 'Hallo,\n\n' + (b.leeg ? 'Deze week staat er niets open voor ' + winkel + '.' : 'Dit speelt er deze week in ' + winkel + ':') + '\n' + r.join('\n') + '\n\nVragen? Mail HR (hr@ilovesla.com). Niet doorsturen (persoonsgegevens).\n\n(Automatisch weekoverzicht van het SLA HR Dashboard)';
}

// ---- proeftijd (v0.29.0): eerste arbeidsovereenkomst, proeftijd eindigt binnen PROEFTIJD_DAGEN ----
const PROEFTIJD_DAGEN = 17; // ruim 2 weken: de mail van volgende maandag komt anders mogelijk te laat
function proeftijdLijst(med, perUser, ontslag, adviezen, vandaag) {
  const KT = require('./contracten'), VL = require('./verlenging'), uit = [];
  const weg = new Set(); (ontslag || []).forEach(r => { if (isVerz(r.status)) { weg.add('n:' + normNaam(r.naam)); if (r.email) weg.add('e:' + String(r.email).toLowerCase()); } });
  const adv = {}; (adviezen || []).forEach(a => { adv[a.medewerker_id + '|' + a.contract_eind] = a; });
  for (const m of med || []) {
    if (weg.has('n:' + normNaam(m.naam)) || (m.email && weg.has('e:' + String(m.email).toLowerCase()))) continue;
    const cons = perUser[String(m.id)] || []; if (!cons.length) continue;
    const eerste = KT.overeenkomsten(cons, m.verjaardag)[0]; if (!eerste) continue;
    const s = parseNLDatum(nl(eerste.start)); if (!s || s > vandaag || (vandaag - s) / 864e5 > 70) continue;
    const pe = KT.proeftijdEinde(eerste); if (!pe) continue;
    const pd = new Date(pe.getFullYear(), pe.getMonth(), pe.getDate()), dagen = Math.round((pd - vandaag) / 864e5);
    if (dagen < 0 || dagen > PROEFTIJD_DAGEN) continue;
    const a = adv[String(m.id) + '|' + iso(pd)];
    uit.push({ naam: m.naam, mid: String(m.id), winkel: m.winkelNaam || '', start: nl(eerste.start), eindIso: iso(pd), einddatum: nl(iso(pd)), dagen,
      advies: a ? { advies: a.advies, label: PROEF_ADVIES[a.advies] || a.advies, opmerking: a.opmerking || '' } : null });
  }
  return uit;
}
const PROEF_ADVIES = { verlengen: 'Doorgaan na de proeftijd', niet: 'Stoppen in de proeftijd', twijfel: 'Twijfel' };

// ---- jeugdloon (v0.29.0): CAO Horeca, niet-vakkracht; vakkracht apart vermeld ----
const euro = n => '€ ' + n.toFixed(2).replace('.', ',');
function jeugdloon(leeftijd) {
  const J = C.CAO_JEUGDLOON; if (!J) return null;
  const a = Math.min(Math.max(leeftijd, 15), 21), pct = J.pct[a]; if (!pct) return null;
  return { bedrag: Math.round(J.basis * pct) / 100, pct, vak: J.vakkracht && J.vakkracht[Math.min(a, 20)] ? Math.round(J.basis * J.vakkracht[Math.min(a, 20)]) / 100 : null, vanaf: nl(J.geldigVanaf) };
}
// Na de volgende loonronde (geldigVanaf + 6 maanden) is de tabel verouderd: dan geen bedrag noemen (liever geen bedrag dan een fout bedrag)
function jeugdloonVerouderd(vandaag) {
  const m = String((C.CAO_JEUGDLOON || {}).geldigVanaf || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return true;
  return (vandaag || vandaagNL()) >= new Date(+m[1], +m[2] - 1 + 6, +m[3]);
}
function jeugdloonTekst(wordt) {
  if (jeugdloonVerouderd()) return wordt >= 21 ? 'vanaf 21 jaar het volwassen loon (CAO Horeca).' : 'jeugdloon ' + wordt + ' jaar volgens de actuele CAO Horeca-loontabel.';
  const j = jeugdloon(wordt); if (!j) return wordt >= 21 ? 'vanaf 21 jaar het volwassen loon.' : 'jeugdloon ' + wordt + ' jaar.';
  return 'minimaal ' + euro(j.bedrag) + ' per uur' + (wordt >= 21 ? ' (21 jaar: volwassen loon' : ' (' + j.pct + '%') + ', CAO Horeca per ' + j.vanaf + ', niet-vakkracht'
    + (j.vak && wordt >= 18 && wordt < 21 ? '; vakkracht: ' + euro(j.vak) : '') + '). Verdient hij of zij al meer, dan hoeft er niets te veranderen.';
}

// ---- ophalen ----
async function laad() {
  const SB = require('./shiftbase'), S = require('./sheets'), SIG = require('./signaleringen'), VR = require('./verloop'), { admin } = require('./auth');
  const vandaag = vandaagNL(), fouten = [];
  const veilig = async (naam, p) => { try { return await p; } catch (e) { fouten.push(naam + ': ' + e.message); return null; } };
  const [med, loon, ontslag, verl, academy, offb, vmed, perUser, advP] = await Promise.all([
    SB.getMedewerkers(false),
    veilig('loonheffing', S.getLoonheffing()), veilig('ontslag', S.getOntslag(true)),
    veilig('verlengingen', SIG.laadVerlengingen().then(r => r.lijst)),
    veilig('academy', require('./academy').laad(false).then(r => r.lijst)),
    veilig('offboarding', admin().from('hr_checklists').select('naam,items').eq('type', 'offboarding').is('afgerond_op', null).then(r => r.data || [])),
    veilig('verloop', VR.laadMedewerkers(false)),
    veilig('contracten', SB.getContractenPerUser(false)),
    veilig('advies proeftijd', admin().from('hr_sm_advies').select('medewerker_id,contract_eind,advies,opmerking,gegeven_op').eq('soort', 'proeftijd').then(r => { if (r.error) throw new Error(r.error.message); return r.data || []; }))
  ]);
  const proeftijd = proeftijdLijst(med, perUser || {}, ontslag || [], advP || [], vandaag);
  let jubilea = []; try { jubilea = SIG.vindJubilea(med, vandaag).lijst; } catch (e) { fouten.push('jubilea: ' + e.message); }
  let cijfers = null;
  if (vmed) try { const r = VR.berekenVerloop(vmed, new Date(vandaag.getFullYear(), vandaag.getMonth(), 1), 3, vandaag); cijfers = { winkels: r.winkels, totaal: r.totaal, periode: r.maanden[0].label + ' t/m ' + r.maanden[r.maanden.length - 1].label }; } catch (e) { fouten.push('cijfers: ' + e.message); }
  const winkels = Array.from(new Set(med.map(m => m.winkelNaam).filter(Boolean))).filter(w => !C.FRANCHISE_NAAM.test(w)).sort((a, b) => a.localeCompare(b, 'nl'));
  return { vandaag, med, proeftijd, loon: loon || [], ontslag: ontslag || [], verlengingen: verl || [], academy, offboarding: offb || [], jubilea, cijfers, winkels, fouten };
}

async function instelling() { const v = await require('./instellingen').lees('winkelmail', STANDAARD); return Object.assign({}, STANDAARD, v || {}, { adressen: Object.assign({}, (v && v.adressen) || {}), uit: ((v && v.uit) || []).slice() }); }
const isKeukenW = w => /keuken/i.test(String(w || ''));
function adresVan(inst, w) { return inst.adressen[w] || (isKeukenW(w) ? C.KEUKEN_EMAIL : '') || ''; }

// opts: { droog, alleenWinkel, door, proef (forceer proef) }
async function verstuurAlles(opts) {
  opts = opts || {};
  const M = require('./mail'), inst = await instelling(), data = await laad();
  const proef = opts.proef || inst.proef, rap = { verstuurd: [], overgeslagen: [], fouten: data.fouten.slice(), proef };
  if (jeugdloonVerouderd()) rap.fouten.push('CAO-jeugdlonen in config.js (CAO_JEUGDLOON) zijn verouderd: nieuwe loontabel invullen, tot die tijd staat er geen bedrag in de winkelmail');
  for (const w of data.winkels) {
    if (opts.alleenWinkel && w !== opts.alleenWinkel) continue;
    if (!opts.alleenWinkel && inst.uit.includes(w)) { rap.overgeslagen.push({ winkel: w, reden: 'uitgezet' }); continue; }
    const adres = adresVan(inst, w);
    if (!adres && !proef) { rap.overgeslagen.push({ winkel: w, reden: 'geen mailadres ingesteld' }); continue; }
    const b = bouw(data, w);
    if (b.leeg && !opts.alleenWinkel) { rap.overgeslagen.push({ winkel: w, reden: 'niets te melden' }); continue; }
    const to = proef ? (C.WINKELMAIL_PROEF || 'mischa@ilovesla.com') : adres;
    const subject = (proef ? '[Proef → ' + (adres || 'geen adres ingesteld') + '] ' : '') + 'SLA HR · Weekoverzicht ' + w + (b.contracten.concat(b.proeftijd).filter(x => !x.advies).length ? ' · advies gevraagd' : '');
    if (opts.droog) { rap.verstuurd.push({ winkel: w, to, droog: true }); continue; }
    try {
      const id = await M.verstuur({ to, subject, html: html(w, b), text: plain(w, b), tags: [{ name: 'bron', value: 'winkelmail' }] });
      await M.logMail({ door: opts.door || 'signalering', bron: 'winkelmail', type: proef ? 'proef' : 'week', naar: to, naam: w, onderwerp: subject, taal: 'NL', resend_id: id });
      rap.verstuurd.push({ winkel: w, to, contracten: b.contracten.length, wacht: b.wacht.length });
    } catch (e) { rap.fouten.push(w + ': ' + e.message); }
  }
  return rap;
}

module.exports = { proeftijdLijst, jeugdloon, jeugdloonTekst, jeugdloonVerouderd, PROEF_ADVIES, bouw, html, plain, laad, instelling, verstuurAlles, adresVan, adviesToken, leesAdviesToken, adviesLink, STANDAARD, ADVIES_DAGEN, maakWinkelVan };
