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
  var ECHT = { overview: 1, dossier: 1, loonheffing: 1, brief: 1, ontslag: 1 };

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
    if (tab === 'dossier') setTimeout(function () { g('dos-zoek').focus(); }, 50);
    if (tab === 'loonheffing' && !lhData) laadLoonheffing();
    if (tab === 'brief' && !vbData) laadBrieven();
    if (tab === 'ontslag' && !omData) laadOntslag();
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
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bo">' + esc(r.type || 'Overplaatsing') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.huidigeBV) + '</span> → <span class="badge boat">' + esc(r.nieuweBV) + '</span></td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ondertekend', 'Aanvinken') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>-</td><td>' + dosBtn(r.naam, r.email) + '</td></tr>');
    });
    var somK = { '1e Sommatie': '#009f4b', '2e Sommatie': '#e8824a', 'Finale Sommatie': '#c0392b', 'Ontslag op Staande Voet': '#333d3a', 'Oproepbrief': '#2980b9' };
    d.open.sommatie.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge" style="background:' + (somK[r.type] || '#333d3a') + ';color:#fff">' + esc(r.type) + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.datumAfspraak || '-') + '</td><td>' + bSent(r.verzenddatum ? 'Verstuurd ' + r.verzenddatum : '') + '</td><td><span class="badge boat">' + esc(r.status || '-') + '</span></td><td>-</td><td>' + bTog('som-verwerkt', r.verwerkt, r.rij, r.naam) + '</td><td>' + dosBtn(r.naam, r.email) + ' ' + bArch('sommatie', r.rij, r.naam) + '</td></tr>');
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
  async function laadMedewerkers(forceer) {
    var d = await api('/api/medewerkers' + (forceer ? '?ververs=1' : ''));
    if (d.success) { medewerkers = d.medewerkers || []; if (forceer) toast(medewerkers.length + ' medewerkers opgehaald uit Shiftbase', 'ok'); }
    else toast('Shiftbase: ' + d.bericht, 'err');
  }
  function zetDossierZoek() {
    var inp = g('dos-zoek'), res = g('dos-res');
    inp.oninput = function () {
      var q = inp.value.trim().toLowerCase();
      if (q.length < 2) { res.classList.remove('open'); return; }
      var hits = medewerkers.filter(function (m) { return m.naam.toLowerCase().indexOf(q) > -1 || (m.email || '').toLowerCase().indexOf(q) > -1; }).slice(0, 12);
      res.innerHTML = hits.length ? hits.map(function (m) { return '<button type="button" data-id="' + esc(m.id) + '"><strong>' + esc(m.naam) + '</strong><small>' + esc(m.winkelNaam || '-') + (m.functie ? ' · ' + esc(m.functie) : '') + '</small></button>'; }).join('')
        : '<button type="button" disabled><small>Geen match in Shiftbase — zoek via het Overzicht op naam uit de sheets</small></button>';
      res.classList.add('open');
      res.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { res.classList.remove('open'); inp.value = ''; openDossier(null, null, b.getAttribute('data-id')); }; });
    };
    inp.onblur = function () { setTimeout(function () { res.classList.remove('open'); }, 180); };
    g('dos-ververs').onclick = function () { laadMedewerkers(true); };
  }
  window.openDossier = async function (naam, email, id) {
    laatsteDossier = [naam, email, id];
    swT('dossier', 'Medewerkers');
    g('dos-hint').style.display = 'none';
    g('dos-inhoud').innerHTML = '<div class="sec"><div class="leeg grijs"><span class="sp" style="border-color:rgba(0,0,0,.15);border-top-color:#009f4b"></span> Dossier laden...</div></div>';
    var qs = id ? 'id=' + encodeURIComponent(id) : 'naam=' + encodeURIComponent(naam || '') + '&email=' + encodeURIComponent(email || '');
    var d = await api('/api/dossier?' + qs);
    if (!d.success) { g('dos-inhoud').innerHTML = '<div class="alert rood">' + esc(d.bericht) + '</div>'; return; }
    var p = d.persoon, c = d.contract, h = '';
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
      case 'overplaatsing': return kv('Type', '<span class="badge bo">' + esc(r.type || '-') + '</span>') + kv('Van → naar', esc(r.huidigeBV) + ' → ' + esc(r.nieuweBV)) + kv('Ingangsdatum', esc(r.ingangsdatum || '-')) + kv('Mail', bSent(r.status)) + kv('Ondertekend', bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ja', 'Aanvinken')) + kv('Brief', bDoc(r.briefUrl, '⬇ PDF'));
      case 'sommatie': return kv('Type', '<span class="badge bdk">' + esc(r.type) + '</span>') + kv('BV', esc(r.bv || '-')) + kv('Afwezig', esc(r.datumAfwezig || '-')) + kv('Afspraak', esc(r.datumAfspraak || '-')) + kv('Verstuurd', esc(r.verzenddatum || '-')) + kv('Status', esc(r.status || '-')) + kv('Verwerkt', bTog('som-verwerkt', r.verwerkt, r.rij, r.naam)) + (r.aanvullend ? kv('Aanvullend', esc(r.aanvullend)) : '') + kv('', bArch('sommatie', r.rij, r.naam));
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
    g('lm-modal').classList.add('open');
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
    g('om-modal').classList.add('open');
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
  // Shiftbase-zoekveld in het modal (zelfde lijst als het dossier)
  (function () {
    var inp = g('vb-zoek'), res = g('vb-zoek-res');
    inp.oninput = function () {
      var q = inp.value.trim().toLowerCase();
      if (q.length < 2) { res.classList.remove('open'); return; }
      if (!medewerkers.length) { res.innerHTML = '<button type="button" disabled><small>Shiftbase-lijst wordt nog geladen…</small></button>'; res.classList.add('open'); return; }
      var hits = medewerkers.filter(function (m) { return m.naam.toLowerCase().indexOf(q) > -1 || (m.email || '').toLowerCase().indexOf(q) > -1; }).slice(0, 12);
      res.innerHTML = hits.length ? hits.map(function (m) { return '<button type="button" data-id="' + esc(m.id) + '"><strong>' + esc(m.naam) + '</strong><small>' + esc(m.winkelNaam || '-') + ' · ' + esc(m.email || '(geen e-mail)') + '</small></button>'; }).join('')
        : '<button type="button" disabled><small>Geen medewerker gevonden — vul handmatig in</small></button>';
      res.classList.add('open');
      res.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { vbKies(medewerkers.find(function (m) { return m.id === b.getAttribute('data-id'); })); }; });
    };
    inp.onblur = function () { setTimeout(function () { res.classList.remove('open'); }, 180); };
  })();
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
      '<div class="meta"><p><strong>Datum:</strong> ' + datum + '</p><p><strong>Aan:</strong> ' + esc(o.naam) + '</p>' + (o.bv ? '<p><strong>BV:</strong> ' + esc(o.bv) + '</p>' : '') + '</div>' +
      '<div class="badge">' + esc(o.titel) + '</div><p><strong>Betreft: ' + esc(o.onderwerp || o.titel) + '</strong></p><p>Beste ' + esc(o.naam) + ',</p>' + o.bodyHtml +
      '<div class="sign"><p>Met vriendelijke groet,</p><p><strong>' + esc(vbAfzender) + '</strong><br>' + esc(o.bv || 'SLA') + '</p></div>' +
      '<div class="footer"><p>Kopie van deze brief bewaren in het personeelsdossier.</p></div></body></html>';
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
