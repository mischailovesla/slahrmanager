/* SLA HR Dashboard - Netlify (stap 3d: ontslag & aanzegging met Docs-PDF) */
(function () {
  'use strict';
  var g = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sb = null, sessie = null, cfg = null, ovData = null, medewerkers = [];

  // ---------- Nav: lifecycle-groepen (zelfde indeling als Layout.gs v1.8) ----------
  var GROEPEN = [
    { label: 'Instroom', items: [['loonheffing', 'Loonheffingsverklaring']] },
    { label: 'In dienst', items: [['loonheffingskorting', 'Loonheffingskorting'], ['overplaatsing', 'Overplaatsing'], ['vakantie', 'Vakantieplanner'], ['vastloners', 'Vastloners']] },
    { label: 'Dossier', items: [['beschikbaarheid', 'Beschikbaarheid'], ['waarschuwing', 'Waarschuwingen'], ['sommatie', 'Sommaties'], ['brief', 'Vrije brieven']] },
    { label: 'Uitstroom', items: [['ontslag', 'Ontslag & aanzegging'], ['verloopanalyse', 'Verloopanalyse']] }
  ];
  // Welke modules in deze stap al "echt" zijn (de rest opent een placeholder)
  var ECHT = { overview: 1, dossier: 1, loonheffing: 1, brief: 1, ontslag: 1, sommatie: 1, overplaatsing: 1, signalering: 1 };

  function bouwNav() {
    var nav = g('nav'), spacer = nav.querySelector('.spacer');
    GROEPEN.forEach(function (gr) {
      var wrap = document.createElement('div'); wrap.className = 'lay-groep';
      var kop = document.createElement('button'); kop.className = 'lay-kop'; kop.type = 'button';
      kop.innerHTML = esc(gr.label) + ' <span class="lay-chev">▼</span>';
      var drop = document.createElement('div'); drop.className = 'lay-drop';
      gr.items.forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button';
        b.setAttribute('data-tab', it[0]);
        if (ECHT[it[0]]) { b.textContent = it[1]; }
        else { b.className = 'binnenkort'; b.innerHTML = esc(it[1]) + '<small>Apps Script</small>'; b.title = 'Nog in het bestaande dashboard'; }
        b.onclick = function (e) { e.stopPropagation(); sluitDrops(); swT(it[0], it[1]); };
        drop.appendChild(b);
      });
      kop.onclick = function (e) { e.stopPropagation(); var open = !drop.classList.contains('open'); sluitDrops(); if (open) drop.classList.add('open'); };
      wrap.appendChild(kop); wrap.appendChild(drop);
      nav.insertBefore(wrap, spacer);
    });
    document.addEventListener('click', sluitDrops);
    nav.querySelectorAll(':scope > button[data-tab]').forEach(function (b) { b.onclick = function () { swT(b.getAttribute('data-tab'), b.textContent); }; });
  }
  function sluitDrops() { document.querySelectorAll('.lay-drop.open').forEach(function (d) { d.classList.remove('open'); }); }
  function swT(tab, label) {
    document.querySelectorAll('.tc').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.nav button').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.lay-kop').forEach(function (el) { el.classList.remove('kop-actief'); });
    var doel = ECHT[tab] ? 'tab-' + tab : 'tab-binnenkort';
    g(doel).classList.add('active');
    if (!ECHT[tab]) g('binnenkort-titel').textContent = label || tab;
    var knop = document.querySelector('.nav button[data-tab="' + tab + '"]');
    if (knop) { knop.classList.add('active'); var grp = knop.closest('.lay-groep'); if (grp) grp.querySelector('.lay-kop').classList.add('kop-actief'); }
    if (tab === 'dossier') { setTimeout(function () { g('dos-zoek').focus(); }, 50); if (!g('dos-inhoud').innerHTML) renderMedewerkersLijst(); }
    if (tab === 'loonheffing' && !lhData) laadLoonheffing();
    if (tab === 'brief' && !vbData) laadBrieven();
    if (tab === 'ontslag' && !omData) laadOntslag();
    if (tab === 'sommatie' && !smData) laadSommaties();
    if (tab === 'overplaatsing' && !opData) laadOverplaatsingen();
    if (tab === 'signalering' && !sgData) laadSignaleringen();
  }
  window.swT = swT;

  // ---------- Auth ----------
  async function init() {
    cfg = await (await fetch('/api/config')).json();
    g('login-domein').textContent = cfg.domein;
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { toonLoginFout('Supabase is nog niet geconfigureerd (env vars ontbreken op Netlify).'); g('login').classList.add('show'); return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    bouwNav();
    g('btn-login').onclick = login;
    g('btn-uit').onclick = async function () { await sb.auth.signOut(); location.reload(); };
    sb.auth.onAuthStateChange(function (ev, s) { sessie = s; });
    var r = await sb.auth.getSession();
    sessie = r.data.session;
    if (!sessie) { g('login').classList.add('show'); return; }
    await naLogin();
  }
  async function login() {
    g('login-fout').classList.remove('show');
    var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/', queryParams: { hd: cfg.domein, prompt: 'select_account' } } });
    if (r.error) toonLoginFout(r.error.message);
  }
  function toonLoginFout(t) { var el = g('login-fout'); el.textContent = t; el.classList.add('show'); }
  async function naLogin() {
    var ik = await api('/api/ik');
    if (!ik.success) { await sb.auth.signOut(); g('login').classList.add('show'); toonLoginFout(ik.bericht || 'Geen toegang.'); return; }
    g('login').classList.remove('show');
    g('top-wie').innerHTML = '<strong>' + esc(ik.naam) + '</strong>';
    g('btn-uit').style.display = '';
    setInterval(function () { g('top-dt').textContent = new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }, 1000);
    zetDossierZoek();
    await laadOverzicht();
    laadMedewerkers(false);
  }
  async function api(pad, postBody) {
    var s = sessie || (await sb.auth.getSession()).data.session;
    if (!s) return { success: false, bericht: 'Niet ingelogd' };
    try {
      var opts = { headers: { Authorization: 'Bearer ' + s.access_token } };
      if (postBody) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(postBody); }
      var r = await fetch(pad, opts);
      return await r.json();
    } catch (e) { return { success: false, bericht: e.message }; }
  }

  // ---------- Overzicht ----------
  var isVerz = function (s) { return s && (s.indexOf('Verzonden') === 0 || s.indexOf('Verstuurd') === 0); };
  function bSent(st) {
    if (!st) return '<span class="no-doc">-</span>';
    if (isVerz(st)) { var m = st.match(/(\d{1,2}-\d{1,2}-\d{4})/); return '<span class="badge bg">' + esc(m ? m[1] : st) + '</span>'; }
    if (st.indexOf('FOUT') === 0) return '<span class="badge br">Fout</span>';
    return '<span class="badge boat">' + esc(st) + '</span>';
  }
  function bOk(v, ja, nee) { return v === 'Ja' ? '<span class="badge bg">' + (ja || 'Ontvangen') + '</span>' : '<span class="badge br">' + (nee || 'Wacht') + '</span>'; }
  function bH(h, n) {
    var cnt = n || 0; if (cnt === 0 && h) cnt = 1;
    var c = cnt === 0 ? 'bdk' : cnt === 1 ? 'bb' : cnt === 2 ? 'bo' : 'br';
    var lbl = cnt === 0 ? 'Geen' : cnt + 'x';
    var m = String(h || '').match(/(\d{1,2}-\d{1,2}-\d{4})/);
    return '<span class="badge ' + c + '">' + lbl + '</span>' + (m ? '<div class="lay-sub">' + m[1] + '</div>' : '');
  }
  function bMah(v) { return v === 'Ja' ? '<span class="badge bg">✓ Verwerkt</span>' : '<span class="badge bdk">Open</span>'; }
  // Klikbaar vinkje: schrijft naar de sheet via /api/toggle (zelfde cel als Code.gs)
  function bTog(type, v, rij, naam, aan, uit) {
    var ok = v === 'Ja';
    return '<button class="mah-btn' + (ok ? ' ok' : '') + '" data-tog="' + type + '" data-rij="' + rij + '" data-naam="' + esc(naam) + '">' + (ok ? '✓ ' + (aan || 'Verwerkt') : (uit || 'Aanvinken')) + '</button>';
  }
  function bArch(type, rij, naam) {
    return '<button class="mah-btn arch" title="Archiveer ' + esc(naam) + ' — rij gaat naar tab Archief" data-arch="' + type + '" data-rij="' + rij + '" data-naam="' + esc(naam) + '">🗑</button>';
  }
  var bezig = false, laatsteDossier = null;
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && (e.target.closest('button[data-tog]') || e.target.closest('button[data-arch]'));
    if (!b || bezig) return;
    var naam = b.getAttribute('data-naam'), rij = b.getAttribute('data-rij');
    var isArch = b.hasAttribute('data-arch');
    if (isArch && !confirm('Uit het dashboard halen: ' + naam + '?\n\nDe rij wordt verplaatst naar de tab Archief in het Google Sheet (met datum en jouw naam). Er gaat niets verloren — terugzetten kan altijd.')) return;
    bezig = true; b.disabled = true; var oud = b.innerHTML; b.innerHTML = '…';
    var r = isArch ? await api('/api/archiveer', { type: b.getAttribute('data-arch'), rij: rij, naam: naam })
                   : await api('/api/toggle', { type: b.getAttribute('data-tog'), rij: rij, naam: naam });
    bezig = false;
    if (r.success) {
      toast(r.bericht, 'ok');
      await laadOverzicht();
      if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier);
    } else { toast('Fout: ' + r.bericht, 'err'); b.disabled = false; b.innerHTML = oud; }
  });
  function bDoc(url, lbl) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="doc-link">' + (lbl || 'Open') + '</a>' : '<span class="no-doc">-</span>'; }
  function dosBtn(naam, email) { return '<button class="btn bd bsm" data-dos-naam="' + esc(naam) + '" data-dos-email="' + esc(email || '') + '">Dossier</button>'; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-dos-naam]');
    if (b) openDossier(b.getAttribute('data-dos-naam'), b.getAttribute('data-dos-email'));
  });

  window.laadOverzicht = async function () {
    g('lo').classList.add('show'); g('lo-txt').textContent = 'Overzicht laden...';
    var d = await api('/api/overzicht');
    g('lo').classList.remove('show');
    if (!d.success) { toast('Overzicht: ' + d.bericht, 'err'); return; }
    ovData = d;
    var s = d.stats;
    g('s-lt').textContent = s.loonTotaal; g('s-lok').textContent = s.loonOntvangen; g('s-lno').textContent = s.loonTotaal - s.loonOntvangen; g('s-ot').textContent = s.ontslagTotaal;
    ['instroom', 'indienst', 'dossier', 'uitstroom'].forEach(function (k) {
      var chip = document.querySelector('.lay-chip[data-chip="' + k + '"]'), n = d.werklijst[k] || 0;
      chip.querySelector('.lay-tel').textContent = n;
      chip.classList.toggle('lay-open-acties', n > 0); chip.classList.toggle('lay-klaar', n === 0);
    });
    g('lay-comp').textContent = 'bijgewerkt ' + d.bijgewerkt;
    document.querySelectorAll('.lay-chip').forEach(function (c) { c.onclick = function () { flt('ov-body', c.getAttribute('data-doel')); }; });

    // Aanzeg-alerts
    var a = d.aanzegAlerts || [];
    g('aanzeg-sec').innerHTML = a.length ? '<div class="alert geel"><strong>Aanzegtermijn (art. 7:668 BW):</strong> ' + a.length + ' contract(en) lopen binnen 42 dagen af zonder ondertekende aanzegging/bevestiging: ' +
      a.map(function (x) { return '<strong>' + esc(x.naam) + '</strong> (' + esc(x.bedrijf || '-') + ', ' + esc(x.einddatum) + ', nog ' + x.dagen + ' dagen' + (isVerz(x.status) ? ', verstuurd' : ', <span style="color:#c0392b">niet verstuurd</span>') + ')' + (isVerz(x.status) ? '' : ' <button class="btn bp bsm" data-om-aanzeg="1" data-naam="' + esc(x.naam) + '" data-email="' + esc(x.email || '') + '" data-bv="' + esc(x.bedrijf || '') + '" data-eind="' + esc(x.einddatum) + '">Aanzegging</button>'); }).join(' · ') + '</div>' : '';

    var rows = [];
    d.open.loonheffing.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bg">Loonheffing</span></td><td>' + esc(r.email) + '</td><td>' + bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst') + '</td><td>' + esc(r.deadline || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ontvangen) + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + '</td><td>' + lmBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('loonheffing', r.rij, r.naam) + '</td></tr>');
    });
    d.open.overplaatsing.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bo">' + esc(r.type || 'Overplaatsing') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.huidigeBV) + '</span> → <span class="badge boat">' + esc(r.nieuweBV) + '</span></td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ondertekend', 'Aanvinken') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>-</td><td>' + opBtn(r) + ' ' + dosBtn(r.naam, r.email) + '</td></tr>');
    });
    var somK = { '1e Sommatie': '#009f4b', '2e Sommatie': '#e8824a', 'Finale Sommatie': '#c0392b', 'Ontslag op Staande Voet': '#333d3a', 'Oproepbrief': '#2980b9' };
    d.open.sommatie.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge" style="background:' + (somK[r.type] || '#333d3a') + ';color:#fff">' + esc(r.type) + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.datumAfspraak || '-') + '</td><td>' + bSent(r.verzenddatum ? 'Verstuurd ' + r.verzenddatum : '') + '</td><td><span class="badge boat">' + esc(r.status || '-') + '</span></td><td>-</td><td>' + bTog('som-verwerkt', r.verwerkt, r.rij, r.naam) + '</td><td>' + smBriefBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('sommatie', r.rij, r.naam) + '</td></tr>');
    });
    d.open.ontslag.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bdk">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bedrijf || '-') + '</span> ' + bDoc(r.briefUrl, '⬇ Brief') + '</td><td>' + esc(r.einddatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ondertekend, 'Ondertekend', 'Wacht') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam) + '</td><td>' + omBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('ontslag', r.rij, r.naam) + '</td></tr>');
    });
    g('ov-open-count').textContent = rows.length + ' open';
    g('ov-body').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="10" class="leeg">✓ Alle taken verwerkt — geen open dossiers</td></tr>';
  };

  window.flt = function (id, q) {
    q = String(q || '').toLowerCase();
    Array.prototype.forEach.call(g(id).rows, function (r) { r.style.display = r.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
  };

  // ---------- Dossier ----------
  var medewerkersFout = '';
  async function laadMedewerkers(forceer) {
    g('dos-lijst').innerHTML = '<tr><td colspan="8" class="leeg grijs">Shiftbase-lijst laden…</td></tr>';
    var d = await api('/api/medewerkers' + (forceer ? '?ververs=1' : ''));
    if (d.success) { medewerkers = d.medewerkers || []; medewerkersFout = ''; if (forceer) toast(medewerkers.length + ' medewerkers opgehaald uit Shiftbase', 'ok'); }
    else { medewerkersFout = d.bericht || 'onbekende fout'; toast('Shiftbase: ' + medewerkersFout, 'err'); }
    renderMedewerkersLijst();
  }
  // Volledige lijst in de Medewerkers-tab (gefilterd op het zoekveld)
  function renderMedewerkersLijst() {
    var q = (g('dos-zoek').value || '').trim().toLowerCase();
    if (medewerkersFout) { g('dos-lijst').innerHTML = '<tr><td colspan="8"><div class="alert rood" style="margin:12px 0">Shiftbase niet bereikbaar: ' + esc(medewerkersFout) + ' — klik op ↻ om het opnieuw te proberen.</div></td></tr>'; return; }
    var lijst = medewerkers.filter(function (m) { return !q || m.naam.toLowerCase().indexOf(q) > -1 || (m.email || '').toLowerCase().indexOf(q) > -1 || (m.winkelNaam || '').toLowerCase().indexOf(q) > -1; })
      .slice().sort(function (a, b) { return (a.winkelNaam || '~').localeCompare(b.winkelNaam || '~') || a.naam.localeCompare(b.naam); });
    var perWinkel = {}; lijst.forEach(function (m) { perWinkel[m.winkelNaam || ''] = (perWinkel[m.winkelNaam || ''] || 0) + 1; });
    var h = '', vorige = null;
    lijst.forEach(function (m) {
      if (m.winkelNaam !== vorige) { h += '<tr><td colspan="8" class="sec-sub" style="padding:10px 14px">' + esc(m.winkelNaam || 'Geen winkel') + ' <span class="pill">' + perWinkel[m.winkelNaam || ''] + '</span></td></tr>'; vorige = m.winkelNaam; }
      h += '<tr><td><strong>' + esc(m.naam) + '</strong></td><td>' + esc(m.winkelNaam || '-') + '</td><td>' + esc(m.functie || '-') + '</td><td>' + esc(m.indienst || '-') + '</td><td>' + esc(m.contractType || '-') + '</td><td>' + (m.contractEinde ? esc(m.contractEinde) : '<span class="lay-sub">onbepaald</span>') + '</td><td>' + esc(m.email || '-') + '</td><td><button class="btn bd bsm" data-dos-id="' + esc(m.id) + '">Dossier</button></td></tr>';
    });
    g('dos-lijst').innerHTML = h || '<tr><td colspan="8" class="leeg grijs">' + (medewerkers.length ? 'Geen medewerker gevonden voor "' + esc(q) + '"' : 'Geen medewerkers in Shiftbase gevonden') + '</td></tr>';
    g('dos-hint').style.display = ''; g('dos-lijst-wrap').style.display = ''; g('dos-inhoud').innerHTML = '';
  }
  window.renderMedewerkersLijst = renderMedewerkersLijst;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-dos-id]');
    if (b) openDossier(null, null, b.getAttribute('data-dos-id'));
  });
  function zetDossierZoek() {
    var inp = g('dos-zoek'), res = g('dos-res');
    inp.oninput = function () {
      res.classList.remove('open');
      renderMedewerkersLijst();   // typen filtert de lijst; Dossier-knop opent het dossier
    };
    inp.onblur = function () { setTimeout(function () { res.classList.remove('open'); }, 180); };
    g('dos-ververs').onclick = function () { laadMedewerkers(true); };
  }
  window.openDossier = async function (naam, email, id) {
    laatsteDossier = [naam, email, id];
    swT('dossier', 'Medewerkers');
    g('dos-hint').style.display = 'none'; g('dos-lijst-wrap').style.display = 'none';
    g('dos-inhoud').innerHTML = '<div class="sec"><div class="leeg grijs"><span class="sp" style="border-color:rgba(0,0,0,.15);border-top-color:#009f4b"></span> Dossier laden...</div></div>';
    var qs = id ? 'id=' + encodeURIComponent(id) : 'naam=' + encodeURIComponent(naam || '') + '&email=' + encodeURIComponent(email || '');
    var d = await api('/api/dossier?' + qs);
    if (!d.success) { g('dos-inhoud').innerHTML = '<div class="alert rood">' + esc(d.bericht) + '</div>'; return; }
    var p = d.persoon, c = d.contract, h = '';
    h += '<div style="padding:0 0 10px"><button class="btn bd bsm" onclick="renderMedewerkersLijst()">← Alle medewerkers</button></div>';
    h += '<div class="dos-kop"><div class="dos-kaart"><div class="dos-naam">' + esc(d.naam) + '</div><div class="lay-sub">' + esc(d.email || '(geen e-mail)') + (p ? ' · ' + esc(p.winkelNaam || '-') + (p.winkelBv ? ' · ' + esc(p.winkelBv) : '') : ' · <em>niet gevonden in Shiftbase (alleen sheet-data)</em>') + '</div>';
    if (p) h += '<div class="dos-meta"><div><label>Functie</label><span>' + esc(p.functie || '-') + '</span></div><div><label>In dienst sinds</label><span>' + esc(p.indienst || '-') + '</span></div><div><label>Contract</label><span>' + esc(c.type || '-') + '</span></div><div><label>Contract eindigt</label><span>' + esc(c.einde || 'onbepaalde tijd / onbekend') + '</span></div><div><label>Adres</label><span>' + esc(p.adres || '-') + '</span></div></div>';
    h += '</div><div class="dos-kaart">';
    if (c && c.aanzegAlert) h += '<div class="alert ' + (c.aanzeggingVerstuurd ? 'groen' : 'rood') + '" style="margin:0 0 12px"><strong>Aanzegtermijn:</strong> contract eindigt over ' + c.dagenTotEinde + ' dagen.' + (c.aanzeggingVerstuurd ? ' Aanzegging is verstuurd ✓' : ' <strong>Nog geen aanzegging verstuurd.</strong>') + '</div>';
    else if (c && c.einde) h += '<div class="alert grijs" style="margin:0 0 12px">Contract eindigt over ' + c.dagenTotEinde + ' dagen — buiten de 42-dagen-alert.</div>';
    h += '<label style="display:block;font-size:.68rem;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Verlof (Shiftbase, 12 mnd terug / 6 vooruit)</label>';
    h += d.verlof && d.verlof.length ? '<div class="kv">' + d.verlof.slice(0, 8).map(function (v) { return '<div>' + esc(v.start) + (v.eind && v.eind !== v.start ? ' – ' + esc(v.eind) : '') + ' · <b>' + esc(v.type || '-') + '</b> · ' + esc(v.status) + (v.uren ? ' · ' + esc(v.uren) + ' u' : '') + '</div>'; }).join('') + (d.verlof.length > 8 ? '<div class="lay-sub">+' + (d.verlof.length - 8) + ' meer</div>' : '') + '</div>' : '<div class="lay-sub">Geen afwezigheden gevonden</div>';
    h += '</div></div>';
    // Secties
    h += '<div class="sec"><div class="sh"><div class="st">Dossierregels <span class="pill">' + d.totaal + '</span></div></div>';
    d.secties.forEach(function (s) {
      h += '<div class="sec-sub">' + esc(s.label) + ' (' + s.rijen.length + ')' + (s.fout ? ' <span style="color:#c0392b;text-transform:none">— ' + esc(s.fout) + '</span>' : '') + '</div>';
      if (!s.rijen.length) { h += '<div style="padding:10px 24px;font-size:.8rem;color:#c4b8b0">Geen regels</div>'; return; }
      h += '<div class="tw"><table><tbody>' + s.rijen.map(function (r) { return '<tr>' + rijNaarCellen(s.key, r) + '</tr>'; }).join('') + '</tbody></table></div>';
    });
    h += '</div>';
    g('dos-inhoud').innerHTML = h;
  };
  function kv(l, v) { return '<td><div class="lay-sub">' + esc(l) + '</div>' + v + '</td>'; }
  function rijNaarCellen(key, r) {
    switch (key) {
      case 'loonheffing': return kv('Deadline', esc(r.deadline || '-')) + kv('Mail', bSent(r.status)) + kv('Formulier', bOk(r.ontvangen)) + kv('Documenten', bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst')) + kv('Herinneringen', bH(r.herinnering, r.aantalHer)) + kv('Naar salaris', bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + (r.salaris ? '<div class="lay-sub">' + esc(r.salaris) + '</div>' : '')) + kv('', bArch('loonheffing', r.rij, r.naam));
      case 'onboarding': return kv('Locatie', esc(r.locatie || '-')) + kv('Taal', esc(r.taal)) + kv('Welkomstmail', bSent(r.status)) + kv('Datum', esc(r.verzenddatum || '-')) + kv('', bArch('onboarding', r.rij, r.naam));
      case 'overplaatsing': return kv('Type', '<span class="badge bo">' + esc(r.type || '-') + '</span>') + kv('Van → naar', esc(r.huidigeBV) + ' → ' + esc(r.nieuweBV)) + kv('Ingangsdatum', esc(r.ingangsdatum || '-')) + kv('Mail', bSent(r.status)) + kv('Ondertekend', bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ja', 'Aanvinken')) + kv('Brief', bDoc(r.briefUrl, '⬇ PDF')) + kv('', opBtn(r));
      case 'sommatie': return kv('Type', '<span class="badge bdk">' + esc(r.type) + '</span>') + kv('BV', esc(r.bv || '-')) + kv('Afwezig', esc(r.datumAfwezig || '-')) + kv('Afspraak', esc(r.datumAfspraak || '-')) + kv('Verstuurd', esc(r.verzenddatum || '-')) + kv('Status', esc(r.status || '-')) + kv('Verwerkt', bTog('som-verwerkt', r.verwerkt, r.rij, r.naam)) + (r.aanvullend ? kv('Aanvullend', esc(r.aanvullend)) : '') + kv('', smBriefBtn(r) + ' ' + bArch('sommatie', r.rij, r.naam));
      case 'brief': return kv('Categorie', '<span class="badge bdk">' + esc(r.categorie || '-') + '</span>') + kv('Onderwerp', esc(r.onderwerp || '-')) + kv('BV', esc(r.bv || '-')) + kv('PDF', r.pdf === 'Ja' ? '<span class="badge bg">Ja</span>' : '<span class="no-doc">-</span>') + kv('Verstuurd', esc(r.verzenddatum || '-')) + kv('', '<button class="btn bd bsm" data-vb-print="' + esc(r.rij) + '">Brief</button> <button class="btn bd bsm" data-vb-opnieuw="' + esc(r.rij) + '">Opnieuw</button>');
      case 'ontslag': return kv('Type', '<span class="badge bdk">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span>') + kv('BV', esc(r.bedrijf || '-')) + kv('Opzegging', esc(r.opzegging || '-')) + kv('Einddatum', esc(r.einddatum || '-')) + kv('Mail', bSent(r.status)) + kv('Ondertekend', bOk(r.ondertekend, 'Ja', 'Nee')) + kv('Docs', bDoc(r.docUrl, 'Getekend') + ' ' + bDoc(r.briefUrl, '⬇ Brief')) + kv('Naar salaris', bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam)) + kv('', omBtn(r) + ' ' + bArch('ontslag', r.rij, r.naam));
      default: return kv('Datum', esc(r.datum || '-')) + '<td>' + esc((r.raw || []).slice(0, 8).join(' · ')) + '</td>';
    }
  }

  // ---------- Loonheffing-tab ----------
  var lhData = null, lhTemplates = [];
  function lmBtn(r) { return '<button class="btn bp bsm" data-lm-rij="' + r.rij + '">Mail</button>'; }
  window.laadLoonheffing = async function () {
    var d = await api('/api/loonheffing');
    if (!d.success) { toast('Loonheffing: ' + d.bericht, 'err'); return; }
    lhData = d.rijen; lhTemplates = d.templates;
    g('lh-count').textContent = lhData.length + ' dossiers';
    g('lh-body').innerHTML = lhData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + esc(r.deadline || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ontvangen) + '</td><td>' + bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst') + '</td><td><span class="badge boat">' + esc(r.taal || 'NL') + '</span></td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + (r.salaris ? '<div class="lay-sub">' + esc(r.salaris) + '</div>' : '') + '</td><td>' + lmBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('loonheffing', r.rij, r.naam) + '</td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">Geen dossiers</td></tr>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-lm-rij]');
    if (!b) return;
    var rij = parseInt(b.getAttribute('data-lm-rij'), 10);
    var r = (lhData || []).concat((ovData && ovData.open.loonheffing) || []).find(function (x) { return x.rij === rij; });
    openLoonMail(r || null);
  });

  // ---------- Mailmodal loonheffing ----------
  var lmTpl = 'uitnodiging-nl', lmRij = null;
  window.openLoonMail = async function (persoon) {
    if (!lhTemplates.length) { var d = await api('/api/loonheffing'); if (d.success) { lhTemplates = d.templates; lhData = d.rijen; } }
    lmRij = persoon ? persoon.rij : null;
    g('lm-to').value = persoon ? persoon.email || '' : '';
    g('lm-naam').value = persoon ? persoon.naam || '' : '';
    g('lm-dl').value = persoon ? persoon.deadline || '' : '';
    // Slimme default: al een mail verstuurd -> herinnering; taal uit de rij
    var taal = persoon && persoon.taal === 'EN' ? 'en' : 'nl';
    lmTpl = (persoon && persoon.status && persoon.status.indexOf('Verzonden') === 0 ? 'herinnering-' : 'uitnodiging-') + taal;
    lmBouwTbar(); lmHerbouw();
    g('lm-zoek').value = ''; g('lm-zoek-res').classList.remove('open');
    g('lm-modal').classList.add('open');
    if (!persoon) setTimeout(function () { g('lm-zoek').focus(); }, 60);
  };
  window.closeLoonMail = function () { g('lm-modal').classList.remove('open'); };
  function lmBouwTbar() {
    g('lm-tbar').innerHTML = lhTemplates.map(function (t) { return '<button type="button" class="tb' + (t.key === lmTpl ? ' sel' : '') + '" data-tpl="' + t.key + '">' + esc(t.label) + '</button>'; }).join('');
    g('lm-tbar').querySelectorAll('[data-tpl]').forEach(function (b) { b.onclick = function () { lmTpl = b.getAttribute('data-tpl'); lmBouwTbar(); lmHerbouw(); }; });
  }
  window.lmHerbouw = async function () {
    var t = lhTemplates.find(function (x) { return x.key === lmTpl; }); if (!t) return;
    g('lm-subj').value = t.subject;
    g('lm-body').value = 'Tekst laden…';
    var r = await api('/api/loonheffing-mail', { template: lmTpl, naam: g('lm-naam').value.trim(), deadline: g('lm-dl').value.trim(), preview: true });
    if (r.success) g('lm-body').value = r.text; else g('lm-body').value = '(kon template niet laden: ' + r.bericht + ')';
  };
  window.lmKopieer = function () {
    navigator.clipboard.writeText('Onderwerp: ' + g('lm-subj').value + '\n\n' + g('lm-body').value).then(function () { toast('Gekopieerd', 'ok'); });
  };
  window.lmVerstuur = async function () {
    var to = g('lm-to').value.trim(), naam = g('lm-naam').value.trim();
    if (!to || !naam) { toast('Vul e-mail en naam in', 'err'); return; }
    var b = g('lm-sbtn'); b.disabled = true; g('lm-slbl').textContent = 'Versturen…';
    var r = await api('/api/loonheffing-mail', { template: lmTpl, to: to, naam: naam, deadline: g('lm-dl').value.trim(), rij: lmRij, subject: g('lm-subj').value.trim(), body: g('lm-body').value });
    b.disabled = false; g('lm-slbl').textContent = 'Verstuur mail';
    if (r.success) { toast(r.bericht, 'ok'); closeLoonMail(); lhData = null; laadLoonheffing(); laadOverzicht(); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  g('lm-modal').addEventListener('click', function (e) { if (e.target === this) closeLoonMail(); });

  // ---------- Ontslag & aanzegging (port van openM/apl/sendM uit de dashboard-UI) ----------
  var omData = null, omTpl = [], omKey = 'ontslag-pdf', omRij = null;
  function omBtn(r) { return '<button class="btn bp bsm" data-om-rij="' + r.rij + '">Mail</button>'; }
  window.laadOntslag = async function () {
    var d = await api('/api/ontslag');
    if (!d.success) { toast('Ontslag: ' + d.bericht, 'err'); return; }
    omData = d.rijen; omTpl = d.templates;
    g('om-count').textContent = omData.length + ' dossiers';
    g('om-body').innerHTML = omData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge ' + (r.type === 'aanzegging' ? 'bo' : 'bdk') + '">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bedrijf || '-') + '</span></td><td>' + esc(r.opzegging || '-') + '</td><td>' + esc(r.einddatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ondertekend, 'Ondertekend', 'Wacht') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam) + (r.salaris ? '<div class="lay-sub">' + esc(r.salaris) + '</div>' : '') + '</td><td>' + bDoc(r.docUrl, 'Getekend') + ' ' + bDoc(r.briefUrl, '⬇ Brief') + '</td><td>' + omBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('ontslag', r.rij, r.naam) + '</td></tr>';
    }).join('') || '<tr><td colspan="12" class="leeg grijs">Geen dossiers</td></tr>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-om-rij]');
    if (b) {
      var rij = parseInt(b.getAttribute('data-om-rij'), 10);
      var r = (omData || []).concat((ovData && ovData.open.ontslag) || []).find(function (x) { return x.rij === rij; });
      openOntslagMail(r || null); return;
    }
    var a = e.target.closest && e.target.closest('button[data-om-aanzeg]');
    if (a) openOntslagMail({ naam: a.getAttribute('data-naam'), email: a.getAttribute('data-email'), bedrijf: a.getAttribute('data-bv'), einddatum: a.getAttribute('data-eind'), type: 'aanzegging' });
  });
  window.openOntslagMail = async function (persoon) {
    if (!omTpl.length) { var d = await api('/api/ontslag'); if (d.success) { omTpl = d.templates; omData = d.rijen; } }
    if (!vbBvs.length) { var b = await api('/api/brieven'); if (b.success) vbBvs = b.bvs; }
    g('om-bv-list').innerHTML = vbBvs.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
    omRij = persoon && persoon.rij ? persoon.rij : null;
    g('om-to').value = persoon ? persoon.email || '' : '';
    g('om-naam').value = persoon ? persoon.naam || '' : '';
    g('om-bv').value = persoon ? persoon.bedrijf || '' : '';
    g('om-adres').value = persoon ? persoon.adres || '' : '';
    g('om-opz').value = persoon ? persoon.opzegging || '' : '';
    g('om-eind').value = persoon ? persoon.einddatum || '' : '';
    // Slimme default: aanzegging-dossier -> aanzegging; al verstuurd -> herinnering
    omKey = persoon && persoon.type === 'aanzegging' ? (isVerz(persoon.status) ? 'ontslag-herinnering' : 'aanzegging-nl') : (persoon && isVerz(persoon.status) ? 'ontslag-herinnering' : 'ontslag-pdf');
    omBouwTbar(); omHerbouw();
    g('om-zoek').value = ''; g('om-zoek-res').classList.remove('open');
    g('om-modal').classList.add('open');
    if (!persoon) setTimeout(function () { g('om-zoek').focus(); }, 60);
  };
  window.closeOntslagMail = function () { g('om-modal').classList.remove('open'); };
  g('om-modal').addEventListener('click', function (e) { if (e.target === this) closeOntslagMail(); });
  function omT() { return omTpl.find(function (x) { return x.key === omKey; }) || {}; }
  function omBouwTbar() {
    g('om-tbar').innerHTML = omTpl.map(function (t) { return '<button type="button" class="tb' + (t.key === omKey ? ' sel' : '') + '" data-omtpl="' + t.key + '">' + esc(t.label) + '</button>'; }).join('');
    g('om-tbar').querySelectorAll('[data-omtpl]').forEach(function (b) { b.onclick = function () { omKey = b.getAttribute('data-omtpl'); omBouwTbar(); omHerbouw(); }; });
    var t = omT(), isA = t.type === 'aanzegging';
    g('om-titel').textContent = isA ? t.label : (t.pdf ? 'Mail + PDF — Ontslag' : 'Mail — Herinnering ondertekening');
    g('om-pn').style.display = t.pdf ? '' : 'none';
    g('om-aanzeg').style.display = isA ? '' : 'none';
    g('om-fg-opz').style.display = isA ? 'none' : '';
    g('om-pdfbtn').style.display = t.pdf ? '' : 'none';
    omAanzegDagen();
  }
  window.omAanzegDagen = function () {
    var v = g('om-eind').value.trim(), el = g('om-dagen');
    if (!v) { el.textContent = ''; return; }
    var m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (!m) { el.textContent = ' (datum niet herkend)'; return; }
    var eind = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)), nu = new Date(); nu.setHours(0, 0, 0, 0);
    var dgn = Math.round((eind - nu) / 864e5);
    if (dgn >= 30) el.innerHTML = ' — <span style="color:#006b30">' + dgn + ' dagen tot einddatum: op tijd ✓</span>';
    else if (dgn >= 0) el.innerHTML = ' — <span style="color:#c0392b">LET OP: ' + dgn + ' dagen tot einddatum — ' + (30 - dgn) + ' dagen te laat = pro-rata vergoeding</span>';
    else el.innerHTML = ' — <span style="color:#c0392b">Einddatum ligt in het verleden</span>';
  };
  window.omHerbouw = async function () {
    var t = omT(); if (!t.key) return;
    g('om-subj').value = (t.subject || '').replace('[BV]', g('om-bv').value.trim() || 'SLA');
    g('om-tekst').value = 'Tekst laden…';
    var r = await api('/api/ontslag-mail', { template: omKey, naam: g('om-naam').value.trim(), bv: g('om-bv').value.trim(), einddatum: g('om-eind').value.trim(), preview: true });
    if (r.success) g('om-tekst').value = r.text; else g('om-tekst').value = '(kon template niet laden: ' + r.bericht + ')';
  };
  function omLees() {
    return { template: omKey, to: g('om-to').value.trim(), naam: g('om-naam').value.trim(), bv: g('om-bv').value.trim(), adres: g('om-adres').value.trim(), datumOpzegging: g('om-opz').value.trim(), einddatum: g('om-eind').value.trim(), rij: omRij, subject: g('om-subj').value.trim(), body: g('om-tekst').value };
  }
  window.omKopieer = function () { navigator.clipboard.writeText('Onderwerp: ' + g('om-subj').value + '\n\n' + g('om-tekst').value).then(function () { toast('Gekopieerd', 'ok'); }); };
  window.omPdf = async function () {
    var p = omLees();
    if (!p.naam) { toast('Vul eerst de naam in', 'err'); return; }
    var b = g('om-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/ontslag-mail', Object.assign(p, { alleenPdf: true }));
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Brief.pdf');
  };
  window.omVerstuur = async function () {
    var p = omLees();
    if (!p.to || !p.naam) { toast('Vul e-mail en naam in', 'err'); return; }
    var t = omT();
    if (t.type === 'aanzegging' && !p.einddatum) { toast('Vul de einddatum in (staat in de aanzegging)', 'err'); return; }
    if (t.key === 'ontslag-pdf' && !confirm('Ontslagbevestiging + PDF versturen naar ' + p.to + '?')) return;
    var b = g('om-sbtn'); b.disabled = true; g('om-slbl').textContent = t.pdf ? 'PDF maken en versturen…' : 'Versturen…';
    var r = await api('/api/ontslag-mail', p);
    b.disabled = false; g('om-slbl').textContent = 'Verstuur mail';
    if (r.success) { toast(r.bericht, r.bericht.indexOf('LET OP') > -1 ? 'err' : 'ok'); closeOntslagMail(); omData = null; laadOntslag(); laadOverzicht(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  function downloadB64(b64, naam) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    var a = document.createElement('a'); a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---------- Sommaties (port van openSomM/verstuurSom/printSom + VrijeBrief-uitbreiding) ----------
  var smData = null, smTypes = [], smKleur = {}, smHints = {}, smType = '1e Sommatie';
  var smSheetKleur = { '1e Sommatie': '#009f4b', '2e Sommatie': '#e8824a', 'Finale Sommatie': '#c0392b', 'Ontslag op Staande Voet': '#333d3a', 'Oproepbrief': '#2980b9' };
  function smBriefBtn(r) { return '<button class="btn bsm" style="background:#333d3a;color:#fff" data-sm-print="' + r.rij + '">Brief</button>'; }
  window.laadSommaties = async function () {
    var d = await api('/api/sommatie');
    if (!d.success) { toast('Sommaties: ' + d.bericht, 'err'); return; }
    smData = d.rijen; smTypes = d.types; smKleur = d.kleuren; smHints = d.hints;
    g('sm-count').textContent = smData.length + ' verstuurd';
    g('sm-body').innerHTML = smData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge" style="background:' + (smSheetKleur[r.type] || '#333d3a') + ';color:#fff">' + esc(r.type) + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.datumAfwezig || '-') + '</td><td>' + esc(r.datumAfspraak || '-') + '</td><td>' + esc(r.verzenddatum || '-') + '</td><td><span class="badge boat">' + esc(r.status || '-') + '</span></td><td>' + bTog('som-verwerkt', r.verwerkt, r.rij, r.naam) + '</td><td><div class="vb-knoppen">' + smBriefBtn(r) + dosBtn(r.naam, r.email) + bArch('sommatie', r.rij, r.naam) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">Nog geen sommaties verstuurd</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-sm-print]');
    if (!b) return;
    if (!smData) await laadSommaties();
    var rij = b.getAttribute('data-sm-print');
    var r = (smData || []).concat((ovData && ovData.open.sommatie) || []).find(function (x) { return String(x.rij) === rij; });
    if (r) smPrint(r, r.aanvullend || '');
  });
  window.openSomModal = async function (d) {
    if (!smTypes.length) { var r = await api('/api/sommatie'); if (r.success) { smTypes = r.types; smKleur = r.kleuren; smHints = r.hints; smData = r.rijen; } }
    ['sm-naam', 'sm-email', 'sm-bv', 'sm-mgr', 'sm-afwezig', 'sm-afspraak', 'sm-eigen', 'sm-zoek'].forEach(function (id) { g(id).value = ''; });
    if (d) { g('sm-naam').value = d.naam || ''; g('sm-email').value = d.email || ''; g('sm-bv').value = d.bv || ''; }
    g('sm-zoek-res').classList.remove('open');
    smZetType(d && d.type && smTypes.indexOf(d.type) > -1 ? d.type : '1e Sommatie');
    g('sm-modal').classList.add('open');
    if (!d) setTimeout(function () { g('sm-zoek').focus(); }, 60);
  };
  window.closeSomModal = function () { g('sm-modal').classList.remove('open'); };
  g('sm-modal').addEventListener('click', function (e) { if (e.target === this) closeSomModal(); });
  function smZetType(t) {
    smType = t;
    g('sm-titel').textContent = 'Sommatie versturen — ' + t;
    g('sm-tbar').innerHTML = smTypes.map(function (x) { return '<button type="button" class="tb' + (x === t ? ' sel' : '') + '" data-smtype="' + esc(x) + '" style="' + (x === t ? 'background:' + (smSheetKleur[x] || '#333d3a') + ';border-color:' + (smSheetKleur[x] || '#333d3a') + ';color:#fff' : '') + '">' + esc(x) + '</button>'; }).join('');
    g('sm-tbar').querySelectorAll('[data-smtype]').forEach(function (b) { b.onclick = function () { smZetType(b.getAttribute('data-smtype')); }; });
    var h = g('sm-hint'); if (smHints[t]) { h.innerHTML = smHints[t]; h.style.display = ''; h.style.borderLeftColor = smSheetKleur[t] || '#333d3a'; } else h.style.display = 'none';
    g('sm-mgr-wrap').style.display = t === 'Oproepbrief' ? '' : 'none';
    g('sm-afspraak-hint').style.display = t === 'Finale Sommatie' ? '' : 'none';
    g('sm-modal').querySelector('.mh').style.background = smSheetKleur[t] || '#333d3a';
  }
  function smDatumAfwezig() { var v = g('sm-afwezig').value; return v ? new Date(v + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  function smDatumAfspraak() { var v = g('sm-afspraak').value; return v ? new Date(v).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
  function smLees() {
    return { type: smType, naam: g('sm-naam').value.trim(), email: g('sm-email').value.trim(), bv: g('sm-bv').value.trim(), storeManager: g('sm-mgr').value.trim(), datumAfwezig: smDatumAfwezig(), datumAfspraak: smDatumAfspraak(), eigenTekst: g('sm-eigen').value.trim() };
  }
  window.smVerstuur = async function () {
    var p = smLees();
    if (!p.naam || !p.email) { toast('Vul naam en e-mail in', 'err'); return; }
    if ((p.type === 'Finale Sommatie' || p.type === 'Ontslag op Staande Voet') && !confirm(p.type + ' versturen naar ' + p.email + '?\n\nControleer dat het dossier compleet is.')) return;
    var b = g('sm-sbtn'); b.disabled = true; g('sm-slbl').textContent = 'Versturen…';
    var r = await api('/api/sommatie-mail', p);
    b.disabled = false; g('sm-slbl').textContent = 'Verstuur e-mail';
    if (r.success) { toast(r.bericht, 'ok'); closeSomModal(); smData = null; laadSommaties(); laadOverzicht(); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  window.smPrintNu = function () { var p = smLees(); if (!p.naam) { toast('Vul eerst de naam in', 'err'); return; } smPrint(p, p.eigenTekst); };
  koppelSbZoek('sm-zoek', 'sm-zoek-res', function (m) {
    if (!m) return;
    g('sm-naam').value = m.naam || ''; g('sm-email').value = m.email || '';
    if (m.winkelBv) g('sm-bv').value = m.winkelBv;
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
  });
  // Printbare aangetekende brief (vbPrintSommatie)
  function smPrint(d, eigenTekst) {
    var kleur = smSheetKleur[d.type] || '#333d3a', body = '', bv = esc(d.bv || 'SLA'), da = esc(d.datumAfwezig), dap = esc(d.datumAfspraak);
    if (d.type === 'Oproepbrief') {
      body += '<p>Wij constateren dat u al geruime tijd niet op uw werkplek bent verschenen en wij geen contact met u hebben kunnen krijgen.</p><p>Wij zien dat u nog altijd in dienst bent bij <strong>' + bv + '</strong> en hechten waarde aan uw situatie en welzijn.</p>';
      body += '<p>Wij verzoeken u vriendelijk om' + (dap ? ' uiterlijk op <strong>' + dap + '</strong>' : ' zo spoedig mogelijk') + ' telefonisch contact op te nemen met' + (d.storeManager ? ' <strong>' + esc(d.storeManager) + '</strong>' : ' uw Store Manager') + ', om uw situatie te bespreken.</p><p>Deze brief is niet bedoeld als formele maatregel. Wij hopen spoedig iets van u te horen.</p>';
    } else if (d.type === '1e Sommatie') {
      body += '<p>Wij constateren dat u ' + (da ? 'op <strong>' + da + '</strong> ' : 'op de afgesproken datum ') + 'niet bent verschenen op uw werkplek en/of niet bereikbaar was. Dit betreft ongeoorloofd verzuim.</p>';
      body += '<p>Wij sommeren u hierbij om <strong>binnen 24 tot 48 uur</strong> na ontvangst van deze brief contact op te nemen met uw leidinggevende of aanwezig te zijn op uw werklocatie.' + (dap ? ' Wij verzoeken u uiterlijk op <strong>' + dap + '</strong> aanwezig te zijn of contact op te nemen.' : '') + '</p>';
      body += '<p><strong>Loonopschorting:</strong> Zolang u uw werk niet hervat en geen contact opneemt, zijn wij genoodzaakt uw loon op te schorten. Dit betreft nadrukkelijk een <em>opschorting</em> en geen definitieve stopzetting van uw loon.</p><p>Indien u niet reageert op deze sommatie, zullen wij verdere maatregelen treffen. Dit kan leiden tot <strong>loonstopzetting en ontslag</strong>.</p>';
    } else if (d.type === '2e Sommatie') {
      body += '<p>Wij constateren dat u ' + (da ? 'op <strong>' + da + '</strong> ' : 'wederom ') + 'niet bent verschenen op uw werkplek en/of niet bereikbaar was, ondanks onze eerdere sommatie.</p>';
      body += '<p>Dit is uw <strong>tweede en laatste officiële waarschuwing</strong>. Wij sommeren u om ' + (dap ? 'uiterlijk op <strong>' + dap + '</strong> ' : 'per direct ') + 'contact op te nemen of aanwezig te zijn op uw werklocatie.</p>';
      body += '<p><strong>Loonstopzetting:</strong> Omdat u geen gehoor heeft gegeven aan onze eerdere sommatie, gaan wij over tot loonstopzetting. Met onmiddellijke ingang wordt geen loon meer uitbetaald totdat u uw werkzaamheden hervat.</p><p>Indien u ook op deze sommatie niet reageert, zijn wij genoodzaakt over te gaan tot <strong>ontslag</strong>.</p>';
    } else if (d.type === 'Finale Sommatie') {
      body += '<p>Wij constateren dat u, ondanks twee eerdere officiële sommaties, nog steeds niet bent verschenen op uw werkplek en/of geen contact heeft opgenomen.</p>' + (da ? '<p>Op <strong>' + da + '</strong> bent u wederom niet verschenen.</p>' : '') + '<p><strong>Dit is uw FINALE sommatie.</strong></p>';
      body += '<p>' + (dap ? 'U dient uiterlijk op <strong>' + dap + '</strong> aanwezig te zijn of contact op te nemen. ' : 'U dient per direct contact op te nemen. ') + 'Bij het uitblijven van een reactie gaan wij met onmiddellijke ingang over tot <strong>ontslag op staande voet</strong>.</p><p>Uw volledige dossier, inclusief alle eerdere contactpogingen en sommaties, is gereed voor dit besluit.</p>';
      body += '<p style="font-size:10pt;color:#888;font-style:italic">Wij hebben u heden tevens een e-mail gestuurd. De reactietermijn geldt vanaf ontvangst van dit schrijven.</p>';
    } else {
      body += '<p>Tot onze spijt delen wij u hierbij mede dat uw dienstverband bij <strong>' + bv + '</strong> per direct en met onmiddellijke ingang wordt beëindigd wegens <strong>ontslag op staande voet</strong>.</p><p>Dit besluit is genomen na herhaaldelijk ongeoorloofd verzuim en het niet reageren op meerdere officiële sommaties, hetgeen een dringende reden vormt in de zin van artikel 7:677 BW.</p>';
      body += (da ? '<p>Uw meest recente ongeoorloofde afwezigheid betrof <strong>' + da + '</strong>.</p>' : '') + (dap ? '<p>Wij verzoeken u om op <strong>' + dap + '</strong> aanwezig te zijn voor de administratieve afwikkeling en het ophalen van uw persoonlijke eigendommen.</p>' : '') + '<p>Een schriftelijke bevestiging van dit ontslag ontvangt u per aangetekende post. Wij adviseren u zo nodig juridisch advies in te winnen.</p>';
    }
    if (eigenTekst && eigenTekst.trim()) body += vbAlineas(eigenTekst);
    vbOpenPrintBrief({ titel: d.type, onderwerp: d.type, naam: d.naam, bv: d.bv, bodyHtml: body, aangetekend: true, kleur: kleur });
  }

  // ---------- Overplaatsing / standplaatswijziging (port van getOverplaatsingUI) ----------
  var opData = null, opWinkels = [], opRij = null;
  function opBtn(r) { return '<button class="btn bp bsm" data-op-rij="' + r.rij + '">Mail</button>'; }
  window.laadOverplaatsingen = async function () {
    var d = await api('/api/overplaatsing');
    if (!d.success) { toast('Overplaatsing: ' + d.bericht, 'err'); return; }
    opData = d.rijen; opWinkels = d.winkels;
    g('op-count').textContent = opData.length + ' dossiers';
    g('op-body').innerHTML = opData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bo">' + esc(r.type || 'Overplaatsing') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.huidigeBV) + '</span> → <span class="badge boat">' + esc(r.nieuweBV) + '</span></td><td>' + esc(r.standplaats || '-') + '</td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ondertekend', 'Aanvinken') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td><div class="vb-knoppen">' + opBtn(r) + bDoc(r.briefUrl, '⬇ Brief') + dosBtn(r.naam, r.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">Geen overplaatsingen</td></tr>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-op-rij]');
    if (!b) return;
    var rij = parseInt(b.getAttribute('data-op-rij'), 10);
    var r = (opData || []).concat((ovData && ovData.open.overplaatsing) || []).find(function (x) { return x.rij === rij; });
    openOpModal(r || null);
  });
  window.openOpModal = async function (d) {
    if (!opWinkels.length) { var w = await api('/api/overplaatsing'); if (w.success) { opWinkels = w.winkels; opData = w.rijen; } }
    var opts = '<option value="">-- selecteer --</option>' + opWinkels.map(function (w) { return '<option value="' + esc(w.code) + '">' + esc(w.naam) + ' (' + esc(w.code) + ') - ' + esc(w.bv) + '</option>'; }).join('');
    g('op-van').innerHTML = opts; g('op-naar').innerHTML = opts;
    opRij = d && d.rij ? d.rij : null;
    g('op-naam').value = d ? d.naam || '' : ''; g('op-to').value = d ? d.email || '' : ''; g('op-adres').value = d ? d.adres || '' : '';
    g('op-functie').value = d ? d.functie || '' : ''; g('op-indienst').value = d ? d.datumIndienst || '' : ''; g('op-ingang').value = d ? d.ingangsdatum || '' : '';
    g('op-taal').value = d && d.taal === 'EN' ? 'EN' : 'NL';
    g('op-van').value = d ? opCodeBijBv(d.huidigeBV, null) : ''; g('op-naar').value = d ? opCodeBijBv(d.nieuweBV, d.standplaats) : '';
    g('op-zoek').value = ''; g('op-zoek-res').classList.remove('open');
    opCheckType(); opCheckIngang();
    g('op-modal').classList.add('open');
    if (!d) setTimeout(function () { g('op-zoek').focus(); }, 60);
  };
  function opCodeBijBv(bv, winkelNaam) {
    var w = winkelNaam ? opWinkels.find(function (x) { return x.naam === winkelNaam; }) : null;
    if (!w && bv) w = opWinkels.find(function (x) { return x.bv === bv; });
    return w ? w.code : '';
  }
  window.closeOpModal = function () { g('op-modal').classList.remove('open'); };
  g('op-modal').addEventListener('click', function (e) { if (e.target === this) closeOpModal(); });
  window.opCheckType = function () {
    var van = g('op-van').value, naar = g('op-naar').value, info = g('op-type-info');
    if (!van || !naar) { info.style.display = 'none'; return; }
    var wv = opWinkels.find(function (w) { return w.code === van; }), wn = opWinkels.find(function (w) { return w.code === naar; });
    info.style.display = '';
    if (van === naar) { info.className = 'alert rood'; info.innerHTML = '⚠ Van en naar zijn dezelfde winkel — selecteer een andere bestemming.'; return; }
    if (wv.bv === wn.bv) { info.className = 'alert grijs'; info.innerHTML = '☰ <strong>Standplaatswijziging</strong> — ' + esc(wv.naam) + ' en ' + esc(wn.naam) + ' vallen beide onder <strong>' + esc(wv.bv) + '</strong>. Geen werkgeverswissel, alleen de werkplek verandert. Brief: standplaatswijziging op grond van art. 7:613 BW.'; }
    else { info.className = 'alert groen'; info.innerHTML = '✓ <strong>Overplaatsing tussen BV\'s</strong> — van <strong>' + esc(wv.bv) + '</strong> naar <strong>' + esc(wn.bv) + '</strong>. Contractsoverneming met behoud van dienstjaren op grond van art. 6:159 BW.'; }
    g('op-pn').textContent = (wv.bv === wn.bv ? 'Standplaatswijziging' : 'Overplaatsing') + (g('op-taal').value === 'EN' ? ' (EN)' : '') + ' — PDF-brief gaat als bijlage mee; de medewerker ondertekent en uploadt via de link in de mail.';
  };
  window.opCheckIngang = function () {
    var v = g('op-ingang').value.trim(), info = g('op-ingang-info');
    if (!v) { info.innerHTML = ''; return; }
    var m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (!m) { info.innerHTML = '<span style="color:#888">Datum niet herkend (verwacht: dd-mm-jjjj)</span>'; return; }
    var d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)), nu = new Date(); nu.setHours(0, 0, 0, 0);
    var dgn = Math.round((d - nu) / 864e5);
    info.innerHTML = dgn < 0 ? '<span style="color:#c0392b">⚠ Datum ligt in het verleden</span>' : dgn < 14 ? '<span style="color:#e8824a">⚠ Korte termijn: ' + dgn + ' dagen vooruit (let op redelijke termijn)</span>' : '<span style="color:#006b30">✓ ' + dgn + ' dagen vooruit</span>';
  };
  function opLees() {
    return { naam: g('op-naam').value.trim(), to: g('op-to').value.trim(), adres: g('op-adres').value.trim(), huidigeWinkel: g('op-van').value, nieuweWinkel: g('op-naar').value, datumIndienst: g('op-indienst').value.trim(), ingangsdatum: g('op-ingang').value.trim(), functie: g('op-functie').value.trim(), taal: g('op-taal').value, rij: opRij };
  }
  function opCheck(p) {
    if (!p.naam || !p.to) { toast('Vul naam en e-mail in', 'err'); return false; }
    if (!p.huidigeWinkel || !p.nieuweWinkel) { toast('Selecteer huidige en nieuwe winkel', 'err'); return false; }
    if (p.huidigeWinkel === p.nieuweWinkel) { toast('Van en naar zijn dezelfde winkel', 'err'); return false; }
    if (!p.ingangsdatum) { toast('Vul de ingangsdatum in', 'err'); return false; }
    return true;
  }
  window.opPdf = async function () {
    var p = opLees(); p.to = p.to || 'x@x';
    if (!p.naam || !p.huidigeWinkel || !p.nieuweWinkel) { toast('Vul naam en beide winkels in', 'err'); return; }
    var b = g('op-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/overplaatsing-mail', Object.assign(p, { alleenPdf: true }));
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Brief.pdf');
  };
  window.opVerstuur = async function () {
    var p = opLees(); if (!opCheck(p)) return;
    var b = g('op-sbtn'); b.disabled = true; g('op-slbl').textContent = 'PDF maken en versturen…';
    var r = await api('/api/overplaatsing-mail', p);
    b.disabled = false; g('op-slbl').textContent = 'Verstuur + PDF';
    if (r.success) { toast(r.bericht, 'ok'); closeOpModal(); opData = null; laadOverplaatsingen(); laadOverzicht(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('op-zoek', 'op-zoek-res', function (m) {
    if (!m) return;
    g('op-naam').value = m.naam || ''; g('op-to').value = m.email || '';
    if (m.adres) g('op-adres').value = m.adres;
    if (m.functie) g('op-functie').value = m.functie;
    if (m.indienst) g('op-indienst').value = m.indienst;
    if (m.winkelCode && opWinkels.some(function (w) { return w.code === m.winkelCode; })) g('op-van').value = m.winkelCode;
    opCheckType();
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
  });

  // ---------- Signaleringen (stap 4: scheduled functions + handmatig draaien) ----------
  var sgData = null;
  window.laadSignaleringen = async function () {
    var d = await api('/api/signalering');
    if (!d.success) { toast('Signaleringen: ' + d.bericht, 'err'); return; }
    sgData = d;
    g('sg-status').textContent = d.actief ? 'ACTIEF — mailt echt' : 'DROOGLOOP';
    g('sg-status').style.background = d.actief ? '#009f4b' : '#e8824a'; g('sg-status').style.color = '#fff';
    g('sg-uitleg').innerHTML = d.actief
      ? '<strong>Actief.</strong> De checks draaien volgens schema in Netlify en versturen echte mails. Zorg dat de Apps Script-triggers uit staan, anders krijgen medewerkers dubbele herinneringen.'
      : '<strong>Droogloop.</strong> De checks draaien volgens schema in Netlify, maar versturen niets en schrijven niets — ze rapporteren alleen wat ze zouden doen (zie Laatste runs). Zet in Netlify <code>SIGNALERINGEN_ACTIEF=1</code> op het moment dat je de Apps Script-triggers uitzet. Met <em>Droogloop nu</em> zie je direct wat een check vandaag zou doen.';
    g('sg-cards').innerHTML = d.checks.map(function (c) {
      return '<div class="dos-kaart"><div style="font-weight:700;color:#333d3a;margin-bottom:4px">' + esc(c.label) + ' <span class="badge boat">' + esc(c.wanneer) + '</span></div><div class="lay-sub" style="margin-bottom:10px">' + esc(c.wat) + '</div><div class="vb-knoppen"><button class="btn bd bsm" data-sg-run="' + esc(c.key) + '" data-droog="1">Droogloop nu</button>' + (d.actief ? '<button class="btn bp bsm" data-sg-run="' + esc(c.key) + '" data-droog="0">Nu echt draaien</button>' : '') + '</div></div>';
    }).join('');
    g('sg-body').innerHTML = (d.laatste || []).map(function (r) {
      return '<tr><td>' + esc(new Date(r.tijdstip).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })) + '</td><td>' + esc(r.check) + '</td><td>' + esc(r.bron) + '</td><td>' + (r.droog ? '<span class="badge boat">droog</span>' : '<span class="badge bg">echt</span>') + '</td><td>' + r.gevonden + '</td><td>' + r.verstuurd + '</td><td>' + (r.fouten ? '<span class="badge br">' + r.fouten + '</span>' : '0') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="leeg grijs">Nog geen runs gelogd (tabel hr_signaleringen — migratie 0004)</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-sg-run]');
    if (!b) return;
    var check = b.getAttribute('data-sg-run'), droog = b.getAttribute('data-droog') === '1';
    if (!droog && !confirm('Check "' + check + '" nu ECHT draaien? Er worden mails verstuurd en sheets bijgewerkt.')) return;
    b.disabled = true; var oud = b.textContent; b.textContent = 'Bezig…';
    g('sg-rapport-sec').style.display = ''; g('sg-rapport-titel').textContent = 'Resultaat — ' + check + (droog ? ' (droogloop)' : ''); g('sg-rapport').innerHTML = '<span class="lay-sub">Shiftbase en sheets lezen…</span>';
    var r = await api('/api/signalering', { check: check, droog: droog });
    b.disabled = false; b.textContent = oud;
    if (!r.success) { g('sg-rapport').innerHTML = '<span style="color:#c0392b">' + esc(r.bericht) + '</span>'; return; }
    var rap = r.rapport, h = '<div class="lay-sub" style="margin-bottom:8px">' + rap.gevonden.length + ' gevonden · ' + rap.verstuurd.length + (rap.droog ? ' zou(den) verstuurd worden' : ' verstuurd') + ' · ' + rap.fouten.length + ' fouten · ' + rap.duurMs + ' ms</div>';
    if (rap.fouten.length) h += '<div class="alert rood">' + rap.fouten.map(esc).join('<br>') + '</div>';
    if (!rap.gevonden.length) h += '<div class="alert groen">Niets te doen vandaag.</div>';
    else h += '<div class="tw"><table><tbody>' + rap.gevonden.map(function (x) { return '<tr>' + Object.keys(x).map(function (k) { return '<td><div class="lay-sub">' + esc(k) + '</div>' + esc(x[k] === null || x[k] === undefined ? '-' : x[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    g('sg-rapport').innerHTML = h;
    laadSignaleringen();
  });

  // ---------- Vrije brieven (port van getVrijeBriefUI, VrijeBrief.gs v1.2) ----------
  var vbData = null, vbTpl = [], vbBvs = [], vbWinkelBv = {}, vbTplKey = 'leeg', vbAfzender = 'SLA HR Team';
  window.laadBrieven = async function () {
    var d = await api('/api/brieven');
    if (!d.success) { toast('Brieven: ' + d.bericht, 'err'); return; }
    vbData = d.rijen; vbTpl = d.templates; vbBvs = d.bvs; vbWinkelBv = d.winkelBv || {}; vbAfzender = d.afzender || vbAfzender;
    g('vb-bv-list').innerHTML = vbBvs.map(function (b) { return '<option value="' + esc(b) + '">'; }).join('');
    g('vb-count').textContent = vbData.length + ' verstuurd';
    g('vb-body').innerHTML = vbData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bdk">' + esc(r.categorie || '-') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.onderwerp || '-') + '</td><td>' + (r.pdf === 'Ja' ? '<span class="badge bg">Ja</span>' : '<span class="no-doc">-</span>') + '</td><td>' + esc(r.verzenddatum || '-') + '</td><td><div class="vb-knoppen"><button class="btn bd bsm" data-vb-opnieuw="' + r.rij + '">Opnieuw</button><button class="btn bsm" style="background:#333d3a;color:#fff" data-vb-print="' + r.rij + '">Brief</button>' + dosBtn(r.naam, r.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="8" class="leeg grijs">Nog geen brieven verstuurd</td></tr>';
  };
  function vbZoekRij(rij) { return (vbData || []).find(function (x) { return String(x.rij) === String(rij); }) || null; }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && (e.target.closest('button[data-vb-opnieuw]') || e.target.closest('button[data-vb-print]'));
    if (!b) return;
    if (!vbData) await laadBrieven();
    var rij = b.getAttribute('data-vb-opnieuw') || b.getAttribute('data-vb-print');
    var r = vbZoekRij(rij);
    if (!r) { toast('Brief niet gevonden — ververs de lijst', 'err'); return; }
    if (b.hasAttribute('data-vb-opnieuw')) openVbModal(r);
    else vbOpenPrintBrief({ titel: r.categorie || 'Personeelszaken', onderwerp: r.onderwerp, naam: r.naam, bv: r.bv, bodyHtml: vbAlineas(r.tekst) });
  });
  window.openVbModal = async function (d) {
    if (!vbTpl.length) await laadBrieven();
    g('vb-naam').value = d ? d.naam || '' : '';
    g('vb-email').value = d ? d.email || '' : '';
    g('vb-bv').value = d ? d.bv || '' : '';
    g('vb-datum').value = '';
    g('vb-cat').value = d ? d.categorie || 'Personeelszaken' : 'Personeelszaken';
    g('vb-subj').value = d ? d.onderwerp || '' : '';
    g('vb-tekst').value = d ? d.tekst || '' : '';
    g('vb-pdf').checked = true;
    g('vb-zoek').value = ''; g('vb-zoek-res').classList.remove('open');
    vbTplKey = 'leeg'; vbBouwTbar(); g('vb-tpl-hint').style.display = 'none';
    g('vb-modal').classList.add('open');
    setTimeout(function () { g(d ? 'vb-tekst' : 'vb-zoek').focus(); }, 60);
  };
  window.closeVbModal = function () { g('vb-modal').classList.remove('open'); };
  g('vb-modal').addEventListener('click', function (e) { if (e.target === this) closeVbModal(); });
  function vbBouwTbar() {
    g('vb-tbar').innerHTML = vbTpl.map(function (t) { return '<button type="button" class="tb' + (t.key === vbTplKey ? ' sel' : '') + '" data-vbtpl="' + t.key + '">' + esc(t.label) + '</button>'; }).join('');
    g('vb-tbar').querySelectorAll('[data-vbtpl]').forEach(function (b) { b.onclick = function () { vbKiesTpl(b.getAttribute('data-vbtpl')); }; });
  }
  function vbVar(str) {
    var n = g('vb-naam').value.trim() || '[Naam]', b = g('vb-bv').value.trim() || 'SLA', d = g('vb-datum').value.trim() || '[datum]';
    return String(str || '').split('{NAAM}').join(n).split('{BV}').join(b).split('{DATUM}').join(d);
  }
  function vbKiesTpl(key) {
    vbTplKey = key; vbBouwTbar();
    var t = vbTpl.find(function (x) { return x.key === key; }) || {};
    var hint = g('vb-tpl-hint');
    if (t.hint) { hint.innerHTML = '💡 ' + esc(t.hint); hint.style.display = ''; } else hint.style.display = 'none';
    g('vb-subj').value = t.subject ? vbVar(t.subject) : '';
    g('vb-tekst').value = t.body ? vbVar(t.body) : '';
  }
  // Template live hervullen zolang de tekst nog niet handmatig is aangepast
  window.vbHervulTpl = function () {
    var t = vbTpl.find(function (x) { return x.key === vbTplKey; }); if (!t || !t.body) return;
    var ta = g('vb-tekst'), kaal = t.body.split('{NAAM}').join('').split('{BV}').join('').split('{DATUM}').join('');
    var ongewijzigd = ta.value.indexOf(kaal.substring(0, 40)) > -1 || ta.value.indexOf(kaal.substring(3, 43)) > -1;
    if (ta.value === '' || ongewijzigd) { ta.value = vbVar(t.body); g('vb-subj').value = vbVar(t.subject); }
  };
  // Shiftbase-zoekveld in een modal (zelfde lijst als het dossier); onKies(m) vult de velden
  function koppelSbZoek(inpId, resId, onKies) {
    var inp = g(inpId), res = g(resId);
    inp.oninput = function () {
      var q = inp.value.trim().toLowerCase();
      if (q.length < 2) { res.classList.remove('open'); return; }
      if (!medewerkers.length) { res.innerHTML = '<button type="button" disabled><small>Shiftbase-lijst wordt nog geladen…</small></button>'; res.classList.add('open'); return; }
      var hits = medewerkers.filter(function (m) { return m.naam.toLowerCase().indexOf(q) > -1 || (m.email || '').toLowerCase().indexOf(q) > -1; }).slice(0, 12);
      res.innerHTML = hits.length ? hits.map(function (m) { return '<button type="button" data-id="' + esc(m.id) + '"><strong>' + esc(m.naam) + '</strong><small>' + esc(m.winkelNaam || '-') + ' · ' + esc(m.email || '(geen e-mail)') + '</small></button>'; }).join('')
        : '<button type="button" disabled><small>Geen medewerker gevonden — vul handmatig in</small></button>';
      res.classList.add('open');
      res.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { inp.value = ''; res.classList.remove('open'); onKies(medewerkers.find(function (m) { return m.id === b.getAttribute('data-id'); })); }; });
    };
    inp.onblur = function () { setTimeout(function () { res.classList.remove('open'); }, 180); };
  }
  koppelSbZoek('vb-zoek', 'vb-zoek-res', vbKies);
  koppelSbZoek('om-zoek', 'om-zoek-res', function (m) {
    if (!m) return;
    g('om-naam').value = m.naam || ''; g('om-to').value = m.email || '';
    if (m.winkelBv) g('om-bv').value = m.winkelBv;
    if (m.adres) g('om-adres').value = m.adres;
    if (m.contractEinde && !g('om-eind').value) { g('om-eind').value = m.contractEinde; omAanzegDagen(); }
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
    omHerbouw();
  });
  koppelSbZoek('lm-zoek', 'lm-zoek-res', function (m) {
    if (!m) return;
    g('lm-naam').value = m.naam || ''; g('lm-to').value = m.email || '';
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
    lmHerbouw();
  });
  function vbKies(m) {
    if (!m) return;
    g('vb-naam').value = m.naam || ''; g('vb-email').value = m.email || '';
    var bv = m.winkelBv || '';
    if (!bv && m.winkelNaam) { var wn = m.winkelNaam.toLowerCase(); Object.keys(vbWinkelBv).forEach(function (w) { if (!bv && (wn.indexOf(w.toLowerCase()) > -1 || w.toLowerCase().indexOf(wn) > -1)) bv = vbWinkelBv[w]; }); }
    if (bv) g('vb-bv').value = bv;
    g('vb-zoek').value = ''; g('vb-zoek-res').classList.remove('open');
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
    else if (!bv && m.winkelNaam) toast('BV niet herkend voor winkel ' + m.winkelNaam + ' — kies zelf de BV', 'err');
    vbHervulTpl();
  }
  function vbLees() {
    return { naam: g('vb-naam').value.trim(), email: g('vb-email').value.trim(), bv: g('vb-bv').value.trim(), categorie: g('vb-cat').value.trim() || 'Personeelszaken', onderwerp: g('vb-subj').value.trim(), tekst: g('vb-tekst').value, metPdf: g('vb-pdf').checked };
  }
  window.vbVerstuur = async function () {
    var p = vbLees();
    if (!p.naam || !p.email) { toast('Vul naam en e-mail in', 'err'); return; }
    if (!p.tekst.trim()) { toast('De brief is nog leeg', 'err'); return; }
    if (!p.onderwerp) { toast('Vul een onderwerp in', 'err'); return; }
    var b = g('vb-sbtn'); b.disabled = true; g('vb-slbl').textContent = 'Versturen…';
    var r = await api('/api/brief-mail', p);
    b.disabled = false; g('vb-slbl').textContent = 'Verstuur brief';
    if (r.success) { toast(r.bericht, 'ok'); closeVbModal(); laadBrieven(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  window.vbKopieer = function () {
    var txt = 'Onderwerp: ' + g('vb-subj').value + '\n\nBeste ' + g('vb-naam').value + ',\n\n' + g('vb-tekst').value + '\n\nMet vriendelijke groet,\n' + vbAfzender + '\n' + (g('vb-bv').value.trim() || 'SLA');
    navigator.clipboard.writeText(txt).then(function () { toast('Gekopieerd', 'ok'); });
  };
  // PDF zoals die als bijlage meegaat, zonder te versturen (downloaden)
  window.vbPdf = async function () {
    var p = vbLees();
    if (!p.naam) { toast('Vul eerst de naam in', 'err'); return; }
    if (!p.tekst.trim()) { toast('De brief is nog leeg', 'err'); return; }
    toast('PDF maken…', 'ok');
    var r = await api('/api/brief-mail', Object.assign(p, { alleenPdf: true }));
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Brief.pdf');
  };
  function vbAlineas(txt) {
    var out = '';
    String(txt || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      var regels = b.split('\n'), isLijst = regels.every(function (r) { return /^\s*-\s+/.test(r) || !r.trim(); });
      if (isLijst) { out += '<ul>'; regels.forEach(function (r) { r = r.replace(/^\s*-\s+/, '').trim(); if (r) out += '<li>' + esc(r) + '</li>'; }); out += '</ul>'; }
      else out += '<p>' + regels.map(esc).join('<br>') + '</p>';
    });
    return out;
  }
  // Printbare brief (zelfde opmaak als de sommatie-printbrief in Apps Script)
  function vbOpenPrintBrief(o) {
    var datum = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), kleur = o.kleur || '#333d3a';
    var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>' + esc(o.titel) + ' - ' + esc(o.naam) + '</title><style>' +
      '@media print{@page{margin:2cm;size:A4}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}' +
      'body{font-family:Arial,sans-serif;font-size:12pt;color:#1a1a1a;padding:30px;max-width:700px;margin:0 auto}p{line-height:1.7;margin:0 0 12px}ul{margin:0 0 12px;padding-left:22px}li{line-height:1.7;margin:0 0 6px}' +
      'hr{border:none;border-top:2px solid ' + kleur + ';margin:20px 0}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px}.logo{font-size:22pt;font-weight:700;color:#009f4b;letter-spacing:-1px}.adres{font-size:9pt;color:#888;text-align:right;line-height:1.6}' +
      '.meta{margin:24px 0;border-left:4px solid ' + kleur + ';padding-left:14px}.meta p{margin:2px 0;font-size:10pt}.badge{display:inline-block;background:' + kleur + ';color:#fff;padding:4px 12px;border-radius:20px;font-size:10pt;font-weight:700;margin-bottom:16px}' +
      '.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:9pt;color:#888}.sign{margin-top:32px}.print-btn{position:fixed;bottom:24px;right:24px;background:#009f4b;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:12pt;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}' +
      '</style></head><body><button class="print-btn no-print" onclick="window.print()">🖨 Afdrukken</button>' +
      '<div class="header"><div class="logo">SLA</div><div class="adres">SLA HR Team<br>hr@ilovesla.com</div></div><hr>' +
      (o.aangetekend ? '<div style="background:#fff8e6;border:1px solid #f5a623;border-radius:6px;padding:10px 14px;font-size:10pt;color:#7a5c00;margin:16px 0">📧 <strong>Aangetekend te verzenden</strong> — Bewaar de bezorgbevestiging in het dossier</div>' : '') +
      '<div class="meta"><p><strong>Datum:</strong> ' + datum + '</p><p><strong>Aan:</strong> ' + esc(o.naam) + '</p>' + (o.bv ? '<p><strong>BV:</strong> ' + esc(o.bv) + '</p>' : '') + '</div>' +
      '<div class="badge">' + esc(o.titel) + '</div><p><strong>Betreft: ' + esc(o.onderwerp || o.titel) + '</strong></p><p>Beste ' + esc(o.naam) + ',</p>' + o.bodyHtml +
      '<div class="sign"><p>Met vriendelijke groet,</p><p><strong>' + esc(vbAfzender) + '</strong><br>' + esc(o.bv || 'SLA') + '</p></div>' +
      '<div class="footer"><p>' + (o.aangetekend ? 'ⓘ Dit schrijven is aangetekend verzonden op ' + datum + '. Bewaar de bezorgbevestiging en een kopie van deze brief in het personeelsdossier.' : 'Kopie van deze brief bewaren in het personeelsdossier.') + '</p></div></body></html>';
    var win = window.open('', '_blank', 'width=820,height=1000,scrollbars=yes');
    if (!win) { toast('Pop-up geblokkeerd — sta pop-ups toe voor deze site', 'err'); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(function () { win.print(); }, 600);
  }
  window.vbPrint = function () {
    var p = vbLees();
    if (!p.naam) { toast('Vul eerst de naam in', 'err'); return; }
    vbOpenPrintBrief({ titel: p.categorie, onderwerp: p.onderwerp, naam: p.naam, bv: p.bv, bodyHtml: vbAlineas(p.tekst) });
  };

  // ---------- Toast ----------
  function toast(msg, type) { var t = g('toast'); t.textContent = msg; t.className = 'toast ' + (type === 'ok' ? 'tok' : 'terr') + ' show'; setTimeout(function () { t.classList.remove('show'); }, 3400); }

  function toonVersie() {
    var v = window.HR_VERSIE || {};
    var txt = 'v' + (v.nummer || '?') + (v.datum ? ' · ' + v.datum : '') + (v.stap ? ' · stap ' + v.stap : '');
    g('voet-versie').textContent = txt;
    g('voet-versie').title = v.omschrijving || '';
    g('top-versie').textContent = 'NETLIFY · v' + (v.nummer || '?');
  }
  document.addEventListener('DOMContentLoaded', function () { toonVersie(); init(); });
})();
