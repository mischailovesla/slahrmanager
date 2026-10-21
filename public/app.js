/* SLA HR Dashboard - Netlify (stap 3d: ontslag & aanzegging met Docs-PDF) */
(function () {
  'use strict';
  var g = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sb = null, sessie = null, cfg = null, ovData = null, medewerkers = [];

  // ---------- Nav: lifecycle-groepen (zelfde indeling als Layout.gs v1.8) ----------
  var GROEPEN = [
    { label: 'Instroom', items: [['loonheffing', 'Loonheffingsverklaring'], ['contract', 'Contracten & starters'], ['checkin', 'Check-in 30/60']] },
    { label: 'In dienst', items: [['loonheffingskorting', 'Loonheffingskorting'], ['oproepaanbod', 'Oproepaanbod'], ['overplaatsing', 'Overplaatsing'], ['vakantie', 'Vakantieplanner'], ['vastloners', 'Vastloners'], ['training', 'Training (Academy)'], ['verlenging', 'Contractverlenging']] },
    { label: 'Dossier', items: [['gesprekken', 'Gesprekken'], ['beschikbaarheid', 'Beschikbaarheid'], ['waarschuwing', 'Waarschuwingen'], ['sommatie', 'Sommaties'], ['brief', 'Vrije brieven']] },
    { label: 'Uitstroom', items: [['ontslag', 'Ontslag & aanzegging'], ['verloopanalyse', 'Verloopanalyse'], ['exit', 'Exit-surveys']] },
    { label: 'Beheer', items: [['toegang', 'Toegangslog (AVG)'], ['archief', 'Archief herstellen'], ['gegevens', 'Gegevens & export']] }
  ];
  // Welke modules in deze stap al "echt" zijn (de rest opent een placeholder)
  var ECHT = { overview: 1, dossier: 1, loonheffing: 1, brief: 1, ontslag: 1, sommatie: 1, overplaatsing: 1, signalering: 1, waarschuwing: 1, beschikbaarheid: 1, loonheffingskorting: 1, contract: 1, vastloners: 1, vakantie: 1, verloopanalyse: 1, toegang: 1, archief: 1, gegevens: 1, oproepaanbod: 1, exit: 1, checkin: 1, scorekaart: 1, gesprekken: 1, training: 1, verlenging: 1 };

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
    if (tab === 'waarschuwing' && !wrData) laadWaarschuwingen();
    if (tab === 'beschikbaarheid' && !bkData) laadBeschikbaarheid();
    if (tab === 'loonheffingskorting' && !krtData) laadKorting();
    if (tab === 'contract' && !ctrData) laadContract(false);
    if (tab === 'vakantie' && !vakData) laadVakantie(vakJaar);
    if (tab === 'verloopanalyse' && !vrlData) laadVerloop(12, false);
    if (tab === 'exit' && !exData) laadExit(12);
    if (tab === 'checkin' && !ciData) laadCheckin(6);
    if (tab === 'scorekaart' && !skData) laadScorekaart(6);
    if (tab === 'scorekaart') mrVulMaanden();
    if (tab === 'verlenging' && !vlData) laadVerlenging();
    if (tab === 'gesprekken' && !gsData) laadGesprekken(90);
    if (tab === 'training' && !trData) laadTraining(false);
    if (tab === 'toegang' && !tgData) laadToegang();
    if (tab === 'archief' && !arData) laadArchief();
    if (tab === 'gegevens' && !gvData) laadGegevens();
    if (tab === 'oproepaanbod' && !oprData) laadOproep(false);
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
    var ik = await api('/api/ik'); window._ikRol = ik && ik.rol;
    if (!ik.success) { await sb.auth.signOut(); g('login').classList.add('show'); toonLoginFout(ik.bericht || 'Geen toegang.'); return; }
    g('login').classList.remove('show');
    g('top-wie').innerHTML = '<strong>' + esc(ik.naam) + '</strong>'; ikNaam = ik.naam || ik.email || '';
    g('btn-uit').style.display = '';
    // Beheer → Gegevens & export is alleen voor beheerders (de API weigert anderen toch); knop verbergen
    if (ik.rol !== 'admin') document.querySelectorAll('.nav button[data-tab="gegevens"]').forEach(function (b) { b.style.display = 'none'; });
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
      var r;
      try { r = await fetch(pad, opts); }
      catch (e1) { await new Promise(function (ok) { setTimeout(ok, 1500); }); r = await fetch(pad, opts); } // netwerkhik / cold start na deploy: één keer opnieuw
      if (r.status === 502 || r.status === 504) return { success: false, bericht: 'De server deed er te lang over (' + r.status + '). Probeer het nog een keer.' };
      return await r.json();
    } catch (e) { return { success: false, bericht: e.message === 'Failed to fetch' ? 'Geen verbinding met de server — controleer je internet en probeer opnieuw.' : e.message }; }
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
  // Documenten → salarisadministratie (stuurDocsNaarSalaris): knop met tijdstempel; klik = (opnieuw) mailen
  function bSal(type, r) {
    var ok = !!r.salaris, dag = ok ? String(r.salaris).split(' ')[0] : '';
    return '<button class="mah-btn' + (ok ? ' ok' : '') + '" data-sal="' + type + '" data-rij="' + r.rij + '" data-naam="' + esc(r.naam) + '" data-sal-op="' + esc(r.salaris || '') + '" title="' + (ok ? 'Verstuurd op ' + esc(r.salaris) + ' - klik om opnieuw te sturen' : 'Stuur de geüploade documenten naar de salarisadministratie') + '">' + (ok ? '✓ ' + esc(dag) : '→ Salaris') + '</button>';
  }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-sal]'); if (!b || b.disabled) return;
    var type = b.getAttribute('data-sal'), rij = parseInt(b.getAttribute('data-rij'), 10), naam = b.getAttribute('data-naam'), op = b.getAttribute('data-sal-op');
    if (op && !confirm('Documenten van ' + naam + ' zijn al op ' + op + ' naar de salarisadministratie gestuurd. Opnieuw versturen?')) return;
    if (!op && !confirm('Documenten van ' + naam + ' naar de salarisadministratie (' + ((cfg && cfg.salarisEmail) || 'HRM Online') + ') mailen?')) return;
    b.disabled = true; b.textContent = '…';
    var r = await api('/api/salaris-mail', { type: type, rij: rij });
    if (!r.success && r.geenDocument && confirm(r.bericht)) r = await api('/api/salaris-mail', { type: type, rij: rij, zonderDocument: 1 });
    else if (!r.success && r.geenDocument) { b.disabled = false; b.textContent = op ? '✓ ' + op.split(' ')[0] : '→ Salaris'; return; }
    b.disabled = false;
    if (!r.success) { b.textContent = op ? '✓ ' + op.split(' ')[0] : '→ Salaris'; if (r.upload) { openDocUpload(r.upload); return; } toast('Salaris: ' + r.bericht, 'err'); return; }
    salarisKlaar(type, rij, r);
  });
  // Document ophalen zonder (werkende) mail: persoonlijke uploadlink kopiëren of HR uploadt het zelf
  function bUp(type, r, heeftDoc) {
    return '<button class="btn bd bsm" data-up-link="' + type + '" data-rij="' + r.rij + '" title="Kopieer de persoonlijke uploadlink om zelf te sturen (Gmail, WhatsApp)">🔗 Uploadlink</button> '
      + '<button class="btn bd bsm" data-up-zelf="' + type + '" data-rij="' + r.rij + '" title="' + (heeftDoc ? 'Document vervangen' : 'Document dat je per mail/WhatsApp kreeg zelf uploaden') + '">⬆ Zelf uploaden</button> ';
  }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && (e.target.closest('button[data-up-link]') || e.target.closest('button[data-up-zelf]')); if (!b || b.disabled) return;
    var isLink = b.hasAttribute('data-up-link'), type = b.getAttribute(isLink ? 'data-up-link' : 'data-up-zelf'), rij = parseInt(b.getAttribute('data-rij'), 10);
    b.disabled = true; var r = await api('/api/document-upload', { stap: 'info', type: type, rij: rij }); b.disabled = false;
    if (!r.success) { toast(r.bericht, 'err'); return; }
    if (isLink) {
      var tekst = 'Hoi ' + r.naam.split(' ')[0] + ',\n\nVia deze persoonlijke link kun je het ondertekende document uploaden (PDF of foto):\n' + r.link + '\n\nYou can upload the signed document (PDF or photo) via this personal link.\n\nGroet / Kind regards,\nSLA HR';
      try { await navigator.clipboard.writeText(tekst); toast('Uploadlink + korte tekst gekopieerd voor ' + r.naam + ' — plak in Gmail of WhatsApp' + (r.email ? ' (' + r.email + ')' : ''), 'ok'); }
      catch (x) { prompt('Kopieer de uploadlink:', r.link); }
      return;
    }
    openDocUpload({ type: type, rij: rij, naam: r.naam, alleenUpload: true, bestanden: r.bestanden.map(function (x) { return { key: x.key, label: x.label, drive: '' }; }) });
  });
  function salarisKlaar(type, rij, r) {
    toast(r.bericht, 'ok');
    document.querySelectorAll('button[data-sal="' + type + '"][data-rij="' + rij + '"]').forEach(function (x) { x.classList.add('ok'); x.textContent = '✓ ' + r.salaris.split(' ')[0]; x.setAttribute('data-sal-op', r.salaris); });
    if (type === 'korting') { krtData = null; laadKorting(); }
  }
  // ---------- Document zelf uploaden (oude Drive-documenten, zodat → Salaris werkt) ----------
  var duInfo = null, duGekozen = {};
  window.openDocUpload = function (info) {
    duInfo = info; duGekozen = {};
    g('du-titel').textContent = 'Document uploaden — ' + info.naam;
    g('du-lijst').innerHTML = info.bestanden.map(function (b) {
      return '<div class="fg"><label>' + esc(b.label) + '</label><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + (b.drive ? '<a class="btn bd bsm" href="' + esc(b.drive) + '" target="_blank" rel="noopener">1. Open in Drive ↗</a>' : '') + '<input type="file" data-du-key="' + esc(b.key) + '" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,image/*" style="flex:1;min-width:220px"></div></div>';
    }).join('');
    g('du-melding').innerHTML = ''; g('du-btn').disabled = false; g('du-btn').textContent = info.alleenUpload ? 'Uploaden' : 'Uploaden en naar salaris';
    g('du-uitleg').innerHTML = info.alleenUpload ? 'Upload hier het ondertekende document dat je van de medewerker kreeg (mail, WhatsApp of op papier gescand). Het dossier gaat op <strong>Ondertekend</strong> en daarna kun je het met <strong>→ Salaris</strong> doorsturen.' : 'Dit document is ooit via het oude Google-formulier ingestuurd en staat in Google Drive. Het dashboard kan Drive niet uitlezen. <strong>1.</strong> Open het document in Drive en download het (PDF of foto). <strong>2.</strong> Kies het bestand hieronder. Daarna gaat het mee naar de salarisadministratie en staat het voortaan in de eigen opslag.';
    g('du-zonder').style.display = info.alleenUpload ? 'none' : '';
    g('du-lijst').querySelectorAll('input[type=file]').forEach(function (inp) { inp.onchange = function () { if (inp.files[0]) duGekozen[inp.getAttribute('data-du-key')] = inp.files[0]; else delete duGekozen[inp.getAttribute('data-du-key')]; }; });
    g('du-modal').classList.add('open');
  };
  window.closeDocUpload = function () { g('du-modal').classList.remove('open'); };
  function duMelding(cls, t) { g('du-melding').innerHTML = '<div class="alert ' + cls + '" style="margin:6px 0 0;font-size:.84rem">' + esc(t) + '</div>'; }
  window.duVerstuur = async function () {
    var keys = Object.keys(duGekozen); if (!keys.length) { duMelding('geel', 'Kies eerst het bestand dat je uit Drive hebt gedownload.'); return; }
    var btn = g('du-btn'); btn.disabled = true; btn.textContent = 'Uploaden…';
    try {
      var klaar = [];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], f = duGekozen[k], mime = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : /\.hei[cf]$/i.test(f.name) ? 'image/heic' : 'image/jpeg');
        var st = await api('/api/document-upload', { stap: 'start', type: duInfo.type, rij: duInfo.rij, key: k, naam: f.name, mime: mime, bytes: f.size });
        if (!st.success) throw new Error(st.bericht);
        var up = await sb.storage.from(st.bucket).uploadToSignedUrl(st.pad, st.token, f, { contentType: mime, upsert: false });
        if (up.error) throw new Error(up.error.message);
        klaar.push({ key: k, pad: st.pad, naam_orig: f.name, bytes: f.size, mime: mime });
      }
      var rg = await api('/api/document-upload', { stap: 'klaar', type: duInfo.type, rij: duInfo.rij, bestanden: klaar });
      if (!rg.success) throw new Error(rg.bericht);
      if (duInfo.alleenUpload) { closeDocUpload(); toast(rg.bericht + (duInfo.type === 'ontslag' || duInfo.type === 'overplaatsing' ? ' Dossier staat op Ondertekend.' : ' Dossier staat op Ontvangen.'), 'ok'); if (duInfo.type === 'overplaatsing') { opData = null; laadOverplaatsingen(); } else if (duInfo.type === 'ontslag' && window.laadOntslag) laadOntslag(); else if (window.laadLoonheffing) laadLoonheffing(); return; }
      btn.textContent = 'Naar salaris…';
      var r = await api('/api/salaris-mail', { type: duInfo.type, rij: duInfo.rij });
      if (!r.success) { if (r.upload) { duMelding('geel', 'Opgeslagen. ' + r.bericht); openDocUpload(r.upload); return; } throw new Error('Opgeslagen, maar versturen naar salaris mislukte: ' + r.bericht); }
      closeDocUpload(); salarisKlaar(duInfo.type, duInfo.rij, r);
    } catch (e) { duMelding('rood', e.message); btn.disabled = false; btn.textContent = duInfo.alleenUpload ? 'Uploaden' : 'Uploaden en naar salaris'; }
  };
  window.duZonder = async function () {
    if (!confirm('Versturen naar de salarisadministratie zónder ' + duInfo.bestanden.map(function (b) { return b.label; }).join(' en ') + '?')) return;
    var r = await api('/api/salaris-mail', { type: duInfo.type, rij: duInfo.rij, zonderDrive: 1 });
    if (!r.success) { duMelding('rood', r.bericht); return; }
    closeDocUpload(); salarisKlaar(duInfo.type, duInfo.rij, r);
  };
  function bArch(type, rij, naam) {
    return '<button class="mah-btn arch" title="Archiveer ' + esc(naam) + ' — rij gaat naar tab Archief" data-arch="' + type + '" data-rij="' + rij + '" data-naam="' + esc(naam) + '">🗑</button>';
  }
  var bezig = false, laatsteDossier = null, ikNaam = '';
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
  // Documentlink: Supabase-upload ('sb:…', tijdelijke link via /api/document) of oude Google-Forms/Drive-link
  function bDoc(url, lbl) {
    if (!url) return '<span class="no-doc">-</span>';
    if (/^sb:/.test(url)) return '<a href="#" class="doc-link" data-doc-ref="' + esc(url) + '" title="Opgeslagen in de HR-omgeving (Supabase)">' + (lbl || 'Open') + '</a>';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="doc-link" title="Oud Google-formulier (Drive)">' + (lbl || 'Open') + '</a>';
  }
  document.addEventListener('click', async function (e) {
    var a = e.target.closest && e.target.closest('a[data-doc-ref]'); if (!a) return;
    e.preventDefault();
    var w = window.open('', '_blank');
    var r = await api('/api/document?ref=' + encodeURIComponent(a.getAttribute('data-doc-ref')));
    if (!r.success) { if (w) w.close(); toast('Document: ' + r.bericht, 'err'); return; }
    if (w) w.location = r.url; else window.open(r.url, '_blank');
  });
  function dosBtn(naam, email) { return '<button class="btn bd bsm" data-dos-naam="' + esc(naam) + '" data-dos-email="' + esc(email || '') + '">Dossier</button>'; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-dos-naam]');
    if (b) openDossier(b.getAttribute('data-dos-naam'), b.getAttribute('data-dos-email'));
  });

  window.laadOverzicht = async function () {
    laadTaken(false);
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
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bg">Loonheffing</span></td><td>' + esc(r.email) + '</td><td>' + bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst') + '</td><td>' + esc(r.deadline || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ontvangen) + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + ' ' + bSal('loonheffing', r) + '</td><td>' + lmBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bUp('loonheffing', r, r.ontvangen === 'Ja') + bArch('loonheffing', r.rij, r.naam) + '</td></tr>');
    });
    d.open.overplaatsing.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bo">' + esc(r.type || 'Overplaatsing') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.huidigeBV) + '</span> → <span class="badge boat">' + esc(r.nieuweBV) + '</span></td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ondertekend', 'Aanvinken') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>-</td><td>' + opBtn(r) + ' ' + dosBtn(r.naam, r.email) + '</td></tr>');
    });
    var somK = { '1e Sommatie': '#009f4b', '2e Sommatie': '#e8824a', 'Finale Sommatie': '#c0392b', 'Ontslag op Staande Voet': '#333d3a', 'Oproepbrief': '#2980b9' };
    d.open.sommatie.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge" style="background:' + (somK[r.type] || '#333d3a') + ';color:#fff">' + esc(r.type) + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.datumAfspraak || '-') + '</td><td>' + bSent(r.verzenddatum ? 'Verstuurd ' + r.verzenddatum : '') + '</td><td><span class="badge boat">' + esc(r.status || '-') + '</span></td><td>-</td><td>' + bTog('som-verwerkt', r.verwerkt, r.rij, r.naam) + '</td><td>' + smBriefBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('sommatie', r.rij, r.naam) + '</td></tr>');
    });
    d.open.ontslag.forEach(function (r) {
      rows.push('<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bdk">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bedrijf || '-') + '</span> ' + bDoc(r.briefUrl, '⬇ Brief') + '</td><td>' + esc(r.einddatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ondertekend, 'Ondertekend', 'Wacht') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam) + ' ' + bSal('ontslag', r) + '</td><td>' + omBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bArch('ontslag', r.rij, r.naam) + '</td></tr>');
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
    if (d.success) { medewerkers = d.medewerkers || []; medewerkersFout = ''; if (forceer) toast(medewerkers.length + ' medewerkers opgehaald uit Shiftbase', 'ok'); vulWinkelFilter(); }
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
  window.ketenCorrigeer = async function (mid, huidigStart, aantal, gecorrigeerd) {
    var naam = window._dosNaam || (laatsteDossier ? laatsteDossier[0] : '');
    var v = prompt('Hoeveel tijdelijke arbeidsovereenkomsten telt de huidige keten echt, inclusief het huidige contract?\n(Loon- of urenwijzigingen binnen een contract tellen niet mee.)' + (gecorrigeerd ? '\nLaat leeg om de correctie weg te halen.' : ''), String(aantal));
    if (v === null) return;
    var notitie = String(v).trim() ? (prompt('Korte toelichting (bijv. "2 getekende contracten in personeelsdossier")', '') || '') : '';
    var r = await api('/api/keten-correctie', { mid: mid, naam: naam, aantal: String(v).trim(), huidigStart: huidigStart, notitie: notitie });
    toast(r.success ? r.bericht : 'Correctie: ' + r.bericht, r.success ? 'ok' : 'err');
    if (r.success && laatsteDossier) openDossier(laatsteDossier[0], laatsteDossier[1], laatsteDossier[2]);
  };
  window.openDossier = async function (naam, email, id) {
    laatsteDossier = [naam, email, id];
    swT('dossier', 'Medewerkers');
    g('dos-hint').style.display = 'none'; g('dos-lijst-wrap').style.display = 'none';
    g('dos-inhoud').innerHTML = '<div class="sec"><div class="leeg grijs"><span class="sp" style="border-color:rgba(0,0,0,.15);border-top-color:#009f4b"></span> Dossier laden...</div></div>';
    var qs = id ? 'id=' + encodeURIComponent(id) : 'naam=' + encodeURIComponent(naam || '') + '&email=' + encodeURIComponent(email || '');
    var d = await api('/api/dossier?' + qs);
    if (!d.success) { g('dos-inhoud').innerHTML = '<div class="alert rood">' + esc(d.bericht) + '</div>'; return; }
    var p = d.persoon, c = d.contract, h = '';
    laatsteDossierQs = qs;
    h += '<div style="padding:0 0 10px;display:flex;gap:8px;align-items:center"><button class="btn bd bsm" onclick="renderMedewerkersLijst()">← Alle medewerkers</button><span style="flex:1"></span><button class="btn bd bsm" id="dos-pdf" onclick="dossierPdf()" title="Volledig dossier als PDF (inzageverzoek / jurist) — wordt gelogd">⬇ Dossier als PDF</button></div>';
    h += '<div class="dos-kop"><div class="dos-kaart"><div class="dos-naam">' + esc(d.naam) + '</div><div class="lay-sub">' + esc(d.email || '(geen e-mail)') + (p ? ' · ' + esc(p.winkelNaam || '-') + (p.winkelBv ? ' · ' + esc(p.winkelBv) : '') : ' · <em>niet gevonden in Shiftbase (alleen sheet-data)</em>') + '</div>';
    if (p) h += '<div class="dos-meta"><div><label>Functie</label><span>' + esc(p.functie || '-') + '</span></div><div><label>In dienst sinds</label><span>' + esc(p.indienst || '-') + '</span></div><div><label>Contract</label><span>' + esc(c.type || '-') + '</span></div><div><label>Contract eindigt</label><span>' + esc(c.einde || 'onbepaalde tijd / onbekend') + '</span></div><div><label>Adres</label><span>' + esc(p.adres || '-') + '</span></div></div>';
    h += '</div><div class="dos-kaart">';
    if (c && c.aanzegAlert) h += '<div class="alert ' + (c.aanzeggingVerstuurd ? 'groen' : 'rood') + '" style="margin:0 0 12px"><strong>Aanzegtermijn:</strong> contract eindigt over ' + c.dagenTotEinde + ' dagen.' + (c.aanzeggingVerstuurd ? ' Aanzegging is verstuurd ✓' : ' <strong>Nog geen aanzegging verstuurd.</strong>') + '</div>';
    else if (c && c.einde) h += '<div class="alert grijs" style="margin:0 0 12px">Contract eindigt over ' + c.dagenTotEinde + ' dagen — buiten de 42-dagen-alert.</div>';
    h += '<label style="display:block;font-size:.68rem;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Verlof (Shiftbase, 12 mnd terug / 6 vooruit)</label>';
    h += d.verlof && d.verlof.length ? '<div class="kv">' + d.verlof.slice(0, 8).map(function (v) { return '<div>' + esc(v.start) + (v.eind && v.eind !== v.start ? ' – ' + esc(v.eind) : '') + ' · <b>' + esc(v.type || '-') + '</b> · ' + esc(v.status) + (v.uren ? ' · ' + esc(v.uren) + ' u' : '') + '</div>'; }).join('') + (d.verlof.length > 8 ? '<div class="lay-sub">+' + (d.verlof.length - 8) + ' meer</div>' : '') + '</div>' : '<div class="lay-sub">Geen afwezigheden gevonden</div>';
    // Fase 2: verzuim (Poortwachter) + contractketen
    if (d.verzuim && !d.verzuim.fout) {
      var vz = d.verzuim, lop = vz.periodes.find(function (x) { return x.lopend; });
      h += '<label style="display:block;font-size:.68rem;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.4px;margin:14px 0 6px">Verzuim (Shiftbase, 24 mnd)</label>';
      h += '<div class="kv">' + (lop ? '<div class="alert ' + (lop.dagVandaag >= 42 ? 'rood' : 'geel') + '" style="margin:0 0 8px;padding:8px 12px">Ziek sinds <b>' + esc(lop.start) + '</b> (dag ' + lop.dagVandaag + ')' + (lop.volgendeMijlpaal ? ' · volgende Poortwachter-stap: <b>' + esc(lop.volgendeMijlpaal.label) + '</b> op dag ' + lop.volgendeMijlpaal.dag : '') + '</div>' : '') + '<div>' + vz.meldingen12mnd + ' ziekmelding(en) · ' + vz.dagen12mnd + ' ziektedag(en) in 12 maanden' + (vz.frequent ? ' · <b style="color:#c0392b">frequent verzuim</b>' : '') + '</div>' + vz.periodes.slice(0, 6).filter(function (x) { return !x.lopend; }).map(function (x) { return '<div>' + esc(x.start) + ' – ' + esc(x.eind) + ' · ' + x.dagen + ' ziektedag(en)' + (x.delen && x.delen.length > 1 ? ' <span class="lay-sub">(' + x.delen.length + ' meldingen binnen 4 weken, samengeteld als één ziektegeval; tussendoor gewerkt)</span>' + x.delen.map(function (d) { return '<div class="lay-sub" style="padding-left:14px">↳ ' + esc(d.start) + (d.eind !== d.start ? ' – ' + esc(d.eind) : '') + ' · ' + d.dagen + ' d</div>'; }).join('') : '') + '</div>'; }).join('') + (vz.periodes.length === 0 ? '<div class="lay-sub">Geen ziekmeldingen</div>' : '') + '</div>';
    }
    if (d.keten) {
      h += '<label style="display:block;font-size:.68rem;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.4px;margin:14px 0 6px">Contractketen (art. 7:668a BW)</label>';
      var kt = d.keten; window._dosNaam = d.naam || (d.persoon && d.persoon.naam) || '';
      h += '<div class="kv">' + (kt.onbepaald ? '<div><b>Onbepaalde tijd</b></div>' : '<div>' + kt.aantal + ' tijdelijk(e) contract(en) · ' + kt.maanden + ' maanden' + (kt.vol ? ' · <b style="color:#c0392b">keten vol: volgende = vast</b>' : kt.aantal >= 2 ? ' · <b>volgende is het laatste tijdelijke</b>' : '') + (kt.gecorrigeerd ? ' · <span class="badge bo" title="' + esc((kt.correctie.notitie || '') + ' — ' + (kt.correctie.door || '')) + '">aantal door HR vastgelegd (telling Shiftbase: ' + kt.telling + ')</span>' : '') + '</div>')
        + (kt.overeenkomsten || []).slice(-5).map(function (o) { return '<div class="lay-sub"' + (o.knips ? ' title="Shiftbase-records: ' + esc(o.delen.join(' | ')) + '"' : '') + '>' + (o.huidig ? '<b>' : '') + esc(o.start) + (o.eind ? ' – ' + esc(o.eind) : ' – heden') + ' · ' + esc(o.type || '-') + (o.huidig ? ' (huidig)</b>' : '') + (o.knips ? ' · <span style="color:#888078">' + o.knips + ' loon-/urenwijziging(en) in Shiftbase, telt als één contract</span>' : '') + '</div>'; }).join('')
        + (kt.besluiten && kt.besluiten.length ? kt.besluiten.map(function (b) { return '<div style="margin-top:4px"><span class="badge boat">Besluit (einde ' + esc(b.eind) + ')</span> <b>' + esc(b.label) + '</b>' + (b.nieuweEind ? ' t/m ' + esc(b.nieuweEind) : '') + (b.advies && b.advies !== 'Niet gevraagd' ? ' · SM: ' + esc(b.advies) + (b.adviesOpmerking ? ' (' + esc(b.adviesOpmerking) + ')' : '') : '') + '<span class="lay-sub"> · ' + esc(b.door) + ' ' + esc(b.op) + (b.notitie ? ' · ' + esc(b.notitie) : '') + '</span></div>'; }).join('') : '')
        + (!kt.onbepaald && kt.mid ? '<div style="margin-top:6px"><button class="btn bd bsm" onclick="ketenCorrigeer(\'' + esc(kt.mid) + '\', \'' + esc(kt.huidigStart) + '\', ' + kt.aantal + ', ' + (kt.gecorrigeerd ? 1 : 0) + ')">Aantal contracten corrigeren</button></div>' : '') + '</div>';
    }
    // Fase 3a: check-ins dag 30/60
    if (d.checkins && d.checkins.length) {
      h += '<label style="display:block;font-size:.68rem;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.4px;margin:14px 0 6px">Check-in 30/60 dagen</label><div class="kv">';
      h += d.checkins.map(function (c) {
        var st = !c.ingevuld ? '<span class="badge boat">wacht · verstuurd ' + esc(c.verstuurd) + '</span>' : c.laag ? (c.opgevolgd ? '<span class="badge bo">laag · opgevolgd ' + esc(c.opgevolgd) + '</span>' : '<span class="badge br">laag · nog opvolgen</span>') : '<span class="badge bg">ingevuld</span>';
        return '<div style="margin-bottom:6px"><b>Dag ' + c.moment + '</b> ' + st + (c.score != null ? ' · gem. ' + String(c.score).replace('.', ',') + '/5' : '') + (c.reden ? '<div class="lay-sub">' + esc(c.reden) + '</div>' : '') + (c.opmerking ? '<div class="lay-sub"><i>"' + esc(c.opmerking) + '"</i></div>' : '') + (c.notitie ? '<div class="lay-sub">Opvolging: ' + esc(c.notitie) + ' (' + esc(c.opgevolgdDoor || '') + ')</div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    h += '</div></div>';
    // Checklists (fase 1) vóór de dossierregels: dat is wat er nú moet gebeuren
    h += '<div class="sec"><div class="sh"><div class="st">Checklists</div></div><div id="dos-checklists"><div class="leeg grijs" style="padding:14px 24px">Laden…</div></div></div>';
    // Gesprekken (fase 3b)
    dosPersoon = { naam: d.naam, email: d.email, mid: p ? p.id : (id || ''), winkel: p ? p.winkelNaam : '' }; dosGesprekken = d.gesprekken || [];
    h += '<div class="sec"><div class="sh"><div class="st">Gesprekken <span class="pill">' + dosGesprekken.length + '</span></div><div class="hr2"><button class="btn bp bsm" data-gs-nieuw="1">+ Gesprek vastleggen</button></div></div><div style="padding:6px 24px 14px">' + (dosGesprekken.length ? dosGesprekken.map(gsKaart).join('') : '<div class="leeg grijs" style="padding:8px 0">Nog geen gesprekken vastgelegd.</div>') + '</div></div>';
    // Training & certificaten uit SLA Academy (fase 4a)
    h += acKaart(d.academy, d.academyFout);
    // Secties
    h += '<div class="sec"><div class="sh"><div class="st">Dossierregels <span class="pill">' + d.totaal + '</span></div></div>';
    d.secties.forEach(function (s) {
      h += '<div class="sec-sub">' + esc(s.label) + ' (' + s.rijen.length + ')' + (s.fout ? ' <span style="color:#c0392b;text-transform:none">— ' + esc(s.fout) + '</span>' : '') + '</div>';
      if (!s.rijen.length) { h += '<div style="padding:10px 24px;font-size:.8rem;color:#c4b8b0">Geen regels</div>'; return; }
      h += '<div class="tw"><table><tbody>' + s.rijen.map(function (r) { return '<tr>' + rijNaarCellen(s.key, r) + '</tr>'; }).join('') + '</tbody></table></div>';
    });
    h += '</div>';
    h += '<div class="sec"><div class="sh"><div class="st">Notitie toevoegen</div></div><div style="padding:14px 24px"><textarea id="dos-notitie" rows="3" style="width:100%;padding:10px 14px;border:1.5px solid #e8e2de;border-radius:8px;font:inherit;font-size:.88rem;min-height:70px" placeholder="Interne notitie (gesprek, afspraak, observatie). Wordt opgeslagen met jouw naam en datum en komt in het dossier en de PDF-export."></textarea><div style="margin-top:8px;text-align:right"><button class="btn bp bsm" id="dos-notitie-btn" onclick="dossierNotitie()">Notitie opslaan</button></div></div></div>';
    g('dos-inhoud').innerHTML = h;
    laadChecklistsInDossier(d.naam, d.email, p ? p.id : id);
  };
  var laatsteDossierQs = '';
  window.dossierNotitie = async function () {
    var ta = g('dos-notitie'), tekst = ta.value.trim(); if (tekst.length < 3) { toast('Typ eerst een notitie', 'err'); return; }
    var b = g('dos-notitie-btn'); b.disabled = true;
    var r = await api('/api/notitie', { naam: laatsteDossier[0], email: laatsteDossier[1], tekst: tekst });
    b.disabled = false;
    if (!r.success) { toast('Notitie: ' + r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); openDossier.apply(null, laatsteDossier);
  };
  window.dossierPdf = async function () {
    var b = g('dos-pdf'); b.disabled = true; toast('Dossier-PDF maken…', 'ok');
    var r = await api('/api/dossier-pdf?' + laatsteDossierQs);
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.b64, r.bestandsnaam);
  };
  function kv(l, v) { return '<td><div class="lay-sub">' + esc(l) + '</div>' + v + '</td>'; }
  function rijNaarCellen(key, r) {
    switch (key) {
      case 'loonheffing': return kv('Deadline', esc(r.deadline || '-')) + kv('Mail', bSent(r.status)) + kv('Formulier', bOk(r.ontvangen)) + kv('Documenten', bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst')) + kv('Herinneringen', bH(r.herinnering, r.aantalHer)) + kv('Naar salaris', bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + ' ' + bSal('loonheffing', r)) + kv('', bArch('loonheffing', r.rij, r.naam));
      case 'onboarding': return kv('Locatie', esc(r.locatie || '-')) + kv('Taal', esc(r.taal)) + kv('Welkomstmail', bSent(r.status)) + kv('Datum', esc(r.verzenddatum || '-')) + kv('', bArch('onboarding', r.rij, r.naam));
      case 'overplaatsing': return kv('Type', '<span class="badge bo">' + esc(r.type || '-') + '</span>') + kv('Van → naar', esc(r.huidigeBV) + ' → ' + esc(r.nieuweBV)) + kv('Ingangsdatum', esc(r.ingangsdatum || '-')) + kv('Mail', bSent(r.status)) + kv('Ondertekend', bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ja', 'Aanvinken')) + kv('Brief', bDoc(r.briefUrl, '⬇ PDF') + ' ' + bDoc(r.docUrl, 'Getekend')) + kv('Naar salaris', bSal('overplaatsing', r)) + kv('', opBtn(r));
      case 'sommatie': return kv('Type', '<span class="badge bdk">' + esc(r.type) + '</span>') + kv('BV', esc(r.bv || '-')) + kv('Afwezig', esc(r.datumAfwezig || '-')) + kv('Afspraak', esc(r.datumAfspraak || '-')) + kv('Verstuurd', esc(r.verzenddatum || '-')) + kv('Status', esc(r.status || '-')) + kv('Verwerkt', bTog('som-verwerkt', r.verwerkt, r.rij, r.naam)) + (r.aanvullend ? kv('Aanvullend', esc(r.aanvullend)) : '') + kv('', smBriefBtn(r) + ' ' + bArch('sommatie', r.rij, r.naam));
      case 'brief': return kv('Categorie', '<span class="badge bdk">' + esc(r.categorie || '-') + '</span>') + kv('Onderwerp', esc(r.onderwerp || '-')) + kv('BV', esc(r.bv || '-')) + kv('PDF', r.pdf === 'Ja' ? '<span class="badge bg">Ja</span>' : '<span class="no-doc">-</span>') + kv('Verstuurd', esc(r.verzenddatum || '-')) + kv('', '<button class="btn bd bsm" data-vb-print="' + esc(r.rij) + '">Brief</button> <button class="btn bd bsm" data-vb-opnieuw="' + esc(r.rij) + '">Opnieuw</button>');
      case 'ontslag': return kv('Type', '<span class="badge bdk">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span>') + kv('BV', esc(r.bedrijf || '-')) + kv('Opzegging', esc(r.opzegging || '-')) + kv('Einddatum', esc(r.einddatum || '-')) + kv('Mail', bSent(r.status)) + kv('Ondertekend', bOk(r.ondertekend, 'Ja', 'Nee')) + kv('Docs', bDoc(r.docUrl, 'Getekend') + ' ' + bDoc(r.briefUrl, '⬇ Brief')) + kv('Naar salaris', bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam) + ' ' + bSal('ontslag', r)) + kv('', omBtn(r) + ' ' + bArch('ontslag', r.rij, r.naam));
      case 'korting': return kv('Keuze', krtKeuzeBadge(r.keuze)) + kv('Ingangsdatum', esc(r.ingangsdatum || '-')) + kv('Deadline', esc(r.deadline || '-')) + kv('Mail', bSent(r.status)) + kv('Retour', bOk(r.retour) + (r.docUrl ? ' ' + bDoc(r.docUrl, 'Formulier') : '')) + kv('Herinneringen', bH(r.herinnering, r.aantalHer)) + kv('Naar salaris', r.retour === 'Ja' ? bSal('korting', r) : '-') + kv('', '<button class="btn bd bsm" data-krt-rij="' + esc(r.rij) + '">Opnieuw</button>');
      case 'notitie': return kv('Datum', esc(r.datum || '-')) + kv('Auteur', esc(r.auteur || '-')) + '<td colspan="4" style="white-space:pre-wrap;font-size:.85rem">' + esc(r.tekst || '') + '</td>';
      case 'waarschuwing': return kv('Winkel', esc(r.winkel || '-')) + kv('Datum overtreding', esc(r.datumOvertreding || '-')) + kv('Regels', '<span title="' + esc(r.regels || '') + '">' + esc((r.regels || '-').length > 90 ? r.regels.substring(0, 90) + '…' : (r.regels || '-')) + '</span>') + kv('Taal', esc(r.taal || 'NL')) + kv('Status', esc(r.status || '-')) + kv('', '<button class="btn bd bsm" data-wr-rij="' + esc(r.rij) + '">Opnieuw</button>');
      case 'beschikbaarheid': return kv('Winkel', esc(r.winkel || '-')) + kv('Ingangsdatum', esc(r.ingangsdatum || '-')) + kv('Onderbouwing', '<span title="' + esc(r.onderbouwing || '') + '">' + esc((r.onderbouwing || '-').length > 90 ? r.onderbouwing.substring(0, 90) + '…' : (r.onderbouwing || '-')) + '</span>') + kv('Taal', esc(r.taal || 'NL')) + kv('Status', esc(r.status || '-')) + kv('', '<button class="btn bd bsm" data-bk-rij="' + esc(r.rij) + '">Opnieuw</button>');
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
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + esc(r.deadline || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ontvangen) + '</td><td>' + bDoc(r.docUrl, 'Loonheffing') + ' ' + bDoc(r.docUrl2, 'Indienst') + '</td><td><span class="badge boat">' + esc(r.taal || 'NL') + '</span></td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-loonheffing', r.mahdia, r.rij, r.naam) + ' ' + bSal('loonheffing', r) + '</td><td>' + lmBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bUp('loonheffing', r, r.ontvangen === 'Ja') + bArch('loonheffing', r.rij, r.naam) + '</td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">Geen dossiers</td></tr>';
    srtHerpas('lh-body');
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
  // ---------- Bevestiging uitdiensttreding zonder handtekening (v0.19.4) ----------
  async function udStatus() {
    var d = await api('/api/uitdienst'); if (!d.success) return;
    var el = g('ud-balk'); if (!el) return;
    el.style.display = '';
    el.className = 'alert ' + (d.actief ? 'groen' : 'geel');
    el.innerHTML = (d.actief ? '<strong>Automatisch afronden staat aan.</strong> Na de 3e herinnering krijgt de medewerker een bevestiging van de uitdiensttreding (NL/EN, PDF, niets te tekenen), gaat er een seintje naar salaris en wordt het dossier gearchiveerd.'
      : '<strong>Automatisch afronden staat uit.</strong> Na 3 herinneringen stopt het dashboard; na 30 dagen wordt het dossier stil gearchiveerd. Per rij kun je de uitdiensttreding wel zelf bevestigen.')
      + ' <button class="btn bd bsm" onclick="udVoorbeeld()">Voorbeeld mail + PDF</button>' + (window._ikRol === 'admin' ? ' <button class="btn ' + (d.actief ? 'bd' : 'bp') + ' bsm" onclick="udZet(' + (d.actief ? 'false' : 'true') + ')">' + (d.actief ? 'Uitzetten' : 'Aanzetten') + '</button>' : '');
  }
  window.udVoorbeeld = async function (rij) {
    var r = await api('/api/uitdienst', { actie: 'voorbeeld', rij: rij || 0 });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    var w = window.open('', '_blank'); if (w) { w.document.write('<title>' + esc(r.subject) + '</title><div style="font-family:Arial;padding:10px 20px;color:#555">Onderwerp: <b>' + esc(r.subject) + '</b></div>' + r.html); w.document.close(); }
    downloadB64(r.pdf, r.bestandsnaam);
  };
  window.udZet = async function (aan) {
    if (aan && !confirm('Automatisch afronden aanzetten? Medewerkers die 3 herinneringen hebben gehad krijgen dan bij de volgende run (dagelijks 09:15) de bevestiging, en salaris krijgt een seintje.')) return;
    var r = await api('/api/uitdienst', { actie: 'actief', aan: !!aan }); toast(r.success ? r.bericht : r.bericht, r.success ? 'ok' : 'err'); udStatus();
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-ud-rij]'); if (!b || b.disabled) return;
    var rij = parseInt(b.getAttribute('data-ud-rij'), 10), naam = b.getAttribute('data-naam');
    if (!confirm('Uitdiensttreding van ' + naam + ' bevestigen?\n\n- mail + PDF naar de medewerker (niets te ondertekenen)\n- seintje naar salaris (als dat nog niet is gebeurd)\n- dossier archiveren\n\nTip: bekijk eerst het voorbeeld (knop boven de tabel).')) return;
    b.disabled = true; b.textContent = '…';
    var r = await api('/api/uitdienst', { actie: 'bevestig', rij: rij });
    toast(r.success ? r.bericht : 'Bevestiging: ' + r.bericht, r.success ? 'ok' : 'err');
    if (r.success) laadOntslag(); else { b.disabled = false; b.textContent = '✓ Bevestig uitdiensttreding'; }
  });
  window.laadOntslag = async function () {
    udStatus();
    var d = await api('/api/ontslag');
    if (!d.success) { toast('Ontslag: ' + d.bericht, 'err'); return; }
    omData = d.rijen; omTpl = d.templates;
    g('om-count').textContent = omData.length + ' dossiers';
    g('om-body').innerHTML = omData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge ' + (r.type === 'aanzegging' ? 'bo' : 'bdk') + '">' + (r.type === 'aanzegging' ? 'Aanzegging' : 'Ontslag') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.bedrijf || '-') + '</span></td><td>' + esc(r.opzegging || '-') + '</td><td>' + esc(r.einddatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.ondertekend, 'Ondertekend', 'Wacht') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + bTog('mahdia-ontslag', r.mahdia, r.rij, r.naam) + ' ' + bSal('ontslag', r) + '</td><td>' + bDoc(r.docUrl, 'Getekend') + ' ' + bDoc(r.briefUrl, '⬇ Brief') + '</td><td>' + omBtn(r) + ' ' + dosBtn(r.naam, r.email) + ' ' + bUp('ontslag', r, r.ondertekend === 'Ja') + (r.ondertekend !== 'Ja' && r.verzenddatum ? '<button class="btn bd bsm" data-ud-rij="' + r.rij + '" data-naam="' + esc(r.naam) + '" title="Niet ondertekend? Bevestig de uitdiensttreding (niets te tekenen), licht salaris in en archiveer">✓ Bevestig uitdiensttreding</button> ' : '') + bArch('ontslag', r.rij, r.naam) + '</td></tr>';
    }).join('') || '<tr><td colspan="12" class="leeg grijs">Geen dossiers</td></tr>';
    srtHerpas('om-body');
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
    if (!omTpl.length) { var d = await api('/api/ontslag'); if (d.success) { omTpl = d.templates; omData = d.rijen; g('om-reden').innerHTML = '<option value="">— kies een reden —</option>' + (d.redenen || []).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join(''); } }
    if (!vbBvs.length) { var b = await api('/api/brieven'); if (b.success) vbBvs = b.bvs; }
    g('om-bv-list').innerHTML = vbBvs.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
    omRij = persoon && persoon.rij ? persoon.rij : null;
    g('om-to').value = persoon ? persoon.email || '' : '';
    g('om-naam').value = persoon ? persoon.naam || '' : '';
    g('om-bv').value = persoon ? persoon.bedrijf || '' : '';
    g('om-adres').value = persoon ? persoon.adres || '' : '';
    g('om-opz').value = persoon ? persoon.opzegging || '' : '';
    g('om-eind').value = persoon ? persoon.einddatum || '' : '';
    g('om-reden').value = persoon ? persoon.uitstroomreden || '' : '';
    // Slimme default: aanzegging-dossier -> aanzegging; al verstuurd -> herinnering
    omKey = persoon && persoon.type === 'aanzegging' ? (isVerz(persoon.status) ? 'ontslag-herinnering' : 'aanzegging-nl') : (persoon && isVerz(persoon.status) ? 'ontslag-herinnering' : 'ontslag-pdf');
    if (persoon && persoon.zelfOpgezegd) { omKey = 'ontslag-pdf'; if (!g('om-opz').value) { var nu = new Date(); g('om-opz').value = ('0' + nu.getDate()).slice(-2) + '-' + ('0' + (nu.getMonth() + 1)).slice(-2) + '-' + nu.getFullYear(); } toast('Bevestiging van de opzegging door de medewerker — controleer de opzegdatum en einddatum', 'ok'); }
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
    var t = omT(), isA = t.type === 'aanzegging', isP = t.type === 'proeftijd';
    g('om-titel').textContent = (isA || isP) ? t.label : (t.pdf ? 'Mail + PDF — Ontslag' : 'Mail — Herinnering ondertekening');
    g('om-pn').style.display = t.pdf ? '' : 'none';
    g('om-aanzeg').style.display = isA ? '' : 'none';
    g('om-fg-opz').style.display = isA ? 'none' : '';
    g('om-opz-lbl').textContent = t.opzLabel || 'Datum opzegging';
    g('om-pdfbtn').style.display = t.pdf ? '' : 'none';
    g('om-fg-reden').style.display = t.type === 'herinnering' ? 'none' : '';
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
    return { template: omKey, to: g('om-to').value.trim(), naam: g('om-naam').value.trim(), bv: g('om-bv').value.trim(), adres: g('om-adres').value.trim(), datumOpzegging: g('om-opz').value.trim(), einddatum: g('om-eind').value.trim(), uitstroomreden: g('om-reden').value, rij: omRij, subject: g('om-subj').value.trim(), body: g('om-tekst').value };
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
    if (t.type === 'proeftijd' && !p.einddatum) { toast('Vul de einddatum in', 'err'); return; }
    if (t.type !== 'herinnering' && !p.uitstroomreden) { toast('Kies een uitstroomreden (nodig voor de verloopanalyse)', 'err'); g('om-reden').focus(); return; }
    if (t.key === 'ontslag-pdf' && !confirm('Ontslagbevestiging + PDF versturen naar ' + p.to + '?')) return;
    if (t.type === 'proeftijd' && !confirm(t.label + ' versturen naar ' + p.to + '?')) return;
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
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td><span class="badge bo">' + esc(r.type || 'Overplaatsing') + '</span></td><td>' + esc(r.email) + '</td><td><span class="badge boat">' + esc(r.huidigeBV) + '</span> → <span class="badge boat">' + esc(r.nieuweBV) + '</span></td><td>' + esc(r.standplaats || '-') + '</td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bTog('opl-ondertekend', r.ondertekend, r.rij, r.naam, 'Ondertekend', 'Aanvinken') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td><div class="vb-knoppen">' + opBtn(r) + bDoc(r.briefUrl, '⬇ Brief') + bDoc(r.docUrl, 'Getekend') + bSal('overplaatsing', r) + bUp('overplaatsing', r, !!r.docUrl) + dosBtn(r.naam, r.email) + '</div></td></tr>';
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

  // ---------- Gedeeld voor batch A: winkel-select + taalknoppen ----------
  function vulWinkelSelect(id, winkels, code) {
    g(id).innerHTML = '<option value="">-- selecteer --</option>' + winkels.map(function (w) { return '<option value="' + esc(w.code) + '">' + esc(w.naam) + ' (' + esc(w.code) + ') - ' + esc(w.bv) + '</option>'; }).join('');
    if (code) g(id).value = code;
  }
  function koppelTaal(id, onWissel) {
    g(id).querySelectorAll('[data-taal]').forEach(function (b) { b.onclick = function () { g(id).querySelectorAll('.tb').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); if (onWissel) onWissel(b.getAttribute('data-taal')); }; });
  }
  function leesTaal(id) { var b = g(id).querySelector('.tb.sel'); return b ? b.getAttribute('data-taal') : 'NL'; }
  function zetTaal(id, taal) { g(id).querySelectorAll('.tb').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-taal') === (taal || 'NL')); }); }
  function nlDatum(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : (iso || ''); }

  // ---------- Waarschuwingen (port van waarschuwing.gs v1.2) ----------
  var wrData = null, wrRegels = [], wrWinkels = [], wrRij = null;
  window.laadWaarschuwingen = async function () {
    var d = await api('/api/waarschuwing');
    if (!d.success) { toast('Waarschuwingen: ' + d.bericht, 'err'); return; }
    wrData = d.rijen; wrRegels = d.huisregels; wrWinkels = d.winkels;
    g('wr-count').textContent = wrData.length + ' verstuurd';
    g('wr-body').innerHTML = wrData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + esc(r.winkel || '-') + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.datumOvertreding || '-') + '</td><td title="' + esc(r.regels) + '" style="max-width:320px;white-space:normal;font-size:.78rem">' + esc(r.regels || '-') + '</td><td><span class="badge boat">' + esc(r.taal || 'NL') + '</span></td><td>' + bSent(r.status) + '</td><td><div class="vb-knoppen"><button class="btn bd bsm" data-wr-rij="' + r.rij + '">Opnieuw</button>' + dosBtn(r.naam, r.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="9" class="leeg grijs">Nog geen waarschuwingen verstuurd</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-wr-rij]'); if (!b) return;
    if (!wrData) await laadWaarschuwingen();
    var rij = b.getAttribute('data-wr-rij');
    openWrModal((wrData || []).find(function (x) { return String(x.rij) === rij; }) || null);
  });
  function wrBouwLijst(geselecteerd) {
    var sel = {}; (geselecteerd || []).forEach(function (t) { sel[t] = true; });
    var h = '', cat = '';
    wrRegels.forEach(function (r) {
      if (r.cat !== cat) { cat = r.cat; h += '<div style="position:sticky;top:0;background:#f8f3f0;padding:7px 12px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#888078;border-bottom:1px solid #e8e2de">' + esc(cat) + '</div>'; }
      h += '<label class="chk" style="align-items:flex-start;padding:7px 12px;border-bottom:1px solid #f1ece8;font-size:.82rem;line-height:1.45;margin:0"><input type="checkbox" value="' + esc(r.id) + '"' + (sel[r.tekst] ? ' checked' : '') + ' style="margin-top:3px"><span><span style="color:#aaa;font-size:.7rem">' + esc(r.id) + '</span> ' + esc(r.tekst) + '</span></label>';
    });
    g('wr-lijst').innerHTML = h;
    g('wr-lijst').querySelectorAll('input').forEach(function (c) { c.onchange = wrTel; });
    wrTel();
  }
  function wrTel() { var n = wrGekozen().length; g('wr-teller').textContent = n ? '(' + n + ' aangevinkt)' : '(nog niets aangevinkt)'; }
  function wrGekozen() { return Array.prototype.map.call(g('wr-lijst').querySelectorAll('input:checked'), function (c) { return c.value; }); }
  window.openWrModal = async function (r) {
    if (!wrRegels.length) { var d = await api('/api/waarschuwing'); if (d.success) { wrRegels = d.huisregels; wrWinkels = d.winkels; wrData = d.rijen; } }
    wrRij = r && r.rij ? r.rij : null;
    ['wr-naam', 'wr-email', 'wr-adres', 'wr-datum', 'wr-toel', 'wr-zoek'].forEach(function (id) { g(id).value = ''; });
    var code = r && r.winkel ? (wrWinkels.find(function (w) { return w.naam === r.winkel; }) || {}).code : '';
    vulWinkelSelect('wr-winkel', wrWinkels, code);
    if (r) { g('wr-naam').value = r.naam || ''; g('wr-email').value = r.email || ''; g('wr-adres').value = r.adres || ''; g('wr-datum').value = r.datumOvertreding || ''; g('wr-toel').value = r.toelichting || ''; }
    zetTaal('wr-taal', r ? r.taal : 'NL');
    wrBouwLijst(r && r.regels ? r.regels.split(' | ') : []);
    g('wr-zoek-res').classList.remove('open');
    g('wr-modal').classList.add('open');
    if (!r) setTimeout(function () { g('wr-zoek').focus(); }, 60);
  };
  window.closeWrModal = function () { g('wr-modal').classList.remove('open'); };
  g('wr-modal').addEventListener('click', function (e) { if (e.target === this) closeWrModal(); });
  koppelTaal('wr-taal');
  function wrLees() { return { to: g('wr-email').value.trim(), naam: g('wr-naam').value.trim(), adres: g('wr-adres').value.trim(), winkel: g('wr-winkel').value, datumOvertreding: g('wr-datum').value.trim(), regelIds: wrGekozen(), toelichting: g('wr-toel').value.trim(), taal: leesTaal('wr-taal'), rij: wrRij }; }
  function wrCheck(p) {
    if (!p.naam) return 'Vul de naam in';
    if (!p.winkel) return 'Selecteer een winkel';
    if (!p.regelIds.length) return 'Vink minimaal 1 overtreden regel aan';
    return '';
  }
  window.wrPdf = async function () {
    var p = wrLees(), f = wrCheck(p); if (f) { toast(f, 'err'); return; }
    var b = g('wr-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/waarschuwing-mail', Object.assign(p, { alleenPdf: true }));
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Waarschuwing.pdf');
  };
  window.wrVerstuur = async function () {
    var p = wrLees(), f = wrCheck(p); if (f) { toast(f, 'err'); return; }
    if (!p.to || p.to.indexOf('@') === -1) { toast('Ongeldig e-mailadres', 'err'); return; }
    if (!confirm('Officiële waarschuwing (' + p.regelIds.length + ' regel(s)) + PDF versturen naar ' + p.to + '?')) return;
    var b = g('wr-sbtn'); b.disabled = true; g('wr-slbl').textContent = 'PDF maken en versturen…';
    var r = await api('/api/waarschuwing-mail', p);
    b.disabled = false; g('wr-slbl').textContent = 'Verstuur waarschuwing + PDF';
    if (r.success) { toast(r.bericht, 'ok'); closeWrModal(); laadWaarschuwingen(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('wr-zoek', 'wr-zoek-res', function (m) {
    if (!m) return;
    g('wr-naam').value = m.naam || ''; g('wr-email').value = m.email || '';
    if (m.adres) g('wr-adres').value = m.adres;
    if (m.winkelCode && wrWinkels.some(function (w) { return w.code === m.winkelCode; })) g('wr-winkel').value = m.winkelCode;
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
  });

  // ---------- Beschikbaarheid (port van Beschikbaarheid.gs v1 + getWeekendOnderbouwing v9.2) ----------
  var bkData = null, bkWinkels = [], bkRij = null;
  window.laadBeschikbaarheid = async function () {
    var d = await api('/api/beschikbaarheid');
    if (!d.success) { toast('Beschikbaarheid: ' + d.bericht, 'err'); return; }
    bkData = d.rijen; bkWinkels = d.winkels;
    g('bk-count').textContent = bkData.length + ' verstuurd';
    g('bk-body').innerHTML = bkData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + esc(r.winkel || '-') + '</td><td><span class="badge boat">' + esc(r.bv || '-') + '</span></td><td>' + esc(r.ingangsdatum || '-') + '</td><td title="' + esc(r.onderbouwing) + '" style="max-width:320px;white-space:normal;font-size:.78rem">' + esc(r.onderbouwing || '-') + '</td><td><span class="badge boat">' + esc(r.taal || 'NL') + '</span></td><td>' + bSent(r.status) + '</td><td><div class="vb-knoppen"><button class="btn bd bsm" data-bk-rij="' + r.rij + '">Opnieuw</button>' + dosBtn(r.naam, r.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="9" class="leeg grijs">Nog geen kennisgevingen verstuurd</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-bk-rij]'); if (!b) return;
    if (!bkData) await laadBeschikbaarheid();
    var rij = b.getAttribute('data-bk-rij');
    openBkModal((bkData || []).find(function (x) { return String(x.rij) === rij; }) || null);
  });
  window.openBkModal = async function (r) {
    if (!bkWinkels.length) { var d = await api('/api/beschikbaarheid'); if (d.success) { bkWinkels = d.winkels; bkData = d.rijen; } }
    bkRij = r && r.rij ? r.rij : null;
    ['bk-naam', 'bk-email', 'bk-adres', 'bk-ingang', 'bk-ond', 'bk-zoek'].forEach(function (id) { g(id).value = ''; });
    g('bk-ond-status').textContent = '';
    var code = r && r.winkel ? (bkWinkels.find(function (w) { return w.naam === r.winkel; }) || {}).code : '';
    vulWinkelSelect('bk-winkel', bkWinkels, code);
    if (r) { g('bk-naam').value = r.naam || ''; g('bk-email').value = r.email || ''; g('bk-adres').value = r.adres || ''; g('bk-ingang').value = r.ingangsdatum || ''; g('bk-ond').value = r.onderbouwing || ''; }
    else { var d14 = new Date(); d14.setDate(d14.getDate() + 14); g('bk-ingang').value = nlDatum(d14.toISOString().substring(0, 10)); }
    zetTaal('bk-taal', r ? r.taal : 'NL');
    g('bk-zoek-res').classList.remove('open');
    g('bk-modal').classList.add('open');
    if (!r) setTimeout(function () { g('bk-zoek').focus(); }, 60);
  };
  window.closeBkModal = function () { g('bk-modal').classList.remove('open'); };
  g('bk-modal').addEventListener('click', function (e) { if (e.target === this) closeBkModal(); });
  koppelTaal('bk-taal');
  function bkLees() { return { to: g('bk-email').value.trim(), naam: g('bk-naam').value.trim(), adres: g('bk-adres').value.trim(), winkel: g('bk-winkel').value, ingangsdatum: g('bk-ingang').value.trim(), onderbouwing: g('bk-ond').value.trim(), taal: leesTaal('bk-taal'), rij: bkRij }; }
  function bkCheck(p) { if (!p.naam) return 'Vul de naam in'; if (!p.winkel) return 'Selecteer een winkel'; if (!p.ingangsdatum) return 'Vul de ingangsdatum in'; return ''; }
  window.bkPdf = async function () {
    var p = bkLees(), f = bkCheck(p); if (f) { toast(f, 'err'); return; }
    var b = g('bk-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/beschikbaarheid-mail', Object.assign(p, { alleenPdf: true }));
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Kennisgeving.pdf');
  };
  window.bkVerstuur = async function () {
    var p = bkLees(), f = bkCheck(p); if (f) { toast(f, 'err'); return; }
    if (!p.to || p.to.indexOf('@') === -1) { toast('Ongeldig e-mailadres', 'err'); return; }
    if (!p.onderbouwing && !confirm('Er staat geen data-onderbouwing in de brief. Toch versturen?')) return;
    var b = g('bk-sbtn'); b.disabled = true; g('bk-slbl').textContent = 'PDF maken en versturen…';
    var r = await api('/api/beschikbaarheid-mail', p);
    b.disabled = false; g('bk-slbl').textContent = 'Verstuur kennisgeving + PDF';
    if (r.success) { toast(r.bericht, 'ok'); closeBkModal(); laadBeschikbaarheid(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('bk-zoek', 'bk-zoek-res', async function (m) {
    if (!m) return;
    g('bk-naam').value = m.naam || ''; g('bk-email').value = m.email || '';
    if (m.adres) g('bk-adres').value = m.adres;
    if (m.winkelCode && bkWinkels.some(function (w) { return w.code === m.winkelCode; })) g('bk-winkel').value = m.winkelCode;
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
    g('bk-ond-status').textContent = '⏳ onderbouwing berekenen uit het rooster…'; g('bk-ond').value = '';
    var r = await api('/api/beschikbaarheid-onderbouwing?id=' + encodeURIComponent(m.id));
    if (r.success) { g('bk-ond').value = r.tekst; g('bk-ond-status').innerHTML = '✓ ' + r.metDienst + ' weekend(en) met dienst, ' + r.metVerlof + ' met verlof, ' + r.doordeweeks + ' doordeweekse diensten (' + esc(r.periode) + ')'; }
    else g('bk-ond-status').textContent = '⚠ ' + r.bericht;
  });


  // ---------- Oproepaanbod (fase 2d) ----------
  var oprData = null, oprWinkels = [];
  window.laadOproep = async function (live) {
    g('opr-kand').innerHTML = '<tr><td colspan="8" class="leeg grijs">' + (live ? 'Check draaien (roosters 12 maanden)…' : 'Laden…') + '</td></tr>';
    var d = await api('/api/oproepaanbod' + (live ? '?live=1' : ''));
    if (!d.success) { toast('Oproepaanbod: ' + d.bericht, 'err'); g('opr-kand').innerHTML = '<tr><td colspan="8" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    oprData = d; oprWinkels = d.winkels || [];
    g('opr-stand').textContent = d.stand ? 'stand: ' + d.stand : 'nog geen check gedraaid';
    g('opr-kand-count').textContent = d.kandidaten.length;
    g('opr-kand').innerHTML = d.kandidaten.map(function (k) { return '<tr><td><strong>' + esc(k.naam) + '</strong><div class="lay-sub">' + esc(k.contractType || '') + '</div></td><td>' + esc(k.winkel) + '</td><td>' + esc(k.sinds) + '</td><td>' + esc(k.grens) + (k.teLaat ? ' <span class="badge br">' + (-k.over) + ' d te laat</span>' : ' <span class="badge boat">over ' + k.over + ' d</span>') + '</td><td><strong>' + k.gemPerWeek + '</strong> <span class="lay-sub">(' + esc(k.periode) + ')</span></td><td>' + k.diensten + '</td><td>' + esc(k.laatsteAanbod || '-') + '</td><td><button class="btn bp bsm" data-opr-kand="' + esc(JSON.stringify(k)) + '">Aanbod + PDF</button> ' + dosBtn(k.naam, k.email) + '</td></tr>'; }).join('') || '<tr><td colspan="8" class="leeg grijs">Geen oproepkrachten bij de 12-maandsgrens' + (d.stand ? '' : ' — klik ↻ Verse stand') + '</td></tr>';
    g('opr-count').textContent = d.rijen.length;
    g('opr-body').innerHTML = d.rijen.map(function (r) { return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + esc(r.winkel) + '</td><td>' + esc(r.sinds || '-') + '</td><td>' + esc(r.gemUren || '-') + '</td><td><strong>' + esc(r.aangebodenUren) + '</strong> u</td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + esc(r.reactiedatum || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + (r.reactie ? '<span class="badge ' + (r.reactie === 'Aanvaard' ? 'bg' : r.reactie === 'Afgewezen' ? 'bo' : 'boat') + '">' + esc(r.reactie) + '</span>' + (r.docUrl ? ' ' + bDoc(r.docUrl, 'Brief') : '') + '<div class="lay-sub">' + esc(r.reactieDatum || '') + '</div>' : '<span class="badge br">Wacht</span>') + '</td><td>' + (r.reactie && r.reactie !== 'Ontvangen (document)' ? '' : '<button class="btn bp bsm" data-opr-reactie="Aanvaard" data-rij="' + r.rij + '" data-naam="' + esc(r.naam) + '">Aanvaard</button><button class="btn bd bsm" data-opr-reactie="Afgewezen" data-rij="' + r.rij + '" data-naam="' + esc(r.naam) + '">Afgewezen</button><button class="btn bd bsm" data-opr-reactie="Geen reactie" data-rij="' + r.rij + '" data-naam="' + esc(r.naam) + '">Geen reactie</button>') + ' ' + dosBtn(r.naam, r.email) + '</td></tr>'; }).join('') || '<tr><td colspan="11" class="leeg grijs">Nog geen aanbiedingen verstuurd</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var k = e.target.closest && e.target.closest('button[data-opr-kand]'); if (k) { openOprModal(JSON.parse(k.getAttribute('data-opr-kand'))); return; }
    var b = e.target.closest && e.target.closest('button[data-opr-reactie]'); if (!b) return;
    b.disabled = true;
    var r = await api('/api/oproepaanbod-mail', { actie: 'reactie', rij: parseInt(b.getAttribute('data-rij'), 10), reactie: b.getAttribute('data-opr-reactie'), naam: b.getAttribute('data-naam') });
    b.disabled = false; if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadOproep(false);
  });
  window.openOprModal = async function (k) {
    if (!oprWinkels.length) { var d = await api('/api/oproepaanbod'); if (d.success) { oprWinkels = d.winkels; oprData = d; } }
    ['opr-naam', 'opr-email', 'opr-adres', 'opr-sinds', 'opr-periode', 'opr-gem', 'opr-aang', 'opr-ingang', 'opr-reactie', 'opr-zoek'].forEach(function (id) { g(id).value = ''; });
    var code = k && k.winkel ? (oprWinkels.find(function (w) { return w.naam === k.winkel; }) || {}).code : '';
    vulWinkelSelect('opr-winkel', oprWinkels, code);
    var d1 = new Date(); d1.setDate(1); d1.setMonth(d1.getMonth() + 1); var d14 = new Date(); d14.setDate(d14.getDate() + 14);
    g('opr-ingang').value = nlDatum(d1.toISOString().substring(0, 10)); g('opr-reactie').value = nlDatum(d14.toISOString().substring(0, 10));
    if (k) {
      g('opr-naam').value = k.naam || ''; g('opr-email').value = k.email || ''; g('opr-sinds').value = k.sinds || ''; g('opr-periode').value = k.periode || '';
      g('opr-gem').value = k.gemPerWeek != null ? String(k.gemPerWeek).replace('.', ',') : ''; g('opr-aang').value = k.gemPerWeek != null ? String(Math.ceil(k.gemPerWeek)) : '';
      var m = medewerkers.find(function (x) { return x.naam === k.naam; }); if (m && m.adres) g('opr-adres').value = m.adres;
    }
    zetTaal('opr-taal', 'NL');
    g('opr-zoek-res').classList.remove('open'); g('opr-modal').classList.add('open');
    if (!k) setTimeout(function () { g('opr-zoek').focus(); }, 60);
  };
  window.closeOprModal = function () { g('opr-modal').classList.remove('open'); };
  g('opr-modal').addEventListener('click', function (e) { if (e.target === this) closeOprModal(); });
  koppelTaal('opr-taal');
  function oprLees() { return { to: g('opr-email').value.trim(), naam: g('opr-naam').value.trim(), adres: g('opr-adres').value.trim(), winkel: g('opr-winkel').value, sinds: g('opr-sinds').value.trim(), periode: g('opr-periode').value.trim(), gemUren: g('opr-gem').value.trim(), aangebodenUren: g('opr-aang').value.trim(), ingangsdatum: g('opr-ingang').value.trim(), reactiedatum: g('opr-reactie').value.trim(), taal: leesTaal('opr-taal') }; }
  function oprCheck(p) { if (!p.naam) return 'Vul de naam in'; if (!p.winkel) return 'Selecteer een winkel'; if (!p.aangebodenUren) return 'Vul de aangeboden uren in'; if (!p.ingangsdatum || !p.reactiedatum) return 'Vul ingangsdatum en reactiedatum in'; return ''; }
  window.oprPdf = async function () {
    var p = oprLees(), f = oprCheck(p); if (f) { toast(f, 'err'); return; }
    var b = g('opr-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/oproepaanbod-mail', Object.assign(p, { alleenPdf: true })); b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'Aanbod.pdf');
  };
  window.oprVerstuur = async function () {
    var p = oprLees(), f = oprCheck(p); if (f) { toast(f, 'err'); return; }
    if (!p.to || p.to.indexOf('@') === -1) { toast('Ongeldig e-mailadres', 'err'); return; }
    var b = g('opr-sbtn'); b.disabled = true; g('opr-slbl').textContent = 'PDF maken en versturen…';
    var r = await api('/api/oproepaanbod-mail', p);
    b.disabled = false; g('opr-slbl').textContent = 'Verstuur aanbod + PDF';
    if (r.success) { toast(r.bericht, 'ok'); closeOprModal(); laadOproep(false); if (tkData) laadTaken(false); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('opr-zoek', 'opr-zoek-res', function (m) {
    if (!m) return;
    g('opr-naam').value = m.naam || ''; g('opr-email').value = m.email || ''; if (m.adres) g('opr-adres').value = m.adres;
    if (m.winkelCode && oprWinkels.some(function (w) { return w.code === m.winkelCode; })) g('opr-winkel').value = m.winkelCode;
    if (m.indienst) g('opr-sinds').value = m.indienst;
    var k = oprData && oprData.kandidaten.find(function (x) { return x.naam === m.naam; });
    if (k) { g('opr-sinds').value = k.sinds; g('opr-periode').value = k.periode; g('opr-gem').value = String(k.gemPerWeek).replace('.', ','); g('opr-aang').value = String(Math.ceil(k.gemPerWeek)); }
    else toast('Niet in de kandidatenlijst: vul het gemiddelde zelf in (of klik eerst ↻ Verse stand)', 'err');
  });

  // ---------- Exit-surveys (fase 2f): reacties inzien, handmatig versturen ----------
  var exData = null, exMaanden = 12;
  var exScore = function (v) { if (v == null) return '<span class="no-doc">-</span>'; var cls = v >= 4 ? 'bg' : v >= 3 ? 'bo' : 'br'; return '<span class="badge ' + cls + '">' + v + '</span>'; };
  window.laadExit = async function (mnd) {
    if (mnd) exMaanden = mnd;
    g('ex-b12').className = 'btn bsm ' + (exMaanden === 12 ? 'bp' : 'bd'); g('ex-b36').className = 'btn bsm ' + (exMaanden === 36 ? 'bp' : 'bd');
    g('ex-body').innerHTML = '<tr><td colspan="11" class="leeg grijs">Laden…</td></tr>';
    var d = await api('/api/exit-admin?maanden=' + exMaanden);
    if (!d.success) { g('ex-body').innerHTML = '<tr><td colspan="11" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    exData = d;
    // status / pauze
    g('ex-pauze').style.display = d.actief ? 'none' : '';
    g('ex-status').className = 'badge ' + (d.actief ? 'bg' : 'bo'); g('ex-status').textContent = d.actief ? 'ACTIEF — link gaat mee in brieven en mails' : 'GEPAUZEERD — geen link, pagina gesloten';
    g('ex-toggle').textContent = d.actief ? 'Pauzeren' : 'Aanzetten'; g('ex-toggle').className = 'btn bsm ' + (d.actief ? 'bd' : 'bp');
    // kolommen volgen de vragenlijst (keuze/schaal/nps); tekstvragen in de laatste kolom
    var kol = (d.vragenConfig || []).filter(function (v) { return v.type !== 'tekst'; });
    g('ex-head').innerHTML = '<tr><th>Ingevuld</th><th>Naam</th><th>Winkel</th>' + kol.map(function (v) { return '<th title="' + esc(v.nl) + '">' + esc(v.nl.length > 22 ? v.nl.slice(0, 20) + '…' : v.nl) + '</th>'; }).join('') + '<th>Opmerking</th></tr>';
    var nk = 4 + kol.length;
    g('ex-count').textContent = d.rijen.length;
    g('ex-body').innerHTML = d.rijen.length ? d.rijen.map(function (r) { var a = r.antwoorden || {}, lb = r.labels || {}; return '<tr><td>' + esc(r.op) + '</td><td>' + (r.anoniem ? '<span class="badge boat">anoniem</span>' : '<strong>' + esc(r.naam) + '</strong>' + (r.email ? '<div class="lay-sub">' + esc(r.email) + '</div>' : '')) + '</td><td>' + esc(r.winkel || '-') + '</td>' + kol.map(function (v) { var x = a[v.key]; if (x == null || x === '') return '<td><span class="no-doc">-</span></td>'; if (v.type === 'schaal') return '<td>' + exScore(x) + '</td>'; if (v.type === 'nps') return '<td><span class="badge ' + (x >= 9 ? 'bg' : x >= 7 ? 'bo' : 'br') + '">' + x + '/10</span></td>'; return '<td>' + esc(lb[v.key] || x) + (a[v.key + '__toelichting'] ? '<div class="lay-sub" style="white-space:normal;max-width:220px">“' + esc(a[v.key + '__toelichting']) + '”</div>' : '') + '</td>'; }).join('') + '<td style="max-width:320px;white-space:normal;font-size:.82rem">' + esc(r.opmerking || '') + '</td></tr>'; }).join('') : '<tr><td colspan="' + nk + '" class="leeg grijs">Nog geen reacties in deze periode.</td></tr>';
    exVragenRender(d.vragenConfig || []); g('ex-vragen-sub').textContent = d.standaard ? 'Standaardlijst (config.js)' : 'Eigen lijst (opgeslagen in het dashboard)';
    g('ex-vcount').textContent = d.vertrokken.length;
    g('ex-vbody').innerHTML = d.vertrokken.length ? d.vertrokken.map(function (v) { var st = v.ingevuld ? '<span class="badge bg">ingevuld</span>' : v.uitgenodigd ? '<span class="badge bo">uitgenodigd</span>' : '<span class="badge boat">nog niet</span>'; return '<tr><td><strong>' + esc(v.naam) + '</strong></td><td>' + esc(v.email || '-') + '</td><td>' + esc(v.winkelNaam || '-') + '</td><td>' + esc(v.einddatum) + (v.nogInDienst ? '<div class="lay-sub">nog in dienst (opzegtermijn)</div>' : '') + (v.bron === 'dossier' ? '<div class="lay-sub">uit ontslagdossier</div>' : '') + '</td><td>' + st + '</td><td>' + (v.ingevuld ? '' : '<button class="btn bp bsm" data-ex-stuur=\'' + esc(JSON.stringify({ naam: v.naam, email: v.email })) + '\'>' + (v.uitgenodigd ? 'Opnieuw' : 'Verstuur') + '</button>') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="leeg grijs">Geen uitdiensttredingen in deze periode (of Shiftbase niet bereikbaar).</td></tr>';
    g('ex-ucount').textContent = d.uitnodigingen.length;
    g('ex-ubody').innerHTML = d.uitnodigingen.length ? d.uitnodigingen.map(function (u) { return '<tr><td>' + esc(u.op) + '</td><td><strong>' + esc(u.naam) + '</strong></td><td>' + esc(u.naar) + '</td><td>' + esc(u.taal || 'NL') + '</td><td>' + esc(u.door || '') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="leeg grijs">Nog geen handmatige uitnodigingen.</td></tr>';
  };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button[data-ex-stuur]'); if (b) openExModal(JSON.parse(b.getAttribute('data-ex-stuur'))); });
  window.exExport = function () {
    if (!exData || !exData.rijen.length) { toast('Geen reacties om te exporteren', 'err'); return; }
    var vr = exData.vragenConfig || [];
    var kop = ['Ingevuld', 'Naam', 'Email', 'Winkel', 'BV', 'Bron', 'Taal'].concat([].concat.apply([], vr.map(function (v) { return v.toelichting ? [v.nl, v.nl + ' — toelichting'] : [v.nl]; })));
    var cel = function (v) { v = v == null ? '' : String(v); return '"' + v.replace(/"/g, '""') + '"'; };
    var regels = [kop.join(';')].concat(exData.rijen.map(function (r) { var a = r.antwoorden || {}, lb = r.labels || {}; return [r.op, r.anoniem ? 'anoniem' : r.naam, r.email, r.winkel, r.bv, r.bron, r.taal].concat([].concat.apply([], vr.map(function (v) { return v.toelichting ? [lb[v.key] || a[v.key], a[v.key + '__toelichting']] : [lb[v.key] || a[v.key]]; }))).map(cel).join(';'); }));
    var blob = new Blob(['\ufeff' + regels.join('\r\n')], { type: 'text/csv;charset=utf-8' }); var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'exit-surveys_' + exMaanden + 'mnd.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  // --- instellingen: aan/uit, voorbeeld, vragen-editor ---
  window.exToggle = async function () {
    if (!exData) return; var aan = !exData.actief;
    if (!confirm(aan ? 'Exit-survey aanzetten? Vanaf nu gaat de link mee in elke ontslagbevestiging, aanzegging en proeftijdbrief.' : 'Exit-survey pauzeren? Brieven en mails gaan dan zonder link; de pagina sluit.')) return;
    var r = await api('/api/exit-admin', { actie: 'actief', actief: aan });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadExit();
  };
  window.exVoorbeeld = async function (taal) { var r = await api('/api/exit-admin', { actie: 'voorbeeld', taal: taal }); if (!r.success) { toast(r.bericht, 'err'); return; } window.open(r.link, '_blank'); };
  // ---------- Gedeelde vragen-editor (exit-survey + check-in) ----------
  // metAlarm: keuze-opties kunnen als alarm gemarkeerd worden ("Nee | No | !") → zo'n antwoord maakt de check-in 'laag'.
  function maakVragenEditor(elId, metAlarm, metVertrek) {
    var ed = { lijst: [], types: ['keuze', 'schaal', 'nps', 'tekst'] };
    var optTekst = function (o) { var alarm = metAlarm && o[3] === true; return o[1] + ((o[2] && o[2] !== o[1]) || alarm ? ' | ' + (o[2] || o[1]) : '') + (alarm ? ' | !' : ''); };
    ed.render = function () {
      var el = g(elId); if (!el) return;
      el.innerHTML = ed.lijst.map(function (v, i) {
        var opt = v.type === 'keuze' ? '<div class="fg" style="margin:8px 0 0"><label>Opties (één per regel: Nederlands | English' + (metAlarm ? ' — zet <b>| !</b> achter een antwoord dat een seintje aan HR moet geven, bijv. Nee | No | !' : '') + ')</label><textarea data-ve="opties" data-i="' + i + '" rows="' + Math.max(3, (v.opties || []).length) + '" style="font-size:.85rem;min-height:0;height:auto">' + esc((v.opties || []).map(optTekst).join('\n')) + '</textarea></div>' : '';
        return '<div class="ve-vraag" style="border:1px solid #e8e2de;border-radius:10px;padding:12px 14px;margin:10px 0;background:#fff"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><strong style="color:#009f4b">' + (i + 1) + '.</strong><select data-ve="type" data-i="' + i + '" style="width:auto">' + ed.types.map(function (t) { return '<option value="' + t + '"' + (t === v.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select><span class="lay-sub" style="flex:1">sleutel: ' + esc(v.key || '(automatisch)') + '</span><button type="button" class="btn bd bsm" title="Omhoog" data-ve-act="op" data-i="' + i + '">↑</button><button type="button" class="btn bd bsm" title="Omlaag" data-ve-act="neer" data-i="' + i + '">↓</button><button type="button" class="btn bd bsm" style="color:#c0392b" title="Verwijderen" data-ve-act="weg" data-i="' + i + '">✕</button></div>'
          + '<div class="fr"><div class="fg" style="margin:0"><label>Nederlands</label><input type="text" data-ve="nl" data-i="' + i + '" value="' + esc(v.nl || '') + '"></div><div class="fg" style="margin:0"><label>English</label><input type="text" data-ve="en" data-i="' + i + '" value="' + esc(v.en || '') + '"></div></div>' + opt
          + '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px">' + (v.type !== 'tekst' ? '<label class="chk"><input type="checkbox" data-ve="toelichting" data-i="' + i + '"' + (v.toelichting ? ' checked' : '') + '> Toelichting-veld eronder (optioneel)</label>' : '') + (metVertrek ? '<label class="chk"><input type="checkbox" data-ve="alleenEigenOntslag" data-i="' + i + '"' + (v.alleenEigenOntslag ? ' checked' : '') + '> Alleen tonen als de medewerker zelf ontslag nam (niet na een aanzegging)</label>' : '') + '</div></div>';
      }).join('') || '<div class="lay-sub">Geen vragen.</div>';
      el.querySelectorAll('[data-ve]').forEach(function (x) { x.addEventListener('change', function () { ed.lees(); if (x.getAttribute('data-ve') === 'type') ed.render(); }); });
    };
    ed.lees = function () {
      var el = g(elId); if (!el) return ed.lijst;
      el.querySelectorAll('[data-ve]').forEach(function (x) {
        var i = +x.getAttribute('data-i'), k = x.getAttribute('data-ve'), v = ed.lijst[i]; if (!v) return;
        if (k === 'opties') {
          var oud = v.opties || [];
          v.opties = x.value.split('\n').map(function (r) {
            var p = r.split('|').map(function (y) { return y.trim(); }); if (!p[0]) return null;
            var alarm = metAlarm && p.slice(1).indexOf('!') > -1, en = p[1] && p[1] !== '!' ? p[1] : p[0];
            var bestaand = oud.find(function (o) { return o[1] === p[0]; }); // sleutel behouden als de NL-tekst gelijk blijft
            var o = [bestaand ? bestaand[0] : '', p[0], en]; if (alarm) o.push(true); return o;
          }).filter(Boolean);
        } else if (x.type === 'checkbox') { if (x.checked) v[k] = true; else delete v[k]; }
        else v[k] = x.value;
        if (k === 'type' && x.value === 'keuze' && !(v.opties && v.opties.length)) v.opties = [['', 'Ja', 'Yes'], ['', 'Nee', 'No']];
      });
      return ed.lijst;
    };
    ed.zet = function (lijst, types) { ed.lijst = JSON.parse(JSON.stringify(lijst || [])); if (types) ed.types = types; ed.render(); };
    ed.toe = function () { ed.lees(); ed.lijst.push({ key: '', type: 'schaal', nl: '', en: '' }); ed.render(); };
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#' + elId + ' [data-ve-act]'); if (!b) return;
      ed.lees(); var i = +b.getAttribute('data-i'), act = b.getAttribute('data-ve-act');
      if (act === 'weg') ed.lijst.splice(i, 1);
      else { var j = i + (act === 'op' ? -1 : 1); if (j < 0 || j >= ed.lijst.length) return; var t = ed.lijst[i]; ed.lijst[i] = ed.lijst[j]; ed.lijst[j] = t; }
      ed.render();
    });
    return ed;
  }
  var exEditor = maakVragenEditor('ex-vragen', false, true);
  function exVragenRender(lijst) { exEditor.zet(lijst, exData && exData.types); }
  window.exVraagToe = function () { exEditor.toe(); };
  window.exVragenOpslaan = async function () {
    var r = await api('/api/exit-admin', { actie: 'vragen', vragen: exEditor.lees() });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadExit();
  };
  window.exVragenHerstel = async function () {
    if (!confirm('Eigen vragenlijst weggooien en de standaardlijst terugzetten?')) return;
    var r = await api('/api/exit-admin', { actie: 'vragen', herstel: true });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadExit();
  };
  window.openExModal = function (v) {
    g('ex-naam').value = v ? v.naam || '' : ''; g('ex-email').value = v ? v.email || '' : ''; g('ex-zoek').value = ''; g('ex-zoek-res').classList.remove('open');
    zetTaal('ex-taal', 'NL'); g('ex-modal').classList.add('open');
    if (!v) setTimeout(function () { g('ex-zoek').focus(); }, 60);
  };
  window.closeExModal = function () { g('ex-modal').classList.remove('open'); };
  g('ex-modal').addEventListener('click', function (e) { if (e.target === this) closeExModal(); });
  koppelTaal('ex-taal');
  // zoeken in de vertrokken-lijst (niet in de actieve medewerkers)
  g('ex-zoek').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase(), res = g('ex-zoek-res');
    if (q.length < 2 || !exData) { res.classList.remove('open'); return; }
    var hits = exData.vertrokken.filter(function (v) { return v.naam.toLowerCase().indexOf(q) > -1; }).slice(0, 8);
    res.innerHTML = hits.length ? hits.map(function (v) { return '<button type="button" data-naam="' + esc(v.naam) + '" data-email="' + esc(v.email || '') + '"><strong>' + esc(v.naam) + '</strong> <span class="lay-sub">' + esc(v.winkelNaam || '') + ' · uit dienst ' + esc(v.einddatum) + '</span></button>'; }).join('') : '<button type="button" class="lay-sub">Niet gevonden in de laatste 36 maanden — vul naam en e-mail handmatig in</button>';
    res.classList.add('open');
    res.querySelectorAll('button[data-naam]').forEach(function (z) { z.onclick = function () { g('ex-naam').value = z.getAttribute('data-naam'); g('ex-email').value = z.getAttribute('data-email'); res.classList.remove('open'); }; });
  });
  function exLees() { return { naam: g('ex-naam').value.trim(), to: g('ex-email').value.trim(), taal: leesTaal('ex-taal') }; }
  window.exPreview = async function () {
    var p = exLees(); if (!p.naam) { toast('Vul de naam in', 'err'); return; }
    var r = await api('/api/exit-admin', Object.assign(p, { preview: true }));
    if (!r.success) { toast(r.bericht, 'err'); return; }
    window.open('', '_blank').document.write(r.html);
  };
  window.exVerstuur = async function () {
    var p = exLees();
    if (!p.naam) { toast('Vul de naam in', 'err'); return; }
    if (!p.to || p.to.indexOf('@') === -1) { toast('Vul een geldig e-mailadres in', 'err'); return; }
    var b = g('ex-sbtn'); b.disabled = true; g('ex-slbl').textContent = 'Versturen…';
    var r = await api('/api/exit-admin', p);
    b.disabled = false; g('ex-slbl').textContent = 'Verstuur uitnodiging';
    if (r.success) { toast(r.bericht, 'ok'); closeExModal(); laadExit(); } else toast('Fout: ' + r.bericht, 'err');
  };

  // ---------- Gesprekken (fase 3b): formulier, dossierblok, overzicht ----------
  var gsData = null, gsDagen = 90, gsMeta = null, gsOpts = {}, dosPersoon = null, dosGesprekken = [];
  var gsVandaag = function () { return new Date().toLocaleDateString('sv-SE'); };
  var gsPlus = function (n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
  async function gsZorgMeta() { if (gsMeta) return gsMeta; var r = await api('/api/gesprek?dagen=7'); if (r.success) gsMeta = { soorten: r.soorten, kanalen: r.kanalen }; return gsMeta; }
  function gsSoortLabel(k) { var s = gsMeta && gsMeta.soorten.find(function (x) { return x.key === k; }); return s ? s.label : k; }
  function gsKaart(x) {
    var vv = x.vervolgDatum ? (x.vervolgOpen ? '<span class="badge ' + (x.vervolgTeLaat ? 'br' : 'bo') + '">vervolg ' + esc(x.vervolgNL) + (x.vervolgTeLaat ? ' — over tijd' : '') + '</span>' : '<span class="badge bg">vervolg ' + esc(x.vervolgNL) + ' afgerond' + (x.vervolgNotitie ? ': ' + esc(x.vervolgNotitie) : '') + '</span>') : '';
    var blok = function (t, v) { return v ? '<div style="margin-top:4px"><span class="lay-sub" style="text-transform:uppercase;letter-spacing:.3px">' + t + '</span><div style="white-space:pre-wrap">' + esc(v) + '</div></div>' : ''; };
    return '<div style="border:1px solid #e8e2de;border-radius:10px;padding:10px 14px;margin:8px 0;background:#fff;font-size:.86rem"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge boat">' + esc(x.soortLabel) + '</span><strong>' + esc(x.datumNL) + '</strong><span class="lay-sub">' + esc([x.kanaal, x.gevoerdDoor].filter(Boolean).join(' · ')) + '</span>' + vv + '<span style="margin-left:auto;display:flex;gap:6px">' + (x.vervolgOpen ? '<button class="btn bp bsm" data-gs-vervolg="' + esc(x.id) + '">Vervolggesprek</button><button class="btn bd bsm" data-gs-af="' + esc(x.id) + '">✓ Vervolg afvinken</button>' : '') + '<button class="btn bd bsm" data-gs-bewerk="' + esc(x.id) + '">Bewerken</button></span></div>'
      + blok('Aanleiding', x.aanleiding) + blok('Besproken', x.besproken) + blok('Afspraken', x.afspraken) + (x.bijgewerkt ? '<div class="lay-sub" style="margin-top:4px">bewerkt ' + esc(x.bijgewerkt) + ' door ' + esc(x.bijgewerktDoor) + '</div>' : '') + '</div>';
  }
  window.openGesprek = async function (o) {
    o = o || {}; gsOpts = o; await gsZorgMeta();
    var gs = o.gesprek || null, p = o.persoon || (gs ? { naam: gs.naam, email: gs.email, mid: gs.medewerker_id, winkel: gs.winkel } : {});
    g('gs-soort').innerHTML = (gsMeta ? gsMeta.soorten : []).map(function (s) { return '<option value="' + s.key + '">' + esc(s.label) + '</option>'; }).join('');
    g('gs-kanaal').innerHTML = '<option value="">—</option>' + (gsMeta ? gsMeta.kanalen : []).map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('');
    g('gs-id').value = gs ? gs.id : ''; g('gs-naam').value = p.naam || ''; g('gs-email').value = p.email || ''; g('gs-mid').value = p.mid || ''; g('gs-winkel').value = p.winkel || '';
    if (!g('gs-mid').value && p.naam) { var m = medewerkers.find(function (x) { return normN(x.naam) === normN(p.naam); }); if (m) { g('gs-mid').value = m.id; if (!g('gs-winkel').value) g('gs-winkel').value = m.winkelNaam || ''; if (!g('gs-email').value) g('gs-email').value = m.email || ''; } }
    g('gs-soort').value = gs ? gs.soort : (o.soort || 'overig'); g('gs-datum').value = gs ? gs.datum : gsVandaag(); g('gs-datum').max = gsVandaag();
    g('gs-kanaal').value = gs ? gs.kanaal : ''; g('gs-door').value = gs ? gs.gevoerdDoor : ikNaam;
    g('gs-aanleiding').value = gs ? gs.aanleiding : (o.aanleiding || ''); g('gs-besproken').value = gs ? gs.besproken : ''; g('gs-afspraken').value = gs ? gs.afspraken : ''; g('gs-vervolg').value = gs ? gs.vervolgDatum : '';
    g('gs-titel').textContent = gs ? 'Gesprek bewerken' : o.vervolgVan ? 'Vervolggesprek vastleggen' : 'Gesprek vastleggen';
    var ctx = o.checkinId ? 'Bij opslaan wordt de lage check-in ook op <b>opgevolgd</b> gezet.' : o.vervolgVan ? 'Bij opslaan wordt de vervolgafspraak van het vorige gesprek afgerond.' : '';
    g('gs-context').innerHTML = ctx; g('gs-context').style.display = ctx ? '' : 'none';
    g('gs-alleenaf').style.display = o.checkinId ? '' : 'none';
    g('gs-fg-zoek').style.display = p.naam ? 'none' : ''; g('gs-zoek').value = ''; g('gs-zoek-res').classList.remove('open');
    gsHint(); g('gs-modal').classList.add('open');
    setTimeout(function () { (p.naam ? g('gs-besproken') : g('gs-zoek')).focus(); }, 60);
  };
  window.closeGesprek = function () { g('gs-modal').classList.remove('open'); };
  g('gs-modal').addEventListener('click', function (e) { if (e.target === this) closeGesprek(); });
  window.gsHint = function () { var s = gsMeta && gsMeta.soorten.find(function (x) { return x.key === g('gs-soort').value; }); g('gs-hint').textContent = s && s.hint ? s.hint : ''; g('gs-hint').style.display = s && s.hint ? '' : 'none'; };
  koppelSbZoek('gs-zoek', 'gs-zoek-res', function (m) { if (!m) return; g('gs-naam').value = m.naam; g('gs-email').value = m.email || ''; g('gs-mid').value = m.id; g('gs-winkel').value = m.winkelNaam || ''; g('gs-fg-zoek').style.display = 'none'; });
  window.gsOpslaan = async function () {
    var gsp = { id: g('gs-id').value || undefined, naam: g('gs-naam').value.trim(), email: g('gs-email').value.trim(), medewerker_id: g('gs-mid').value, winkel: g('gs-winkel').value, soort: g('gs-soort').value, datum: g('gs-datum').value, kanaal: g('gs-kanaal').value, gevoerd_door: g('gs-door').value.trim(), aanleiding: g('gs-aanleiding').value, besproken: g('gs-besproken').value, afspraken: g('gs-afspraken').value, vervolg_datum: g('gs-vervolg').value || null };
    var b = g('gs-sbtn'); b.disabled = true; g('gs-slbl').textContent = 'Opslaan…';
    var r = await api('/api/gesprek', { actie: 'opslaan', gesprek: gsp, checkinId: gsOpts.checkinId, vervolgVan: gsOpts.vervolgVan });
    b.disabled = false; g('gs-slbl').textContent = 'Gesprek opslaan';
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); closeGesprek(); gsNa();
  };
  window.gsAlleenAfvinken = async function () {
    var nt = prompt('Check-in afvinken zonder gesprek. Wat is er gedaan? (optioneel)', ''); if (nt === null) return;
    var r = await api('/api/checkin-admin', { actie: 'opgevolgd', id: gsOpts.checkinId, notitie: nt });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); closeGesprek(); gsNa();
  };
  function gsNa() {
    if (gsOpts.naOpslaan) gsOpts.naOpslaan();
    if (gsData) laadGesprekken();
    if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier);
  }
  document.addEventListener('click', async function (e) {
    var pl = e.target.closest && e.target.closest('button[data-gs-plus]'); if (pl) { var n = +pl.getAttribute('data-gs-plus'); g('gs-vervolg').value = n ? gsPlus(n) : ''; return; }
    var nw = e.target.closest && e.target.closest('button[data-gs-nieuw]'); if (nw) { openGesprek({ persoon: dosPersoon }); return; }
    var bron = function (id) { return (dosGesprekken || []).concat(gsData ? gsData.gesprekken.concat(gsData.open) : []).find(function (x) { return x.id === id; }); };
    var bw = e.target.closest && e.target.closest('button[data-gs-bewerk]'); if (bw) { var x = bron(bw.getAttribute('data-gs-bewerk')); if (x) openGesprek({ gesprek: x }); return; }
    var vv = e.target.closest && e.target.closest('button[data-gs-vervolg]'); if (vv) { var y = bron(vv.getAttribute('data-gs-vervolg')); if (y) openGesprek({ persoon: { naam: y.naam, email: y.email, mid: y.medewerker_id, winkel: y.winkel }, soort: y.soort, vervolgVan: y.id, aanleiding: 'Vervolg op ' + y.soortLabel.toLowerCase() + ' van ' + y.datumNL + (y.afspraken ? '. Afspraak was: ' + y.afspraken : ''), naOpslaan: function () { if (tkData) laadTaken(false); } }); return; }
    var af = e.target.closest && e.target.closest('button[data-gs-af]'); if (af) {
      var nt = prompt('Vervolg afvinken zonder nieuw gesprek. Reden of notitie (optioneel):', ''); if (nt === null) return;
      var r = await api('/api/gesprek', { actie: 'vervolg-af', id: af.getAttribute('data-gs-af'), notitie: nt });
      if (!r.success) { toast(r.bericht, 'err'); return; }
      toast(r.bericht, 'ok'); gsOpts = {}; gsNa(); if (tkData) laadTaken(false);
    }
  });
  window.laadGesprekken = async function (dagen) {
    if (dagen) gsDagen = dagen;
    g('gs-b90').className = 'btn bsm ' + (gsDagen === 90 ? 'bp' : 'bd'); g('gs-b365').className = 'btn bsm ' + (gsDagen === 365 ? 'bp' : 'bd');
    g('gs-body').innerHTML = '<tr><td colspan="9" class="leeg grijs">Laden…</td></tr>';
    var d = await api('/api/gesprek?dagen=' + gsDagen);
    if (!d.success) { g('gs-body').innerHTML = '<tr><td colspan="9" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    gsData = d; gsMeta = { soorten: d.soorten, kanalen: d.kanalen };
    var fs = g('gs-fsoort'), keuze = fs.value; fs.innerHTML = '<option value="">Alle soorten</option>' + d.soorten.map(function (s) { return '<option value="' + s.key + '">' + esc(s.label) + '</option>'; }).join(''); fs.value = keuze;
    g('gs-ocount').textContent = d.open.length;
    g('gs-obody').innerHTML = d.open.length ? d.open.map(function (x) { return '<tr><td><span class="badge ' + (x.vervolgTeLaat ? 'br' : 'bo') + '">' + esc(x.vervolgNL) + '</span></td><td><strong>' + esc(x.naam) + '</strong></td><td>' + esc(x.winkel || '-') + '</td><td>' + esc(x.soortLabel) + '</td><td>' + esc(x.datumNL) + '</td><td style="max-width:320px;white-space:normal;font-size:.82rem">' + esc(x.afspraken || '') + '</td><td style="white-space:nowrap"><button class="btn bp bsm" data-gs-vervolg="' + esc(x.id) + '">Vervolggesprek</button> <button class="btn bd bsm" data-gs-af="' + esc(x.id) + '">✓ Afvinken</button> ' + dosBtn(x.naam, x.email) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="leeg grijs">Geen openstaande vervolgafspraken.</td></tr>';
    gsRender();
  };
  window.gsRender = function () {
    var d = gsData; if (!d) return; var fs = g('gs-fsoort').value;
    var rijen = d.gesprekken.filter(function (x) { return !fs || x.soort === fs; });
    g('gs-count').textContent = rijen.length;
    g('gs-body').innerHTML = rijen.length ? rijen.map(function (x) { return '<tr><td>' + esc(x.datumNL) + '</td><td><strong>' + esc(x.naam) + '</strong></td><td>' + esc(x.winkel || '-') + '</td><td><span class="badge boat">' + esc(x.soortLabel) + '</span></td><td>' + esc(x.gevoerdDoor || '') + '</td><td style="max-width:300px;white-space:normal;font-size:.82rem">' + esc(x.aanleiding || '') + (x.besproken ? '<div class="lay-sub">' + esc(x.besproken.slice(0, 160)) + (x.besproken.length > 160 ? '…' : '') + '</div>' : '') + '</td><td style="max-width:260px;white-space:normal;font-size:.82rem">' + esc(x.afspraken || '') + '</td><td>' + (x.vervolgDatum ? '<span class="badge ' + (x.vervolgOpen ? (x.vervolgTeLaat ? 'br' : 'bo') : 'bg') + '">' + esc(x.vervolgNL) + (x.vervolgOpen ? '' : ' ✓') + '</span>' : '<span class="no-doc">-</span>') + '</td><td><button class="btn bd bsm" data-gs-bewerk="' + esc(x.id) + '">Bewerken</button> ' + dosBtn(x.naam, x.email) + '</td></tr>'; }).join('') : '<tr><td colspan="9" class="leeg grijs">Geen gesprekken in deze periode.</td></tr>';
  };
  window.gsExport = function () {
    if (!gsData || !gsData.gesprekken.length) { toast('Geen gesprekken om te exporteren', 'err'); return; }
    var cel = function (v) { v = v == null ? '' : String(v); return '"' + v.replace(/"/g, '""') + '"'; };
    var kop = ['Datum', 'Naam', 'Email', 'Winkel', 'Soort', 'Hoe', 'Gevoerd door', 'Aanleiding', 'Besproken', 'Afspraken', 'Vervolg', 'Vervolg afgerond'];
    var regels = [kop.join(';')].concat(gsData.gesprekken.map(function (x) { return [x.datumNL, x.naam, x.email, x.winkel, x.soortLabel, x.kanaal, x.gevoerdDoor, x.aanleiding, x.besproken, x.afspraken, x.vervolgNL, x.vervolgAfgerond].map(cel).join(';'); }));
    var url = URL.createObjectURL(new Blob(['﻿' + regels.join('\r\n')], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'gesprekken_' + gsDagen + 'dgn.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  // ---------- Scorekaart per winkel (fase 3c) ----------
  var skData = null, skMaanden = 6, skWinkel = null;
  var SK_KLS = { groen: 'bg', oranje: 'bo', rood: 'br', klein: 'boat', geen: 'boat' };
  var SK_KORT = { verloop: 'Verloop', vroegPct: 'Weg ≤ 90 d (uitstroom)', uitval90: 'Nieuw weg ≤ 90 d', checkinScore: 'Check-in', checkinLaagPct: 'Lage check-ins', onboarding: 'Onboarding op tijd', verzuimPct: 'Verzuim', meldingsfreq: 'Meldingen p.p./jr', enps: 'eNPS exit', aanzegOpTijd: 'Aanzegging op tijd', welkomAf: 'Welkom Academy af', certGeldig: 'Certificaat geldig' };
  window.laadScorekaart = async function (mnd, vers) {
    if (mnd) skMaanden = mnd;
    [3, 6, 12].forEach(function (m) { g('sk-b' + m).className = 'btn bsm ' + (skMaanden === m ? 'bp' : 'bd'); });
    g('sk-body').innerHTML = '<tr><td class="leeg grijs">Scorekaart berekenen (Shiftbase + dashboard)…</td></tr>';
    var d = await api('/api/scorekaart?maanden=' + skMaanden + (vers ? '&ververs=1' : ''));
    if (!d.success) { g('sk-body').innerHTML = '<tr><td class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    skData = d;
    g('sk-periode').textContent = d.periode + ' · bijgewerkt ' + (d.bijgewerkt || '');
    g('sk-fout').style.display = d.fouten && d.fouten.length ? '' : 'none'; g('sk-fout').textContent = d.fouten && d.fouten.length ? 'Niet alles kon worden opgehaald: ' + d.fouten.join(' · ') : '';
    g('sk-head').innerHTML = '<tr><th>Winkel</th><th>In dienst</th>' + d.kpis.map(function (k) { return '<th title="' + esc(k.label + ' — ' + k.uitleg) + '">' + esc(SK_KORT[k.key] || k.label) + '</th>'; }).join('') + '<th>Aandacht</th><th></th></tr>';
    var cel = function (it, tot) { if (!it || it.v === null || it.v === undefined) return '<td><span class="no-doc">-</span></td>'; return '<td' + (it.n ? ' title="n=' + Math.round(it.n) + '"' : '') + '>' + (tot ? '<strong>' + esc(it.f) + '</strong>' : '<span class="badge ' + (SK_KLS[it.status] || 'boat') + '">' + esc(it.f) + '</span>') + '</td>'; };
    var rij = function (w, tot) { return '<tr class="' + (tot ? 'sk-tot' : 'sk-rij') + (skWinkel === w.naam ? ' sk-sel' : '') + '"' + (tot ? '' : ' data-sk="' + esc(w.naam) + '"') + '><td><strong>' + esc(w.naam) + '</strong></td><td>' + w.bestand + '</td>' + d.kpis.map(function (k) { return cel(w.waarden[k.key], tot); }).join('') + '<td>' + (tot ? '' : (w.rood ? '<span class="badge br">' + w.rood + '</span> ' : '') + (w.oranje ? '<span class="badge bo">' + w.oranje + '</span>' : (w.rood ? '' : '<span class="no-doc">-</span>'))) + '</td><td>' + (tot ? '' : '<button class="btn bd bsm" data-sk-pdf="' + esc(w.naam) + '" title="PDF voor het overleg met de Store Manager">⬇ PDF</button>') + '</td></tr>'; };
    g('sk-body').innerHTML = rij(d.totaal, true) + d.winkels.map(function (w) { return rij(w, false); }).join('');
    if (skWinkel && d.winkels.some(function (w) { return w.naam === skWinkel; })) skDetail(skWinkel); else g('sk-detail').style.display = 'none';
  };
  function skSpark(reeks, kleur, max, labels, dec) {
    var n = reeks.length, w = 18, h = 46, mx = max || Math.max.apply(null, reeks.map(function (v) { return v || 0; }).concat([1]));
    var bars = reeks.map(function (v, i) { var hh = v ? Math.max(2, Math.round(v / mx * (h - 12))) : 1; return '<rect x="' + (i * (w + 6)) + '" y="' + (h - hh) + '" width="' + w + '" height="' + hh + '" rx="2" fill="' + (v === null ? '#e8e2de' : kleur) + '"><title>' + esc(labels[i]) + ': ' + (v === null ? 'geen' : String(v).replace('.', ',')) + '</title></rect>' + (v ? '<text x="' + (i * (w + 6) + w / 2) + '" y="' + (h - hh - 2) + '" font-size="8" text-anchor="middle" fill="#888078">' + String(dec ? v.toFixed(1) : v).replace('.', ',') + '</text>' : ''); }).join('');
    var lbl = labels.map(function (l, i) { return '<text x="' + (i * (w + 6) + w / 2) + '" y="' + (h + 11) + '" font-size="8" text-anchor="middle" fill="#888078">' + esc(l.split(' ')[0]) + '</text>'; }).join('');
    return '<svg width="' + (n * (w + 6)) + '" height="' + (h + 14) + '" style="overflow:visible">' + bars + lbl + '</svg>';
  }
  function skDetail(naam) {
    var d = skData, w = d.winkels.find(function (x) { return x.naam === naam; }); if (!w) return;
    skWinkel = naam;
    document.querySelectorAll('#sk-body tr.sk-rij').forEach(function (tr) { tr.classList.toggle('sk-sel', tr.getAttribute('data-sk') === naam); });
    g('sk-d-titel').textContent = 'Scorekaart ' + naam + ' · ' + d.periode;
    var lijst = function (titel, items, cls) { return '<div style="flex:1;min-width:280px"><div class="lay-sub" style="text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">' + titel + '</div>' + (items.length ? items.map(function (a) { return '<div class="alert ' + cls + '" style="margin:0 0 6px;padding:8px 12px;font-size:.85rem">' + esc(a.tekst) + '</div>'; }).join('') : '<div class="lay-sub">—</div>') + '</div>'; };
    var h = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><span class="badge boat">In dienst ' + w.bestand + '</span><span class="badge boat">Instroom ' + w.instroom + '</span><span class="badge boat">Uitstroom ' + w.uitstroom + '</span><span class="badge ' + (w.lopendVerzuim ? 'bo' : 'boat') + '">Nu ziek ' + w.lopendVerzuim + '</span><span class="badge boat">Check-ins ' + w.checkin.ingevuld + '/' + w.checkin.verstuurd + ' ingevuld' + (w.checkin.laag ? ', ' + w.checkin.laag + ' laag' : '') + '</span></div>';
    h += '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px">' + lijst('Aandachtspunten', w.aandacht, 'rood') + lijst('Wat goed gaat', w.goed, 'groen') + '</div>';
    h += '<div style="display:flex;gap:36px;flex-wrap:wrap">'
      + '<div><div class="lay-sub" style="margin-bottom:4px">Instroom per maand</div>' + skSpark(w.trend.in, '#009f4b', null, d.maanden) + '</div>'
      + '<div><div class="lay-sub" style="margin-bottom:4px">Uitstroom per maand</div>' + skSpark(w.trend.uit, '#e8824a', null, d.maanden) + '</div>'
      + '<div><div class="lay-sub" style="margin-bottom:4px">Check-in score per maand (1–5)</div>' + skSpark(w.trend.checkin, '#2980b9', 5, d.maanden, true) + '</div>'
      + '<div><div class="lay-sub" style="margin-bottom:4px">Ziekmeldingen per maand</div>' + skSpark(w.trend.meldingen, '#9a4a1a', null, d.maanden) + '</div></div>';
    g('sk-d-body').innerHTML = h; g('sk-detail').style.display = '';
  }
  window.skPdf = async function (naam) {
    naam = naam || skWinkel; if (!naam) return;
    toast('PDF maken voor ' + naam + '…', 'ok');
    var r = await api('/api/scorekaart?maanden=' + skMaanden + '&winkel=' + encodeURIComponent(naam) + '&pdf=1');
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam);
  };
  document.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('button[data-sk-pdf]'); if (p) { e.stopPropagation(); skPdf(p.getAttribute('data-sk-pdf')); return; }
    var tr = e.target.closest && e.target.closest('#sk-body tr.sk-rij'); if (tr) { skDetail(tr.getAttribute('data-sk')); setTimeout(function () { g('sk-detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }
  });

  // ---------- HR-maandrapport (fase 4b) ----------
  var MR_MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function mrVulMaanden() {
    var sel = g('mr-maand'); if (!sel || sel.options.length) return;
    var nu = new Date();
    for (var i = 0; i <= 12; i++) { var d = new Date(nu.getFullYear(), nu.getMonth() - i, 1), o = document.createElement('option'); o.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); o.textContent = MR_MAAND[d.getMonth()] + ' ' + d.getFullYear() + (i === 0 ? ' (lopend)' : ''); if (i === 1) o.selected = true; sel.appendChild(o); }
  }
  window.laadMaandrapport = async function () {
    mrVulMaanden(); var maand = g('mr-maand').value;
    g('mr-body').innerHTML = '<div class="lay-sub">Maandrapport berekenen (Shiftbase + dashboard, 12 maanden)…</div>';
    var d = await api('/api/maandrapport?maand=' + encodeURIComponent(maand));
    if (!d.success) { g('mr-body').innerHTML = '<div class="alert rood" style="margin:0">' + esc(d.bericht) + '</div>'; return; }
    var kl = { beter: 'bg', slechter: 'br', gelijk: 'boat' };
    var tegel = function (w, l, s) { return '<div style="background:#f8f3f0;border-radius:8px;padding:10px 14px;min-width:120px"><div style="font-size:1.35rem;font-weight:700">' + esc(w) + '</div><div class="lay-sub" style="font-weight:600;color:#333d3a">' + esc(l) + '</div>' + (s ? '<div class="lay-sub">' + esc(s) + '</div>' : '') + '</div>'; };
    var k = d.kern, h = '';
    if (d.fouten && d.fouten.length) h += '<div class="alert geel" style="margin:0 0 10px">Niet alles kon worden opgehaald: ' + esc(d.fouten.join(' · ')) + '</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' + tegel(k.bestand, 'In dienst eind maand', 'vorige maand ' + k.vorig.bestand) + tegel(k.instroom, 'Instroom', 'vorige maand ' + k.vorig.instroom) + tegel(k.uitstroom, 'Uitstroom', 'vorige maand ' + k.vorig.uitstroom) + tegel((k.netto > 0 ? '+' : '') + k.netto, 'Netto', '') + tegel(k.verloop12, 'Verloop 12 mnd', '') + tegel(k.nuZiek, 'Nu ziek', '') + '</div>';
    h += '<div style="display:flex;gap:28px;flex-wrap:wrap"><div style="flex:1;min-width:300px"><div class="lay-sub" style="text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">In het kort · ' + esc(d.label) + '</div><ul style="margin:0;padding-left:18px;font-size:.88rem;line-height:1.5">' + d.zinnen.map(function (z) { return '<li>' + esc(z) + '</li>'; }).join('') + '</ul></div>';
    h += '<div style="flex:1.4;min-width:340px;overflow-x:auto"><table class="sk-tabel" style="width:100%"><thead><tr><th>Indicator</th><th>' + esc(d.label) + '</th><th>' + esc(d.labelVorig) + '</th><th>Verschil</th><th>12 mnd</th></tr></thead><tbody>' + d.kpis.map(function (x) { return '<tr><td title="' + esc(x.uitleg) + '">' + esc(x.label) + '</td><td><strong>' + esc(x.nu.f) + '</strong></td><td>' + esc(x.vorig.f) + '</td><td>' + (x.verschil.tekst ? '<span class="badge ' + (kl[x.verschil.oordeel] || 'boat') + '">' + esc(x.verschil.tekst) + '</span>' : '') + '</td><td>' + esc(x.jaar.f) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    var rood = d.winkels.filter(function (w) { return w.rood; });
    if (rood.length) h += '<div class="lay-sub" style="text-transform:uppercase;letter-spacing:.4px;margin:14px 0 6px">Aandachtspunten per winkel · ' + esc(d.periodeWinkels) + '</div>' + rood.map(function (w) { return '<div class="alert rood" style="margin:0 0 6px;padding:8px 12px;font-size:.85rem"><strong>' + esc(w.naam) + ':</strong> ' + esc(w.aandacht.join(' · ')) + '</div>'; }).join('');
    h += '<div class="lay-sub" style="margin-top:10px">Bijgewerkt ' + esc(d.bijgewerkt || '') + ' · de PDF bevat ook de trend over 12 maanden, uitstroomredenen, wat HR deed en de tabel per winkel.</div>';
    g('mr-body').innerHTML = h;
  };
  window.mrPdf = async function () {
    mrVulMaanden(); var maand = g('mr-maand').value;
    toast('Maandrapport maken…', 'ok');
    var r = await api('/api/maandrapport?maand=' + encodeURIComponent(maand) + '&pdf=1');
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam);
  };
  window.mrMail = async function () {
    mrVulMaanden(); var sel = g('mr-maand'), lbl = sel.options[sel.selectedIndex].textContent;
    if (!confirm('Maandrapport ' + lbl + ' nu mailen naar Mischa, Jodi en Ymke?')) return;
    toast('Maandrapport mailen…', 'ok');
    var r = await api('/api/maandrapport', { maand: sel.value, actie: 'mail' });
    toast(r.success ? r.bericht : 'Mail: ' + r.bericht, r.success ? 'ok' : 'err');
  };

  // ---------- Contractverlenging (fase 4c) ----------
  var vlData = null, vlFilt = 'open', vlItem = null, vlTaakRij = null;
  var VL_STATUS = { 'besluit-nodig': ['br', 'Besluit nodig'], 'wacht-shiftbase': ['bo', 'Wacht op Shiftbase'], 'wacht-aanzegging': ['br', 'Aanzegging versturen'], 'wacht-bevestiging': ['bo', 'Ontslagbevestiging versturen'], 'type-klopt-niet': ['br', 'Vast ≠ Shiftbase'], 'tegenstrijdig': ['br', 'Tegenstrijdig'], 'van-rechtswege-vast': ['br', 'Van rechtswege vast'], 'afgerond': ['bg', 'Afgerond'] };
  window.vlFilter = function (f) { vlFilt = f; g('vl-f-open').className = 'btn bsm ' + (f === 'open' ? 'bp' : 'bd'); g('vl-f-alle').className = 'btn bsm ' + (f === 'alle' ? 'bp' : 'bd'); renderVerlenging(); };
  window.laadVerlenging = async function () {
    g('vl-body').innerHTML = '<tr><td colspan="10" class="leeg grijs">Contracten ophalen uit Shiftbase…</td></tr>';
    var d = await api('/api/verlenging');
    if (!d.success) { g('vl-body').innerHTML = '<tr><td colspan="10" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    vlData = d; g('vl-melding').style.display = d.tabelOk ? 'none' : ''; g('vl-melding').textContent = d.tabelOk ? '' : 'Migratie 0014 is nog niet gedraaid: besluiten kunnen nog niet worden opgeslagen.';
    renderVerlenging();
  };
  function renderVerlenging() {
    if (!vlData) return;
    var lijst = vlData.lijst.filter(function (x) { return vlFilt === 'alle' || x.open; });
    g('vl-count').textContent = vlData.lijst.filter(function (x) { return x.open; }).length + ' open · ' + vlData.lijst.length + ' totaal';
    g('vl-body').innerHTML = lijst.map(function (x) {
      var st = VL_STATUS[x.status] || ['boat', x.status], b = x.besluit;
      var dl = x.aanzegplichtig ? '<span class="badge ' + (x.dagenTotDeadline < 0 ? 'br' : x.dagenTotDeadline <= 5 ? 'bo' : 'boat') + '">' + esc(x.deadline) + '</span>' : '<span class="lay-sub">geen aanzegplicht</span>';
      var kt = x.keten.aantal + ' · ' + String(x.keten.maanden).replace('.', ',') + ' mnd' + (x.keten.vol ? ' <span class="badge br">vol</span>' : x.keten.laatste ? ' <span class="badge bo">laatste tijdelijke</span>' : '');
      return '<tr><td><strong>' + esc(x.naam) + '</strong></td><td>' + esc(x.winkel) + '</td><td>' + esc(x.start) + '<div class="lay-sub">' + esc(x.type || '') + ' · ' + String(x.duurMnd).replace('.', ',') + ' mnd</div></td><td>' + esc(x.einddatum) + '<div class="lay-sub">over ' + x.dagenTotEinde + ' d</div></td><td>' + dl + '</td><td>' + kt + '</td>'
        + '<td>' + (b ? esc(b.label) + (b.nieuweEind ? '<div class="lay-sub">t/m ' + esc(b.nieuweEind.split('-').reverse().join('-')) + '</div>' : '') : '<span class="no-doc">-</span>') + '</td><td>' + (b && b.advies ? esc(b.adviesLabel) + (b.adviesOpmerking ? '<div class="lay-sub">' + esc(b.adviesOpmerking) + '</div>' : '') : '<span class="no-doc">-</span>') + '</td>'
        + '<td><span class="badge ' + st[0] + '" title="' + esc(x.titel + (x.uitleg ? ' — ' + x.uitleg : '')) + '">' + esc(st[1]) + '</span>' + (x.vervolg ? '<div class="lay-sub">Shiftbase: ' + (x.vervolg.vast ? 'vast' : 't/m ' + esc(x.vervolg.eind)) + '</div>' : x.brief ? '<div class="lay-sub">' + (x.brief.type === 'aanzegging' ? 'aanzegging' : 'bevestiging') + ' ' + esc(x.brief.verzonden) + '</div>' : '') + '</td>'
        + '<td><div class="vb-knoppen"><button class="btn ' + (x.status === 'besluit-nodig' ? 'bp' : 'bd') + ' bsm" data-vl-mid="' + esc(x.mid) + '" data-vl-eind="' + esc(x.eindIso) + '">' + (b ? 'Besluit wijzigen' : 'Besluit') + '</button>' + (x.status === 'wacht-aanzegging' ? '<button class="btn bp bsm" data-vl-brief="aanzegging" data-vl-mid="' + esc(x.mid) + '" data-vl-eind="' + esc(x.eindIso) + '">Aanzegging</button>' : x.status === 'wacht-bevestiging' ? '<button class="btn bp bsm" data-vl-brief="ontslag" data-vl-mid="' + esc(x.mid) + '" data-vl-eind="' + esc(x.eindIso) + '">Ontslagbevestiging</button>' : '') + dosBtn(x.naam, x.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">' + (vlFilt === 'open' ? 'Niets open — alle aflopende contracten zijn geregeld.' : 'Geen tijdelijke contracten die binnen 60 dagen aflopen.') + '</td></tr>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-vl-mid]'); if (!b || !vlData) return;
    var x = vlData.lijst.find(function (y) { return y.mid === b.getAttribute('data-vl-mid') && y.eindIso === b.getAttribute('data-vl-eind'); }); if (!x) return;
    var brief = b.getAttribute('data-vl-brief');
    if (brief) { swT('ontslag', 'Ontslag & aanzegging'); openOntslagMail(brief === 'aanzegging' ? { naam: x.naam, email: x.email, einddatum: x.einddatum, type: 'aanzegging' } : { naam: x.naam, email: x.email, einddatum: x.einddatum, type: 'ontslag', zelfOpgezegd: true }); return; }
    openVerlenging(x, null);
  });
  window.openVerlenging = function (x, taakRij) {
    vlItem = x; vlTaakRij = taakRij || null;
    g('vl-titel').textContent = 'Besluit contract — ' + x.naam;
    g('vl-context').innerHTML = '<strong>' + esc(x.naam) + '</strong> · ' + esc(x.winkel || '-') + '<br>Huidig contract ' + esc(x.startIso ? x.startIso.split('-').reverse().join('-') : '') + ' t/m <strong>' + esc(x.einddatum) + '</strong> (over ' + x.dagenTotEinde + ' dagen' + (x.duurMnd ? ', ' + String(x.duurMnd).replace('.', ',') + ' mnd' : '') + ')<br>'
      + 'Keten: ' + x.keten.aantal + ' contract' + (x.keten.aantal === 1 ? '' : 'en') + ', ' + String(x.keten.maanden).replace('.', ',') + ' maanden' + (x.keten.gecorrigeerd ? ' (aantal door HR vastgelegd)' : '')
      + (x.aanzegplichtig ? '<br>Besluit uiterlijk <strong>' + esc(x.deadline) + '</strong> · de medewerker moet het uiterlijk <strong>' + esc(x.wettelijkeDeadline) + '</strong> schriftelijk weten (aanzegtermijn)' : '<br>Contract korter dan 6 maanden: geen wettelijke aanzegtermijn');
    g('vl-keten').style.display = x.keten.vol || x.keten.laatste ? '' : 'none';
    g('vl-keten').className = 'alert ' + (x.keten.vol ? 'rood' : 'geel');
    g('vl-keten').innerHTML = x.keten.vol ? '<strong>Keten vol</strong> — een nieuw tijdelijk contract wordt van rechtswege een vast contract (art. 7:668a BW). Verlengen = vast contract.' : '<strong>Let op:</strong> het volgende contract is het laatste tijdelijke; daarna kan alleen nog vast.';
    var b = x.besluit;
    document.querySelectorAll('input[name="vl-besluit"]').forEach(function (r) { r.checked = !!b && r.value === b.besluit; });
    g('vl-nieuwe-eind').value = b && b.nieuweEind ? b.nieuweEind : '';
    g('vl-advies').value = b ? (b.advies || '') : ''; g('vl-advies-opm').value = b ? (b.adviesOpmerking || '') : ''; g('vl-notitie').value = b ? (b.notitie || '') : '';
    g('vl-mid').value = x.mid; g('vl-eind').value = x.eindIso; g('vl-start').value = x.startIso || '';
    g('vl-wis').style.display = b ? '' : 'none';
    vlToon(); g('vl-modal').classList.add('open');
  };
  function vlKeuze() { var r = document.querySelector('input[name="vl-besluit"]:checked'); return r ? r.value : ''; }
  function vlToon() { g('vl-fg-eind').style.display = vlKeuze() === 'verlengen-tijdelijk' ? '' : 'none'; }
  document.addEventListener('change', function (e) { if (e.target && e.target.name === 'vl-besluit') vlToon(); });
  window.vlPlus = function (mnd) {
    var e = String(g('vl-eind').value || '').split('-'); if (e.length !== 3) return;
    var d = new Date(+e[0], +e[1] - 1 + mnd, +e[2] - 1); // nieuw contract start op de einddatum (zoals in Shiftbase) → einde = n maanden later min 1 dag
    g('vl-nieuwe-eind').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  window.closeVerlenging = function () { g('vl-modal').classList.remove('open'); };
  g('vl-modal').addEventListener('click', function (e) { if (e.target === this) closeVerlenging(); });
  async function vlNaOpslaan(besluit) {
    closeVerlenging(); vlData = null;
    if (g('tab-verlenging').classList.contains('active')) laadVerlenging();
    if (vlTaakRij && tkData) laadTaken(true);
    if (besluit === 'niet-verlengen' && confirm('Aanzegging nu opstellen?')) { swT('ontslag', 'Ontslag & aanzegging'); openOntslagMail({ naam: vlItem.naam, email: vlItem.email, einddatum: vlItem.einddatum, type: 'aanzegging' }); }
    if (besluit === 'zelf-opgezegd' && confirm('Ontslagbevestiging nu opstellen?')) { swT('ontslag', 'Ontslag & aanzegging'); openOntslagMail({ naam: vlItem.naam, email: vlItem.email, einddatum: vlItem.einddatum, type: 'ontslag', zelfOpgezegd: true }); }
  }
  window.vlOpslaan = async function (bevestigVol) {
    var besluit = vlKeuze(); if (!besluit) { toast('Kies een besluit', 'err'); return; }
    var p = { mid: g('vl-mid').value, eindIso: g('vl-eind').value, startIso: g('vl-start').value, naam: vlItem.naam, email: vlItem.email, winkel: vlItem.winkel, besluit: besluit, nieuweEind: g('vl-nieuwe-eind').value, advies: g('vl-advies').value, adviesOpmerking: g('vl-advies-opm').value, notitie: g('vl-notitie').value, bevestigVol: bevestigVol ? 1 : 0 };
    g('vl-sbtn').disabled = true;
    var r = await api('/api/verlenging', p);
    g('vl-sbtn').disabled = false;
    if (!r.success && r.ketenVol) { if (confirm(r.bericht + '\n\nToch tijdelijk vastleggen (je weet dat het contract dan als vast geldt)?')) return vlOpslaan(true); return; }
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); vlNaOpslaan(besluit);
  };
  window.vlWis = async function () {
    if (!confirm('Besluit intrekken? De taak "besluit nodig" komt dan terug.')) return;
    var r = await api('/api/verlenging', { actie: 'wissen', mid: g('vl-mid').value, eindIso: g('vl-eind').value, naam: vlItem.naam });
    toast(r.success ? r.bericht : r.bericht, r.success ? 'ok' : 'err'); if (r.success) vlNaOpslaan('');
  };

  // ---------- Check-in 30/60 dagen (fase 3a) ----------
  var ciData = null, ciMaanden = 6, ciFilter = 'alle';
  window.ciEditor = maakVragenEditor('ci-vragen', true);
  var ciStatus = { wacht: '<span class="badge boat">wacht</span>', ingevuld: '<span class="badge bg">ingevuld</span>', laag: '<span class="badge br">laag · opvolgen</span>', opgevolgd: '<span class="badge bo">laag · opgevolgd</span>' };
  window.laadCheckin = async function (mnd) {
    if (mnd) ciMaanden = mnd;
    g('ci-b6').className = 'btn bsm ' + (ciMaanden === 6 ? 'bp' : 'bd'); g('ci-b24').className = 'btn bsm ' + (ciMaanden === 24 ? 'bp' : 'bd');
    g('ci-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">Laden…</td></tr>';
    var d = await api('/api/checkin-admin?maanden=' + ciMaanden);
    if (!d.success) { g('ci-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    ciData = d;
    g('ci-pauze').style.display = d.actief ? 'none' : '';
    g('ci-status').className = 'badge ' + (d.actief ? 'bg' : 'bo'); g('ci-status').textContent = d.actief ? 'ACTIEF — uitnodigingen gaan automatisch' : 'GEPAUZEERD — er gaat niets uit';
    g('ci-toggle').textContent = d.actief ? 'Pauzeren' : 'Aanzetten'; g('ci-toggle').className = 'btn bsm ' + (d.actief ? 'bd' : 'bp');
    g('ci-grens').textContent = d.laagGrens;
    var k = d.kpi;
    g('ci-kpi').innerHTML = '<div class="card cg"><div class="si sig">✉</div><div><div class="sv">' + k.verstuurd + '</div><div class="sl">Verstuurd (' + ciMaanden + ' mnd)</div></div></div>'
      + '<div class="card cd"><div class="si sid">%</div><div><div class="sv">' + (k.respons == null ? '-' : k.respons + '%') + '</div><div class="sl">Respons (' + k.ingevuld + ' ingevuld)</div></div></div>'
      + '<div class="card ' + (k.gemScore == null ? 'cd' : k.gemScore >= 4 ? 'cg' : k.gemScore >= 3 ? 'cw' : 'cr') + '"><div class="si sid">★</div><div><div class="sv">' + (k.gemScore == null ? '-' : String(k.gemScore).replace('.', ',')) + '</div><div class="sl">Gemiddelde score (1–5)</div></div></div>'
      + '<div class="card ' + (k.laagOpen ? 'cr' : 'cd') + '"><div class="si ' + (k.laagOpen ? 'siw' : 'sid') + '">!</div><div><div class="sv">' + k.laagOpen + '</div><div class="sl">Laag, nog opvolgen (' + k.laag + ' totaal)</div></div></div>';
    ciRender();
    var bar = function (label, n, gem) { var pct = gem == null ? 0 : Math.round((gem - 1) / 4 * 100), kl = gem == null ? '#c9c2bc' : gem >= 4 ? '#009f4b' : gem >= 3 ? '#e8824a' : '#c0392b'; return '<div style="display:flex;gap:12px;align-items:center;padding:5px 0;font-size:.85rem"><span style="min-width:200px;flex:1.2">' + esc(label) + '</span><div style="flex:1;background:#f3eeea;border-radius:3px;height:12px"><div style="width:' + pct + '%;background:' + kl + ';height:12px;border-radius:3px"></div></div><strong style="min-width:76px;text-align:right">' + (gem == null ? '-' : String(gem).replace('.', ',')) + ' <span style="color:#888078;font-weight:400">(' + n + ')</span></strong></div>'; };
    g('ci-pervraag').innerHTML = k.perVraag.length && k.ingevuld ? k.perVraag.map(function (v) { return bar(v.vraag, v.n, v.gem); }).join('') : '<div class="lay-sub">Nog geen ingevulde check-ins.</div>';
    g('ci-perwinkel').innerHTML = k.perWinkel.length ? k.perWinkel.map(function (w) { return bar(w.winkel, w.n, w.gem); }).join('') : '<div class="lay-sub">Nog geen ingevulde check-ins.</div>';
    var kom = d.nu.map(function (x) { return Object.assign({ wanneer: 'vandaag' + (x.zonderEmail ? ' — geen e-mail in Shiftbase' : '') }, x); }).concat(d.komende.map(function (x) { return Object.assign({ wanneer: x.op + ' (over ' + x.over + ' d)' }, x); }));
    g('ci-kcount').textContent = kom.length;
    g('ci-kbody').innerHTML = kom.length ? kom.map(function (x) { return '<tr><td><strong>' + esc(x.naam) + '</strong></td><td>' + esc(x.winkel || '-') + '</td><td>' + esc(x.indienst || '') + '</td><td>Dag ' + x.moment + '</td><td>' + esc(x.wanneer) + '</td><td>' + esc(x.email || '-') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="leeg grijs">Niemand in de komende 14 dagen.</td></tr>';
    ciEditor.zet(d.vragenConfig, d.types); g('ci-vragen-sub').textContent = d.standaard ? 'Standaardlijst (config.js)' : 'Eigen lijst (opgeslagen in het dashboard)';
  };
  function ciRender() {
    var d = ciData; if (!d) return;
    document.querySelectorAll('#ci-filter .tb').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-ci') === ciFilter); });
    var kol = (d.vragenConfig || []).filter(function (v) { return v.type !== 'tekst'; });
    g('ci-head').innerHTML = '<tr><th>Verstuurd</th><th>Naam</th><th>Winkel</th><th>Dag</th><th>Status</th><th>Score</th>' + kol.map(function (v) { return '<th title="' + esc(v.nl) + '">' + esc(v.nl.length > 18 ? v.nl.slice(0, 16) + '…' : v.nl) + '</th>'; }).join('') + '<th>Opmerking / opvolging</th><th>Actie</th></tr>';
    var rijen = d.rijen.filter(function (r) { return ciFilter === 'alle' || r.status === ciFilter; });
    g('ci-count').textContent = rijen.length;
    g('ci-body').innerHTML = rijen.length ? rijen.map(function (r) {
      var a = r.antwoorden || {}, lb = r.labels || {};
      var cellen = kol.map(function (v) { var x = a[v.key]; if (x == null || x === '') return '<td><span class="no-doc">-</span></td>'; if (v.type === 'schaal') return '<td>' + exScore(x) + '</td>'; if (v.type === 'nps') return '<td><span class="badge ' + (x >= 9 ? 'bg' : x >= 7 ? 'bo' : 'br') + '">' + x + '/10</span></td>'; var alarm = (v.opties || []).some(function (o) { return o[0] === x && o[3] === true; }); return '<td>' + (alarm ? '<span class="badge br">' + esc(lb[v.key] || x) + '</span>' : esc(lb[v.key] || x)) + '</td>'; }).join('');
      var opm = (r.opmerking ? '<div>' + esc(r.opmerking) + '</div>' : '') + (r.opvolgNotitie || r.opgevolgd ? '<div class="lay-sub">Opgevolgd ' + esc(r.opgevolgd) + (r.opgevolgdDoor ? ' door ' + esc(r.opgevolgdDoor) : '') + (r.opvolgNotitie ? ': ' + esc(r.opvolgNotitie) : '') + '</div>' : '') + (!r.ingevuld && r.herinnerd ? '<div class="lay-sub">Herinnering ' + esc(r.herinnerd) + '</div>' : '');
      return '<tr><td>' + esc(r.verstuurd) + '</td><td><strong>' + esc(r.naam) + '</strong><div class="lay-sub">' + esc(r.email || '') + '</div></td><td>' + esc(r.winkel || '-') + '</td><td>' + r.moment + '</td><td>' + (ciStatus[r.status] || '') + (r.ingevuld ? '<div class="lay-sub">' + esc(r.ingevuld) + '</div>' : '') + '</td><td>' + (r.score == null ? '<span class="no-doc">-</span>' : exScore(Math.round(r.score))) + '</td>' + cellen + '<td style="max-width:300px;white-space:normal;font-size:.82rem">' + opm + '</td><td>' + (r.status === 'laag' ? '<button class="btn bp bsm" data-ci-op="' + esc(r.id) + '">✓ Opgevolgd</button> ' : '') + dosBtn(r.naam, r.email) + '</td></tr>';
    }).join('') : '<tr><td colspan="' + (8 + kol.length) + '" class="leeg grijs">' + (d.rijen.length ? 'Niets in deze selectie.' : 'Nog geen check-ins verstuurd' + (d.actief ? '.' : ' (gepauzeerd).')) + '</td></tr>';
  }
  document.addEventListener('click', async function (e) {
    var f = e.target.closest && e.target.closest('#ci-filter .tb'); if (f) { ciFilter = f.getAttribute('data-ci'); ciRender(); return; }
    var m = e.target.closest && e.target.closest('#ci-moment .tb'); if (m) { document.querySelectorAll('#ci-moment .tb').forEach(function (x) { x.classList.toggle('sel', x === m); }); return; }
    var b = e.target.closest && e.target.closest('button[data-ci-op]'); if (!b) return;
    var cr = (ciData.rijen || []).find(function (x) { return x.id === b.getAttribute('data-ci-op'); }) || {};
    openGesprek({ persoon: { naam: cr.naam, email: cr.email, winkel: cr.winkel }, soort: 'checkin', checkinId: cr.id, aanleiding: 'Lage check-in dag ' + cr.moment + (cr.laagReden ? ': ' + cr.laagReden : '') + (cr.opmerking ? ' — "' + cr.opmerking + '"' : ''), naOpslaan: function () { laadCheckin(); if (tkData) laadTaken(false); } });
  });
  window.ciToggle = async function () {
    if (!ciData) return; var aan = !ciData.actief;
    if (!confirm(aan ? 'Check-in aanzetten? Vanaf de volgende dagelijkse run krijgen nieuwe medewerkers op dag 30 en 60 automatisch een uitnodiging' + (ciData.nu.length ? ' (vandaag: ' + ciData.nu.length + ')' : '') + '.' : 'Check-in pauzeren? Er gaan dan geen uitnodigingen meer uit en de pagina sluit.')) return;
    var r = await api('/api/checkin-admin', { actie: 'actief', actief: aan });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadCheckin();
  };
  window.ciVoorbeeld = async function (taal) { var r = await api('/api/checkin-admin', { actie: 'voorbeeld', taal: taal }); if (!r.success) { toast(r.bericht, 'err'); return; } window.open(r.link, '_blank'); };
  window.ciVragenOpslaan = async function () { var r = await api('/api/checkin-admin', { actie: 'vragen', vragen: ciEditor.lees() }); if (!r.success) { toast(r.bericht, 'err'); return; } toast(r.bericht, 'ok'); laadCheckin(); };
  window.ciVragenHerstel = async function () { if (!confirm('Eigen vragenlijst weggooien en de standaardlijst terugzetten?')) return; var r = await api('/api/checkin-admin', { actie: 'vragen', herstel: true }); if (!r.success) { toast(r.bericht, 'err'); return; } toast(r.bericht, 'ok'); laadCheckin(); };
  window.ciExport = function () {
    if (!ciData || !ciData.rijen.length) { toast('Geen check-ins om te exporteren', 'err'); return; }
    var vr = ciData.vragenConfig || [], cel = function (v) { v = v == null ? '' : String(v); return '"' + v.replace(/"/g, '""') + '"'; };
    var kop = ['Verstuurd', 'Naam', 'Email', 'Winkel', 'Dag', 'Status', 'Ingevuld', 'Score'].concat(vr.map(function (v) { return v.nl; })).concat(['Opgevolgd', 'Opvolging']);
    var regels = [kop.join(';')].concat(ciData.rijen.map(function (r) { var a = r.antwoorden || {}, lb = r.labels || {}; return [r.verstuurd, r.naam, r.email, r.winkel, r.moment, r.status, r.ingevuld, r.score == null ? '' : String(r.score).replace('.', ',')].concat(vr.map(function (v) { return lb[v.key] || a[v.key]; })).concat([r.opgevolgd, r.opvolgNotitie]).map(cel).join(';'); }));
    var url = URL.createObjectURL(new Blob(['﻿' + regels.join('\r\n')], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'checkins_' + ciMaanden + 'mnd.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  window.openCiModal = function (v) {
    g('ci-naam').value = v ? v.naam || '' : ''; g('ci-email').value = v ? v.email || '' : ''; g('ci-mid').value = v ? v.id || '' : ''; g('ci-zoek').value = ''; g('ci-zoek-res').classList.remove('open');
    document.querySelectorAll('#ci-moment .tb').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-m') === '30'); });
    g('ci-modal').classList.add('open'); if (!v) setTimeout(function () { g('ci-zoek').focus(); }, 60);
  };
  window.closeCiModal = function () { g('ci-modal').classList.remove('open'); };
  g('ci-modal').addEventListener('click', function (e) { if (e.target === this) closeCiModal(); });
  g('ci-zoek').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase(), res = g('ci-zoek-res');
    if (q.length < 2 || !ciData) { res.classList.remove('open'); return; }
    var hits = (ciData.medewerkers || []).filter(function (m) { return m.naam.toLowerCase().indexOf(q) > -1; }).slice(0, 8);
    res.innerHTML = hits.length ? hits.map(function (m) { return '<button type="button" data-id="' + esc(m.id) + '" data-naam="' + esc(m.naam) + '" data-email="' + esc(m.email) + '"><strong>' + esc(m.naam) + '</strong> <span class="lay-sub">' + esc(m.winkel) + ' · in dienst ' + esc(m.indienst) + '</span></button>'; }).join('') : '<button type="button" class="lay-sub">Niet gevonden — vul naam en e-mail handmatig in</button>';
    res.classList.add('open');
    res.querySelectorAll('button[data-id]').forEach(function (z) { z.onclick = function () { g('ci-naam').value = z.getAttribute('data-naam'); g('ci-email').value = z.getAttribute('data-email'); g('ci-mid').value = z.getAttribute('data-id'); res.classList.remove('open'); }; });
  });
  window.ciVerstuur = async function () {
    var p = { actie: 'versturen', naam: g('ci-naam').value.trim(), email: g('ci-email').value.trim(), medewerker_id: g('ci-mid').value, moment: (document.querySelector('#ci-moment .tb.sel') || {}).getAttribute ? document.querySelector('#ci-moment .tb.sel').getAttribute('data-m') : '30' };
    if (!p.naam) { toast('Vul de naam in', 'err'); return; }
    if (!p.email || p.email.indexOf('@') === -1) { toast('Vul een geldig e-mailadres in', 'err'); return; }
    var b = g('ci-sbtn'); b.disabled = true; g('ci-slbl').textContent = 'Versturen…';
    var r = await api('/api/checkin-admin', p);
    b.disabled = false; g('ci-slbl').textContent = 'Verstuur check-in';
    if (r.success) { toast(r.bericht, 'ok'); closeCiModal(); laadCheckin(); } else toast('Fout: ' + r.bericht, 'err');
  };

  // ---------- Ontslag op staande voet (port van OoSV.gs v1.0; knop in de Sommaties-kop) ----------
  window.openOoModal = function (d) {
    ['oo-naam', 'oo-email', 'oo-bv', 'oo-adres', 'oo-const', 'oo-wederhoor', 'oo-gronden', 'oo-zoek'].forEach(function (id) { g(id).value = ''; });
    g('oo-aanhef').value = 'heer/mevrouw';
    g('oo-const').value = nlDatum(new Date().toISOString().substring(0, 10));
    if (d) { g('oo-naam').value = d.naam || ''; g('oo-email').value = d.email || ''; g('oo-bv').value = d.bv || ''; }
    g('oo-zoek-res').classList.remove('open');
    g('oo-modal').classList.add('open');
    if (!d) setTimeout(function () { g('oo-zoek').focus(); }, 60);
  };
  window.closeOoModal = function () { g('oo-modal').classList.remove('open'); };
  g('oo-modal').addEventListener('click', function (e) { if (e.target === this) closeOoModal(); });
  function ooLees() { return { naam: g('oo-naam').value.trim(), email: g('oo-email').value.trim(), aanhef: g('oo-aanhef').value, bv: g('oo-bv').value.trim(), adres: g('oo-adres').value.trim(), datumConstatering: g('oo-const').value.trim(), wederhoor: g('oo-wederhoor').value.trim(), gronden: g('oo-gronden').value.trim() }; }
  function ooCheck(p) { if (!p.naam) return 'Vul de naam in'; if (p.gronden.length < 20) return 'Omschrijf de dringende reden(en) concreet — dit is de juridische kern van de brief'; return ''; }
  window.ooPdf = async function () {
    var p = ooLees(), f = ooCheck(p); if (f) { toast(f, 'err'); return; }
    var b = g('oo-pdfbtn'); b.disabled = true; toast('PDF maken…', 'ok');
    var r = await api('/api/oosv-mail', Object.assign(p, { alleenPdf: true }));
    b.disabled = false;
    if (!r.success) { toast('PDF: ' + r.bericht, 'err'); return; }
    downloadB64(r.pdf, r.bestandsnaam || 'OoSV.pdf');
  };
  window.ooVerstuur = async function () {
    var p = ooLees(), f = ooCheck(p); if (f) { toast(f, 'err'); return; }
    if (!p.email || p.email.indexOf('@') === -1) { toast('Ongeldig e-mailadres', 'err'); return; }
    if (!confirm('ONTSLAG OP STAANDE VOET versturen naar ' + p.naam + ' (' + p.email + ', cc hr@ilovesla.com)?\n\nDit is onomkeerbaar. Zorg dat de brief vandaag ook aangetekend op de post gaat.')) return;
    var b = g('oo-sbtn'); b.disabled = true; g('oo-slbl').textContent = 'PDF maken en versturen…';
    var r = await api('/api/oosv-mail', p);
    b.disabled = false; g('oo-slbl').textContent = 'Verstuur OoSV + brief';
    if (r.success) { toast(r.bericht, 'ok'); closeOoModal(); smData = null; laadSommaties(); laadOverzicht(); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('oo-zoek', 'oo-zoek-res', function (m) {
    if (!m) return;
    g('oo-naam').value = m.naam || ''; g('oo-email').value = m.email || '';
    if (m.winkelBv) g('oo-bv').value = m.winkelBv;
    if (m.adres) g('oo-adres').value = m.adres;
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
  });

  // ---------- Loonheffingskorting (port van Korting.gs v1.5) ----------
  var krtData = null, krtRij = null, krtKeuzeVal = '';
  function krtKeuzeBadge(k) { return '<span class="badge ' + (k === 'Aanzetten' ? 'bg' : k === 'Uitzetten' ? 'bo' : 'boat') + '">' + esc(k || '-') + '</span>'; }
  window.laadKorting = async function () {
    var d = await api('/api/korting');
    if (!d.success) { toast('Korting: ' + d.bericht, 'err'); return; }
    krtData = d.rijen;
    var open = krtData.filter(function (r) { return r.retour !== 'Ja'; }).length, sal = krtData.filter(function (r) { return !!r.salaris; }).length;
    g('krt-tot').textContent = krtData.length; g('krt-open').textContent = open; g('krt-sal').textContent = sal;
    g('krt-count').textContent = krtData.length + ' dossiers';
    if (d.gesynct) toast(d.gesynct + ' formulier(en) retour gekoppeld', 'ok');
    g('krt-body').innerHTML = krtData.map(function (r) {
      return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.email) + '</td><td>' + krtKeuzeBadge(r.keuze) + '</td><td>' + esc(r.ingangsdatum || '-') + '</td><td>' + esc(r.deadline || '-') + '</td><td>' + bSent(r.status) + '</td><td>' + bOk(r.retour) + (r.docUrl ? ' ' + bDoc(r.docUrl, 'Formulier') : '') + '</td><td>' + bH(r.herinnering, r.aantalHer) + '</td><td>' + (r.retour === 'Ja' ? bSal('korting', r) : '<span class="no-doc">-</span>') + '</td><td><div class="vb-knoppen"><button class="btn bd bsm" data-krt-rij="' + r.rij + '" title="Opnieuw versturen (dossier gaat weer open)">Opnieuw</button>' + dosBtn(r.naam, r.email) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="10" class="leeg grijs">Nog geen verzoeken</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-krt-rij]'); if (!b) return;
    if (!krtData) await laadKorting();
    var rij = b.getAttribute('data-krt-rij');
    openKrtModal((krtData || []).find(function (x) { return String(x.rij) === rij; }) || null);
  });
  window.openKrtModal = function (r) {
    krtRij = r && r.rij ? r.rij : null;
    ['krt-naam', 'krt-email', 'krt-ingang', 'krt-deadline', 'krt-zoek'].forEach(function (id) { g(id).value = ''; });
    g('krt-ingang-hint').innerHTML = ''; g('krt-deadline-hint').innerHTML = '';
    if (r) { g('krt-naam').value = r.naam || ''; g('krt-email').value = r.email || ''; g('krt-ingang').value = r.ingangsdatum || ''; g('krt-deadline').value = r.deadline || ''; }
    g('krt-mti').textContent = r ? 'Opnieuw versturen — ' + r.naam : 'Formulier loonheffingskorting versturen';
    zetTaal('krt-taal', r ? r.taal : 'NL');
    krtZetKeuze(r && r.keuze ? r.keuze : 'Wijzigen');
    krtDatumHint('krt-ingang', 'krt-ingang-hint'); krtDatumHint('krt-deadline', 'krt-deadline-hint');
    g('krt-zoek-res').classList.remove('open');
    g('krt-modal').classList.add('open');
    if (!r) setTimeout(function () { g('krt-zoek').focus(); }, 60);
  };
  window.closeKrtModal = function () { g('krt-modal').classList.remove('open'); };
  g('krt-modal').addEventListener('click', function (e) { if (e.target === this) closeKrtModal(); });
  koppelTaal('krt-taal');
  function krtZetKeuze(k) {
    krtKeuzeVal = k;
    g('krt-keuze').querySelectorAll('.tb').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-keuze') === k); });
    var h = g('krt-keuze-hint');
    h.innerHTML = k === 'Aanzetten' ? 'De mail vraagt de medewerker om bij de loonheffingskorting <strong>Ja</strong> aan te kruisen. Let op: de korting mag maar bij één werkgever tegelijk lopen.'
      : k === 'Uitzetten' ? 'De mail vraagt de medewerker om bij de loonheffingskorting <strong>Nee</strong> aan te kruisen. Gebruikelijk bij een tweede baan elders.'
      : 'Neutrale mail: de medewerker kiest zelf ja of nee op het formulier.';
    h.style.display = 'block';
  }
  g('krt-keuze').querySelectorAll('[data-keuze]').forEach(function (b) { b.onclick = function () { krtZetKeuze(b.getAttribute('data-keuze')); }; });
  window.krtDatumHint = function (inId, hintId) {
    var v = g(inId).value.trim(), h = g(hintId);
    if (!v) { h.innerHTML = ''; return; }
    var m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (!m) { h.innerHTML = '<span style="color:#c0392b">Niet herkend - gebruik dd-mm-jjjj</span>'; return; }
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) { h.innerHTML = '<span style="color:#c0392b">Bestaat niet als datum</span>'; return; }
    h.innerHTML = '<span style="color:#006b30">✓ ' + d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>';
  };
  function krtLees() { return { naam: g('krt-naam').value.trim(), email: g('krt-email').value.trim(), keuze: krtKeuzeVal, ingangsdatum: g('krt-ingang').value.trim(), deadline: g('krt-deadline').value.trim(), taal: leesTaal('krt-taal'), rij: krtRij }; }
  window.krtPreview = async function () {
    var p = krtLees(); if (!p.naam) { toast('Vul eerst de naam in', 'err'); return; }
    var r = await api('/api/korting-mail', Object.assign(p, { preview: true }));
    if (!r.success) { toast(r.bericht, 'err'); return; }
    var w = window.open('', '_blank'); if (!w) { toast('Pop-up geblokkeerd', 'err'); return; }
    w.document.write('<title>' + esc(r.subject) + '</title>' + r.html); w.document.close();
  };
  window.krtVerstuur = async function () {
    var p = krtLees();
    if (!p.naam || !p.email || p.email.indexOf('@') === -1) { toast('Vul naam en een geldig e-mailadres in', 'err'); return; }
    if (krtRij && !confirm('Opnieuw versturen naar ' + p.email + '? Het dossier gaat dan weer open (retour/herinneringen worden gewist).')) return;
    var b = g('krt-sbtn'); b.disabled = true; g('krt-slbl').textContent = 'Versturen…';
    var r = await api('/api/korting-mail', p);
    b.disabled = false; g('krt-slbl').textContent = 'Verstuur mail';
    if (r.success) { toast(r.bericht, 'ok'); closeKrtModal(); laadKorting(); if (g('tab-dossier').classList.contains('active') && laatsteDossier) openDossier.apply(null, laatsteDossier); }
    else toast('Fout: ' + r.bericht, 'err');
  };
  koppelSbZoek('krt-zoek', 'krt-zoek-res', function (m) {
    if (!m) return;
    g('krt-naam').value = m.naam || ''; g('krt-email').value = m.email || '';
    if (!m.email) toast('Geen e-mailadres in Shiftbase voor ' + m.naam + ' — vul handmatig in', 'err');
  });

  // ---------- Contracten & starters (port van Contract.gs v3.0) ----------
  var ctrData = null;
  window.laadContract = async function (ververs) {
    g('ctr-body').innerHTML = '<tr><td colspan="7" class="leeg grijs">Starters ophalen uit Shiftbase…</td></tr>';
    var d = await api('/api/contract' + (ververs ? '?ververs=1' : ''));
    if (!d.success) { toast('Contracten: ' + d.bericht, 'err'); g('ctr-body').innerHTML = '<tr><td colspan="7" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    ctrData = d.rows;
    g('ctr-count').textContent = ctrData.length + ' starters';
    g('ctr-info').textContent = 'Startdatum vanaf ' + d.dagenTerug + ' dagen geleden · bijgewerkt ' + d.bijgewerkt + (d.uitCache ? ' (cache, max. 10 min)' : '') + (d.capped ? ' · LET OP: afgekapt op de 40 meest recente starters' : '') + (d.loonBron ? '' : ' · loonheffingsdossier niet bereikbaar');
    g('ctr-body').innerHTML = ctrData.map(function (r) {
      var c = r.contract;
      var ctr = c ? '<span class="badge bg" title="' + esc(c.titel) + ' | in Shiftbase sinds ' + esc(c.ontvangen) + ' | alleen intern, gaat niet mee naar salarisadministratie">✓ in Shiftbase</span> <button class="btn bd bsm" data-ctr-dl="' + esc(c.id) + '" data-naam="' + esc(r.naam) + '" title="Download contract-PDF (intern gebruik)">⬇</button>' : '<span class="badge br">Ontbreekt</span>';
      var via = r.matchVia ? ' title="Gematcht via ' + esc(r.matchVia) + '"' : '';
      var loon = r.loonUrl ? '<span' + via + '>' + bDoc(r.loonUrl, 'Loonheffing') + '</span>' : '<span class="badge br" title="Nog geen formulieren geupload voor deze medewerker">Wacht</span>';
      var ind = r.indienstUrl ? '<span' + via + '>' + bDoc(r.indienstUrl, 'Indienst') + '</span>' : '<span class="badge br">Wacht</span>';
      var sal = r.loonRij && (r.loonUrl || r.indienstUrl) ? bSal('loonheffing', { rij: r.loonRij, naam: r.naam, salaris: r.verzonden }) : '<span class="no-doc">-</span>';
      return '<tr><td><strong>' + esc(r.naam) + '</strong><div class="lay-sub">' + esc(r.email || '-') + '</div></td><td>' + esc(r.startdatum) + '</td><td>' + ctr + '</td><td>' + loon + '</td><td>' + ind + '</td><td>' + sal + '</td><td>' + dosBtn(r.naam, r.email) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="leeg grijs">Geen starters in de laatste ' + d.dagenTerug + ' dagen</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-ctr-dl]'); if (!b || b.disabled) return;
    b.disabled = true; toast('Contract ophalen…', 'ok');
    var r = await api('/api/contract-download?id=' + encodeURIComponent(b.getAttribute('data-ctr-dl')) + '&naam=' + encodeURIComponent(b.getAttribute('data-naam')));
    b.disabled = false;
    if (!r.success) { toast('Contract: ' + r.bericht, 'err'); return; }
    downloadB64(r.base64, r.bestandsnaam);
  });

  // ---------- Vastloners: maandmutaties salaris (port van Vastloners.gs v30.0) ----------
  var vlData = null;
  (function () {
    var mn = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    var nu = new Date(), vm = new Date(nu.getFullYear(), nu.getMonth() - 1, 1), h = '', jh = '';
    for (var i = 0; i < 12; i++) h += '<option value="' + (i + 1) + '">' + mn[i] + '</option>';
    for (var y = nu.getFullYear(); y >= nu.getFullYear() - 2; y--) jh += '<option value="' + y + '">' + y + '</option>';
    g('vl-maand').innerHTML = h; g('vl-jaar').innerHTML = jh; g('vl-maand').value = String(vm.getMonth() + 1); g('vl-jaar').value = String(vm.getFullYear());
  })();
  function vlCel(d, u) { if (!d && !u) return '<span class="no-doc">-</span>'; return '<strong>' + d + '</strong> dag' + (d === 1 ? '' : 'en') + (u ? '<div class="lay-sub">' + u + ' uur</div>' : ''); }
  window.vlLaad = async function () {
    var st = g('vl-status'); st.innerHTML = 'Gegevens ophalen uit Shiftbase…'; g('vl-body').innerHTML = ''; g('vl-kpi').style.display = 'none'; g('vl-waarsch').style.display = 'none';
    var r = await api('/api/vastloners?jaar=' + g('vl-jaar').value + '&maand=' + g('vl-maand').value);
    if (!r.success) { st.innerHTML = '<span style="color:#c0392b">' + esc(r.bericht) + '</span>'; return; }
    vlData = r;
    g('vl-pill').textContent = r.periode.label;
    st.innerHTML = 'Periode <strong>' + esc(r.periode.start) + ' t/m ' + esc(r.periode.eind) + '</strong> · ' + r.aantalVastloners + ' vastloners · opgehaald ' + esc(r.opgehaald);
    var t = r.totalen, kpi = g('vl-kpi');
    kpi.innerHTML = '<div class="card cg"><div class="si sig">🏝</div><div><div class="sv">' + t.verlofDagen + '</div><div class="sl">Vakantiedagen</div></div></div><div class="card cw"><div class="si siw">🤒</div><div><div class="sv">' + t.ziekDagen + '</div><div class="sl">Ziektedagen</div></div></div><div class="card" style="border-top:3px solid #c0392b"><div class="si" style="background:#fdecea">⚠</div><div><div class="sv">' + t.wachtdagen + '</div><div class="sl">Wachtdagen</div></div></div><div class="card cd"><div class="si sid">👤</div><div><div class="sv">' + t.metMutatie + '</div><div class="sl">Met mutatie</div></div></div>';
    kpi.style.display = 'grid';
    var w = g('vl-waarsch');
    if (r.waarschuwingen.length) { w.innerHTML = '<div class="alert geel" style="margin:0"><strong>⚠ Controleren (' + r.waarschuwingen.length + ')</strong><ul style="margin:8px 0 0;padding-left:18px">' + r.waarschuwingen.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; w.style.display = 'block'; }
    var rows = r.regels.filter(function (d) { return d.heeftMutatie; }), geen = r.regels.length - rows.length;
    var html = rows.map(function (d) {
      var zp = d.ziekteperiodes.length ? d.ziekteperiodes.map(function (p) { return esc(p.start) + ' t/m ' + esc(p.eind) + ' (' + p.dagen + 'd' + (p.deelDag ? ', deel van de dag' : '') + ')'; }).join('<br>') : '<span class="no-doc">-</span>';
      var wd = d.wachtdagen.length ? d.wachtdagen.map(function (p) { return '<span class="badge br">' + esc(p.datum) + '</span>' + (p.uren ? '<div class="lay-sub">' + p.uren + ' uur</div>' : ''); }).join(' ') : '<span class="no-doc">-</span>';
      var ov = d.overig.length ? d.overig.map(function (p) { return '<strong>' + esc(p.type) + '</strong> (' + esc(p.start) + ', ' + p.dagen + 'd)' + (p.loon ? '<div class="lay-sub">' + esc(p.loon) + '</div>' : ''); }).join('<br>') : '<span class="no-doc">-</span>';
      return '<tr><td><strong>' + esc(d.naam) + '</strong><div class="lay-sub">' + esc(d.functie) + '</div></td><td><span class="badge boat">' + esc(d.locatie) + '</span></td><td>' + vlCel(d.verlofDagen, d.verlofUren) + '</td><td>' + vlCel(d.ziekDagen, d.ziekUren) + '</td><td style="font-size:.78rem">' + zp + '</td><td>' + wd + '</td><td style="font-size:.78rem">' + ov + '</td></tr>';
    }).join('');
    if (!html) html = '<tr><td colspan="7" style="text-align:center;color:#009f4b;padding:36px;font-size:15px">✓ Geen bijzonderheden deze maand</td></tr>';
    else if (geen > 0) html += '<tr><td colspan="7" style="text-align:center;color:#888078;padding:14px;font-size:12px">' + geen + ' vastloner(s) zonder mutatie deze maand</td></tr>';
    g('vl-body').innerHTML = html;
  };
  window.vlKopieer = function () {
    if (!vlData) { toast('Haal eerst een maand op', 'err'); return; }
    var t = 'Maandmutaties vastloners - ' + vlData.periode.label + '\nPeriode: ' + vlData.periode.start + ' t/m ' + vlData.periode.eind + '\n\n', n = 0;
    vlData.regels.forEach(function (d) {
      if (!d.heeftMutatie) return; n++;
      t += d.naam + ' (' + d.locatie + ')\n';
      if (d.verlofDagen) t += '  - Vakantie: ' + d.verlofDagen + ' dag(en)' + (d.verlofUren ? ' / ' + d.verlofUren + ' uur' : '') + '\n';
      if (d.ziekDagen) t += '  - Ziek: ' + d.ziekDagen + ' dag(en)' + (d.ziekUren ? ' / ' + d.ziekUren + ' uur' : '') + '\n';
      d.ziekteperiodes.forEach(function (p) { t += '      periode ' + p.start + ' t/m ' + p.eind + '\n'; });
      d.wachtdagen.forEach(function (p) { t += '  - WACHTDAG: ' + p.datum + (p.uren ? ' (' + p.uren + ' uur)' : '') + '\n'; });
      d.overig.forEach(function (p) { t += '  - ' + p.type + ': ' + p.start + ' (' + p.dagen + ' dag(en))' + (p.loon ? ' - ' + p.loon : '') + '\n'; });
      t += '\n';
    });
    if (!n) t += 'Geen bijzonderheden deze maand.\n';
    navigator.clipboard.writeText(t).then(function () { toast('Overzicht gekopieerd', 'ok'); }, function () { toast('Kopiëren mislukt', 'err'); });
  };

  // ---------- Vakantieplanner (port van Shiftbase.gs v6: heatmap + stille afwezigen) ----------
  var vakData = null, vakJaar = new Date().getFullYear();
  window.vakJaarWissel = function (d) { laadVakantie(vakJaar + d); };
  window.laadVakantie = async function (jaar) {
    vakJaar = jaar || vakJaar; g('vak-jaar').textContent = vakJaar;
    var c = g('vak-tabel'); c.innerHTML = '<div class="leeg grijs">Vakantiedata ' + vakJaar + ' laden uit Shiftbase…</div>';
    var d = await api('/api/vakantie?jaar=' + vakJaar);
    if (!d.success) { c.innerHTML = '<div class="leeg grijs" style="color:#c0392b">' + esc(d.bericht) + '</div>'; return; }
    vakData = d; renderVakantie(d);
  };
  function renderVakantie(d) {
    var c = g('vak-tabel'); g('vak-upd').textContent = 'Bijgewerkt ' + (d.bijgewerkt || ''); g('vak-jaar').textContent = d.jaar;
    var h = '<table><thead><tr><th></th>'; var i = 0;
    while (i < d.weken.length) { var maand = d.weken[i].maand, span = 1; while (i + span < d.weken.length && d.weken[i + span].maand === maand) span++; h += '<th colspan="' + span + '" style="text-align:center;border-left:2px solid #ede8e4">' + esc(maand) + '</th>'; i += span; }
    h += '</tr><tr><th>Winkel (bezetting)</th>' + d.weken.map(function (w, idx) { return '<th style="text-align:center' + (idx === d.huidigeWeek ? ';background:#009f4b;color:#fff' : '') + '" title="Week ' + w.weeknr + ': ' + esc(w.label) + (idx === d.huidigeWeek ? ' (huidige week)' : '') + '">' + w.weeknr + '</th>'; }).join('') + '</tr></thead><tbody>';
    d.rijen.forEach(function (rij, ri) {
      h += '<tr><td style="white-space:nowrap"><strong>' + esc(rij.naam) + '</strong> <span class="lay-sub" style="display:inline">(' + rij.bezetting + ')</span></td>';
      rij.cellen.forEach(function (cel, idx) {
        var bgTd = idx === d.huidigeWeek ? 'background:#f0f9f4;' : '';
        if (cel.app === 0 && cel.pend === 0 && !cel.stil) { h += '<td style="text-align:center;padding:6px 4px;' + bgTd + '"><span style="color:#ddd">-</span></td>'; return; }
        var stil = cel.stil || 0, vast = cel.app + stil, ratio = rij.bezetting ? vast / rij.bezetting : 0, ratioTot = rij.bezetting ? (vast + cel.pend) / rij.bezetting : 0;
        var cls = ratio >= d.drempelRood ? 'br' : (ratio >= d.drempelOranje || ratioTot >= d.drempelRood) ? 'bo' : 'bg';
        var titel = cel.app + ' vakantie' + (cel.pend ? ' (+' + cel.pend + ' aangevraagd)' : '') + (stil ? ', ' + stil + ' stil' : '') + ' = ' + (vast + cel.pend) + ' totaal afwezig van ' + rij.bezetting;
        h += '<td style="text-align:center;padding:6px 4px;' + bgTd + '"><span class="badge ' + cls + '" style="cursor:pointer" title="' + esc(titel) + '" data-vak-rij="' + ri + '" data-vak-wk="' + idx + '">' + vast + (cel.pend ? '+' + cel.pend : '') + '</span></td>';
      });
      h += '</tr>';
    });
    c.innerHTML = h + '</tbody></table>';
  }
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-vak-rij]'); if (!s || !vakData) return;
    var rij = vakData.rijen[+s.getAttribute('data-vak-rij')], cel = rij.cellen[+s.getAttribute('data-vak-wk')], nm = cel.namen || [], sn = cel.stilNamen || [];
    toast(rij.naam + ': ' + (nm.length ? nm.join(', ') : '(geen vakantie)') + (sn.length ? ' | Stil: ' + sn.join(', ') : ''), 'ok');
  });
  window.laadStil = async function () {
    g('stil-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">Rooster en verlof ophalen…</td></tr>';
    var d = await api('/api/vakantie?stil=1');
    if (!d.success) { g('stil-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    g('stil-pill').textContent = d.lijst.length + ' stil · ' + d.vensterDagen + ' dagen';
    g('stil-body').innerHTML = d.lijst.map(function (p) { return '<tr><td><strong>' + esc(p.naam) + '</strong></td><td>' + esc(p.winkel) + '</td><td>' + esc(p.laatsteDienst || 'geen in ' + d.lookback + ' dagen') + '</td><td>' + (p.dagen === null ? '-' : '<span class="badge br">' + p.dagen + '</span>') + '</td><td>' + esc(p.indienst || '-') + '</td><td>' + dosBtn(p.naam, p.email) + '</td></tr>'; }).join('') || '<tr><td colspan="6" style="text-align:center;color:#009f4b;padding:24px">✓ Geen stille afwezigen gevonden</td></tr>';
  };

  // ---------- Verloopanalyse (port van Verloop.gs v1.3) ----------
  var vrlData = null, vrlMaanden = 12;
  window.laadVerloop = async function (mnd, vers) {
    if (mnd) vrlMaanden = mnd;
    g('vrl-b12').className = 'btn bsm ' + (vrlMaanden === 12 ? 'bp' : 'bd'); g('vrl-b24').className = 'btn bsm ' + (vrlMaanden === 24 ? 'bp' : 'bd');
    g('vrl-kpi').textContent = 'Verloopdata berekenen uit Shiftbase…'; g('vrl-body').innerHTML = '<tr><td colspan="8" class="leeg grijs">Rekenen…</td></tr>';
    var r = await api('/api/verloop?maanden=' + vrlMaanden + (vers ? '&ververs=1' : ''));
    if (!r.success) { g('vrl-kpi').textContent = 'Fout: ' + r.bericht; return; }
    vrlData = r; vrlKpi(); vrlGrafiek(); vrlTabel(); vrlCohort(); vrlRedenen(); vrlExit(); vrlVroeg();
  };
  function vrlKpi() {
    var t = vrlData.totaal, sep = '<span style="color:#e8e2de;margin:0 6px">|</span>';
    g('vrl-kpi').innerHTML = '<span class="lay-sub" style="text-transform:uppercase;letter-spacing:.5px;margin-right:4px">' + esc(vrlData.periode) + '</span><span><strong style="font-size:1.15rem;color:#333d3a">' + (t.verloop === null ? '-' : t.verloop + '%') + '</strong> verloop</span>' + sep + '<span><strong style="font-size:1.05rem">' + t.bestandNu + '</strong> in dienst</span>' + sep
      + '<span title="Bestand aan het begin en het einde van de periode - het verloop% rekent met het gemiddelde hiervan">bestand ' + t.bestandStart + ' → ' + t.bestandEind + ' <span style="color:' + (t.bestandEind < t.bestandStart ? '#9b1c1c' : t.bestandEind > t.bestandStart ? '#006b30' : '#888078') + '">(' + (t.bestandEind - t.bestandStart > 0 ? '+' : '') + (t.bestandEind - t.bestandStart) + ')</span></span>' + sep
      + '<span style="color:#006b30">+' + t.instroom + ' in</span> / <span style="color:#9a4a1a">-' + t.uitstroom + ' uit</span>' + sep + '<span>gem. diensttijd vertrekkers <strong>' + (t.gemDienstMnd === null ? '-' : t.gemDienstMnd + ' mnd') + '</strong></span>'
      + (t.cohort && t.cohort['90'].n ? '<span style="margin-left:auto"><span class="lay-sub" style="text-transform:uppercase;letter-spacing:.5px;margin-right:6px">Uitval nieuwe medewerkers</span><span class="badge bo">30d ' + t.cohort['30'].pct + '% · 60d ' + t.cohort['60'].pct + '% · 90d ' + t.cohort['90'].pct + '%</span></span>' : '');
    g('vrl-periode').textContent = 'Bijgewerkt ' + (vrlData.bijgewerkt || '');
  }
  function vrlGrafiek() {
    var mx = 1; vrlData.totaal.maandIn.forEach(function (v, i) { mx = Math.max(mx, v, vrlData.totaal.maandUit[i]); });
    var h = '<div style="display:flex;align-items:flex-end;gap:8px;height:150px;padding-bottom:6px">';
    vrlData.maanden.forEach(function (m, i) {
      var inH = Math.round(vrlData.totaal.maandIn[i] / mx * 110), uitH = Math.round(vrlData.totaal.maandUit[i] / mx * 110);
      h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end"><div style="display:flex;gap:2px;align-items:flex-end;width:100%;justify-content:center;height:100%"><div title="' + esc(m.label) + ': ' + vrlData.totaal.maandIn[i] + ' instroom" style="width:42%;max-width:22px;background:#009f4b;border-radius:3px 3px 0 0;height:' + Math.max(inH, 2) + 'px"></div><div title="' + esc(m.label) + ': ' + vrlData.totaal.maandUit[i] + ' uitstroom" style="width:42%;max-width:22px;background:#e8824a;border-radius:3px 3px 0 0;height:' + Math.max(uitH, 2) + 'px"></div></div><div style="font-size:10px;color:#888078;white-space:nowrap">' + esc(m.label) + '</div></div>';
    });
    h += '</div><div style="display:flex;gap:16px;font-size:.78rem;color:#888078;margin-top:10px"><span><span style="display:inline-block;width:10px;height:10px;background:#009f4b;border-radius:2px;margin-right:5px"></span>Instroom</span><span><span style="display:inline-block;width:10px;height:10px;background:#e8824a;border-radius:2px;margin-right:5px"></span>Uitstroom</span></div>';
    g('vrl-grafiek').innerHTML = h;
  }
  function vrlBadge(v, gem) { if (v === null) return '<span class="no-doc">te klein</span>'; var cls = gem !== null && v > gem * 1.3 ? 'br' : gem !== null && v > gem * 1.1 ? 'bo' : 'bg'; return '<span class="badge ' + cls + '">' + v + '%</span>'; }
  function vrlTabel() {
    var gem = vrlData.totaal.verloop, t = vrlData.totaal;
    var rij = function (w, tot) { var nk = w.netto > 0 ? '#006b30' : w.netto < 0 ? '#9b1c1c' : '#888078'; return '<tr' + (tot ? ' style="background:#f8f3f0;font-weight:700"' : '') + '><td><strong>' + esc(tot ? 'Organisatie' : w.naam) + '</strong></td><td>' + w.bestandNu + '</td><td style="color:#006b30">+' + w.instroom + '</td><td style="color:#9a4a1a">-' + w.uitstroom + '</td><td style="color:' + nk + ';font-weight:700">' + (w.netto > 0 ? '+' : '') + w.netto + '</td><td>' + (tot ? (w.verloop === null ? '-' : w.verloop + '%') : vrlBadge(w.verloop, gem)) + '</td><td>' + (w.uitstroom ? w.vroeg + ' <span style="color:#888078">(' + w.vroegPct + '%)</span>' : '<span class="no-doc">-</span>') + '</td><td>' + (w.gemDienstMnd === null ? '<span class="no-doc">-</span>' : w.gemDienstMnd + ' mnd') + '</td></tr>'; };
    g('vrl-body').innerHTML = vrlData.winkels.map(function (w) { return rij(w, false); }).join('') + rij(t, true);
  }
  function vrlCohort() {
    var tc = vrlData.totaal.cohort;
    var cel = function (c, gemPct) { if (!c.n) return '<td><span class="no-doc">geen cohort</span></td>'; var cls = gemPct !== null && c.pct > gemPct * 1.3 ? 'br' : gemPct !== null && c.pct > gemPct * 1.1 ? 'bo' : 'bg'; return '<td><span class="badge ' + cls + '">' + c.pct + '%</span> <span style="color:#888078;font-size:.78rem">' + c.uit + '/' + c.n + '</span></td>'; };
    g('vrl-cohort-body').innerHTML = vrlData.winkels.map(function (w) { return '<tr><td><strong>' + esc(w.naam) + '</strong></td>' + cel(w.cohort['30'], tc['30'].pct) + cel(w.cohort['60'], tc['60'].pct) + cel(w.cohort['90'], tc['90'].pct) + '<td style="color:#006b30">+' + w.instroom + '</td></tr>'; }).join('')
      + '<tr style="background:#f8f3f0;font-weight:700"><td><strong>Organisatie</strong></td>' + cel(tc['30'], null) + cel(tc['60'], null) + cel(tc['90'], null) + '<td>+' + vrlData.totaal.instroom + '</td></tr>';
  }
  function vrlRedenen() {
    var d = vrlData.redenen || { totaal: 0, lijst: [], zonder: 0 };
    if (!d.totaal) { g('vrl-reden-sub').textContent = ''; g('vrl-redenen').innerHTML = '<div class="lay-sub">Nog geen ontslagdossiers met einddatum in deze periode. Vanaf nu wordt bij elke ontslagbevestiging/aanzegging een uitstroomreden vastgelegd.</div>'; return; }
    g('vrl-reden-sub').textContent = d.totaal + ' dossiers · ' + d.eigenKeuzePct + '% eigen keuze' + (d.zonder ? ' · ' + d.zonder + ' zonder reden' : '');
    var mx = Math.max.apply(null, d.lijst.map(function (x) { return x.aantal; }).concat([d.zonder, 1]));
    var rij = function (label, n, kleur) { return '<div style="display:flex;gap:12px;align-items:center;padding:5px 0;font-size:.85rem"><span style="min-width:300px">' + esc(label) + '</span><div style="flex:1;background:#f3eeea;border-radius:3px;height:14px"><div style="width:' + Math.round(n / mx * 100) + '%;background:' + kleur + ';height:14px;border-radius:3px"></div></div><strong style="min-width:70px;text-align:right">' + n + ' <span style="color:#888078;font-weight:400">(' + Math.round(n / d.totaal * 100) + '%)</span></strong></div>'; };
    g('vrl-redenen').innerHTML = d.lijst.map(function (x) { return rij(x.reden, x.aantal, /^eigen keuze/i.test(x.reden) ? '#009f4b' : /proeftijd|functioneren|gedrag|staande voet/i.test(x.reden) ? '#c0392b' : '#e8824a'); }).join('') + (d.zonder ? rij('Niet geregistreerd', d.zonder, '#c9c2bc') : '');
  }
  function vrlExit() {
    var d = vrlData.exit || { aantal: 0 };
    if (!d.aantal) { g('vrl-exit-sub').textContent = ''; g('vrl-exit').innerHTML = '<div class="lay-sub">' + (d.fout ? esc(d.fout) + ' (migratie 0009 gedraaid?)' : 'Nog geen ingevulde exit-surveys in deze periode. De link staat in elke ontslagbevestiging, aanzegging en proeftijdbrief (brief + mail).') + '</div>'; return; }
    g('vrl-exit-sub').textContent = d.aantal + ' ingevuld' + (d.respons != null ? ' · respons ' + d.respons + '% van ' + d.uitstroom + ' vertrekkers' : '');
    var kleurNps = d.enps == null ? '#888078' : d.enps >= 20 ? '#006b30' : d.enps >= 0 ? '#9a4a1a' : '#9b1c1c';
    var h = '<div class="stats" style="padding:0 0 12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">'
      + '<div class="card cg"><div class="si sig">★</div><div><div class="sv" style="color:' + kleurNps + '">' + (d.enps == null ? '-' : (d.enps > 0 ? '+' : '') + d.enps) + '</div><div class="sl">eNPS (promotors − criticasters, n=' + d.npsN + ')</div></div></div>'
      + '<div class="card cd"><div class="si sid">∅</div><div><div class="sv">' + (d.npsGem == null ? '-' : d.npsGem) + '</div><div class="sl">Gem. aanbeveling (0–10)</div></div></div></div>';
    var sk = Object.keys(d.schaal || {});
    if (sk.length) h += sk.map(function (k) { var x = d.schaal[k]; var pct = x.gem == null ? 0 : Math.round((x.gem - 1) / 4 * 100); var kl = x.gem == null ? '#c9c2bc' : x.gem >= 4 ? '#009f4b' : x.gem >= 3 ? '#e8824a' : '#c0392b'; return '<div style="display:flex;gap:12px;align-items:center;padding:5px 0;font-size:.85rem"><span style="min-width:300px">' + esc(x.vraag) + '</span><div style="flex:1;background:#f3eeea;border-radius:3px;height:14px"><div style="width:' + pct + '%;background:' + kl + ';height:14px;border-radius:3px"></div></div><strong style="min-width:110px;text-align:right">' + (x.gem == null ? '-' : x.gem + ' / 5') + ' <span style="color:#888078;font-weight:400">(' + x.n + (x.laag ? ', ' + x.laag + ' laag' : '') + ')</span></strong></div>'; }).join('');
    var kz = d.keuze || {};
    Object.keys(kz).forEach(function (k) { var q = kz[k], lijst = Array.isArray(q) ? q : (q.opties || []); if (!lijst.length) return; h += '<div style="margin-top:10px;font-size:.85rem"><span class="lay-sub" style="text-transform:uppercase;letter-spacing:.4px">' + esc(q.vraag || k) + '</span><div style="margin-top:4px">' + lijst.map(function (o) { return '<span class="badge boat" style="margin:0 6px 6px 0">' + esc(o.label) + ' · ' + o.aantal + '</span>'; }).join('') + '</div></div>'; });
    if (d.opmerkingen && d.opmerkingen.length) h += '<div style="margin-top:12px"><span class="lay-sub" style="text-transform:uppercase;letter-spacing:.4px">Opmerkingen</span>' + d.opmerkingen.map(function (o) { return '<div style="padding:8px 0;border-bottom:1px solid #f0ebe7;font-size:.85rem"><span style="color:#888078">' + esc(o.op) + ' · ' + esc(o.winkel || '-') + (o.naam ? ' · ' + esc(o.naam) : ' · anoniem') + (o.nps != null ? ' · ' + o.nps + '/10' : '') + '</span><br>' + esc(o.tekst) + '</div>'; }).join('') + '</div>';
    g('vrl-exit').innerHTML = h;
  }
  function vrlVroeg() {
    var sec = g('vrl-vroeg-sec');
    if (!vrlData.vroegeLijst.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block'; g('vrl-vroeg-dagen').textContent = vrlData.vroegDagen;
    g('vrl-vroeg').innerHTML = vrlData.vroegeLijst.map(function (p) { return '<div style="display:flex;gap:14px;align-items:center;padding:8px 0;border-bottom:1px solid #f0ebe7;font-size:.85rem"><strong style="min-width:230px">' + esc(p.naam) + '</strong><span style="color:#888078;min-width:150px">' + esc(p.winkel) + '</span><span class="badge ' + (p.dagen <= 30 ? 'br' : 'bo') + '" style="margin-left:auto">' + p.dagen + ' dagen in dienst</span></div>'; }).join('');
  }

  // ---------- Toegangslog (port van Toegang.gs: AVG-verantwoording in het dashboard zelf) ----------
  var tgData = null;
  window.laadToegang = async function () {
    g('tg-body').innerHTML = '<tr><td colspan="5" class="leeg grijs">Laden…</td></tr>';
    var d = await api('/api/toegangslog');
    if (!d.success) { g('tg-body').innerHTML = '<tr><td colspan="5" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    tgData = d; var s = d.samenvatting;
    g('tg-kpi').innerHTML = '<div class="card cg"><div class="si sig">👁</div><div><div class="sv">' + s.opvragen + '</div><div class="sl">Opvragen (30 d)</div></div></div><div class="card cd"><div class="si sid">📁</div><div><div class="sv">' + s.inzagen + '</div><div class="sl">Dossiers ingezien</div></div></div><div class="card cw"><div class="si siw">⬇</div><div><div class="sv">' + s.exports + '</div><div class="sl">Exports / documenten</div></div></div><div class="card ' + (s.geweigerd ? 'co' : 'cd') + '"><div class="si ' + (s.geweigerd ? 'sio' : 'sid') + '">🔒</div><div><div class="sv">' + s.geweigerd + '</div><div class="sl">Geweigerde logins</div></div></div>';
    g('tg-accounts').innerHTML = s.accounts.length ? s.accounts.map(function (a) { return '<span class="badge boat" style="margin:0 6px 6px 0">' + esc(a.account) + ' · ' + a.aantal + '</span>'; }).join('') : '<span class="lay-sub">Geen activiteit in de laatste 30 dagen</span>';
    var kleur = function (r) { return r === 'geweigerd' ? 'br' : r === 'login' ? 'bg' : r === 'dossier' || r === 'dossier-pdf' || r === 'export' || r === 'document' ? 'bo' : 'boat'; };
    g('tg-body').innerHTML = d.regels.map(function (r) { return '<tr><td style="white-space:nowrap">' + esc(r.tijd) + '</td><td>' + esc(r.account) + '</td><td><span class="badge ' + kleur(r.resultaat) + '">' + esc(r.resultaat) + '</span></td><td style="font-size:.8rem">' + esc(r.details || '-') + '</td><td class="lay-sub">' + esc(r.ip || '') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="leeg grijs">Nog geen logregels</td></tr>';
    g('tg-mut-body').innerHTML = d.mutaties.map(function (r) { return '<tr><td style="white-space:nowrap">' + esc(r.tijd) + '</td><td>' + esc(r.account) + '</td><td><span class="badge boat">' + esc(r.actie) + '</span></td><td>' + esc(r.bron) + (r.veld ? ' · ' + esc(r.veld) : '') + '</td><td><strong>' + esc(r.naam || '-') + '</strong></td><td style="font-size:.8rem">' + esc(r.details || '') + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="leeg grijs">Nog geen schrijfacties</td></tr>';
  };

  // ---------- Archief herstellen (port van herstelUitArchief, Code.gs v29.5) ----------
  var arData = null, arType = 'loonheffing';
  window.laadArchief = async function (type) {
    if (type) arType = type;
    document.querySelectorAll('#ar-types .tb').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-ar') === arType); });
    g('ar-body').innerHTML = '<tr><td colspan="5" class="leeg grijs">Archief laden…</td></tr>';
    var d = await api('/api/archief?type=' + arType);
    if (!d.success) { g('ar-body').innerHTML = '<tr><td colspan="5" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; return; }
    arData = d; g('ar-count').textContent = d.rijen.length + ' gearchiveerd';
    g('ar-body').innerHTML = d.rijen.map(function (r) { return '<tr><td><strong>' + esc(r.naam) + '</strong></td><td>' + esc(r.gearchiveerd || '-') + '</td><td>' + esc(r.door || '-') + '</td><td style="font-size:.78rem;color:#888078;max-width:520px;white-space:normal">' + esc(r.velden.filter(Boolean).slice(0, 8).join(' · ')) + '</td><td><button class="btn bp bsm" data-ar-herstel="' + r.rij + '" data-naam="' + esc(r.naam) + '">↩ Terugzetten</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="leeg grijs">Geen gearchiveerde rijen in deze sheet</td></tr>';
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-ar-herstel]'); if (!b || b.disabled) return;
    var naam = b.getAttribute('data-naam');
    if (!confirm(naam + ' terugzetten uit het archief? De rij is daarna weer zichtbaar in het dashboard.')) return;
    b.disabled = true; b.textContent = '…';
    var r = await api('/api/archief', { type: arType, rij: parseInt(b.getAttribute('data-ar-herstel'), 10) });
    if (!r.success) { b.disabled = false; b.textContent = '↩ Terugzetten'; toast('Herstel: ' + r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadArchief(); ovData = null; lhData = null; omData = null; smData = null;
  });


  // ---------- Gegevens: Sheets -> Supabase (stap 6) + CSV-export ----------
  var gvData = null;
  function gvRij(t) {
    var opm = (t.koppenAfwijkend && t.koppenAfwijkend.length ? '<span class="badge bo">koppen wijken af</span> ' + esc(t.koppenAfwijkend.join('; ')) + ' ' : '') + esc(t.opmerking || '');
    var db = t.dbNa == null || t.dbNa === t.dbVoor ? String(t.dbVoor) : t.dbVoor + ' → <strong>' + t.dbNa + '</strong>';
    var klopt = t.dbNa != null && t.dbNa === (t.sheetRijen + (t.archiefRijen || 0));
    return '<tr><td><strong>' + esc(t.label) + '</strong><div class="lay-sub">' + esc(t.tabel) + '</div></td><td>' + esc(t.bron) + '</td><td>' + t.sheetRijen + '</td><td>' + (t.archiefRijen || 0) + '</td><td>' + db + (klopt ? ' <span class="badge bg">✓</span>' : '') + '</td><td style="font-size:.78rem;white-space:normal;max-width:420px">' + (opm || '-') + '</td></tr>';
  }
  window.laadGegevens = async function () {
    g('gv-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">Laden…</td></tr>';
    var d = await api('/api/migratie');
    if (!d.success) { g('gv-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">' + esc(d.bericht) + '</td></tr>'; g('gv-bron').textContent = '-'; return; }
    gvData = d;
    var sup = d.bron === 'supabase';
    g('gv-bron').textContent = sup ? 'SUPABASE' : 'GOOGLE SHEETS';
    g('gv-bron').style.background = sup ? '#009f4b' : '#e8824a'; g('gv-bron').style.color = '#fff';
    g('gv-uitleg').innerHTML = sup
      ? '<strong>Het dashboard draait op Supabase.</strong> De Google Sheets worden niet meer gelezen of geschreven; gebruik de export hieronder om gegevens in Excel te bekijken. Importeren is nu geblokkeerd (zou nieuwe data overschrijven).'
      : (d.migratie0006
        ? '<strong>Het dashboard draait nog op Google Sheets.</strong> Stappen: 1) <em>Droogloop</em> — controleer dat de aantallen en koppen kloppen; 2) <em>Importeer</em> — zet alle sheet-tabs (incl. archief en oude Forms-reacties) in Supabase; 3) zet in Netlify <code>DATA_BRON=supabase</code> en deploy opnieuw; 4) maak de sheets alleen-lezen. Terugdraaien = de env var weghalen.'
        : '<strong>Migratie 0006 is nog niet gedraaid.</strong> Voer <code>supabase/migrations/0006_sheets_naar_supabase.sql</code> uit in de SQL-editor van het Supabase-project en ververs daarna.');
    g('gv-droog').disabled = !d.migratie0006 || !d.sheetsBeschikbaar; g('gv-echt').disabled = !d.migratie0006 || !d.sheetsBeschikbaar || sup;
    g('gv-hint').textContent = !d.sheetsBeschikbaar ? 'Geen service account meer in Netlify: de sheets zijn niet bereikbaar (dat is de bedoeling ná de overstap).' : '';
    g('gv-body').innerHTML = (d.tabellen || []).map(function (t) { return '<tr><td><strong>' + esc(t.label) + '</strong><div class="lay-sub">' + esc(t.tabel) + '</div></td><td>-</td><td>-</td><td>-</td><td>' + (t.rijen < 0 ? '?' : t.rijen) + '</td><td>-</td></tr>'; }).join('') || '<tr><td colspan="6" class="leeg grijs">Nog geen tabellen (migratie 0006)</td></tr>';
    g('gv-runs').innerHTML = (d.runs || []).map(function (r) { return '<tr><td style="white-space:nowrap">' + esc(String(r.created_at || '').replace('T', ' ').slice(0, 16)) + '</td><td>' + esc(r.door || '') + '</td><td><span class="badge ' + (r.droog ? 'boat' : 'bg') + '">' + (r.droog ? 'droog' : 'echt') + '</span></td><td>' + esc(r.tabel) + '</td><td>' + r.sheet_rijen + '</td><td>' + r.db_rijen_voor + ' → ' + r.db_rijen_na + '</td><td style="font-size:.78rem;white-space:normal">' + esc(r.opmerking || '') + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="leeg grijs">Nog geen runs</td></tr>';
    gvExportKnoppen();
  };
  function gvExportKnoppen() {
    var T = [['hr_loonheffing', 'Loonheffing'], ['hr_ontslag', 'Ontslag & aanzegging'], ['hr_sommatie', 'Sommaties'], ['hr_onboarding', 'Onboarding'], ['hr_overplaatsing', 'Overplaatsing'], ['hr_brieven', 'Vrije brieven'], ['hr_waarschuwingen', 'Waarschuwingen'], ['hr_beschikbaarheid', 'Beschikbaarheid'], ['hr_korting', 'Loonheffingskorting'], ['hr_notities', 'Notities']];
    g('gv-export').innerHTML = T.map(function (t) { return '<button class="btn bd bsm" data-export="' + t[0] + '">⬇ ' + esc(t[1]) + '</button>'; }).join('') + '<label class="chk" style="margin-left:8px"><input type="checkbox" id="gv-arch"> incl. archief</label>';
  }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-export]'); if (!b || b.disabled) return;
    b.disabled = true; var oud = b.textContent; b.textContent = '…';
    var r = await api('/api/export?tabel=' + b.getAttribute('data-export') + (g('gv-arch') && g('gv-arch').checked ? '&archief=1' : ''));
    b.disabled = false; b.textContent = oud;
    if (!r.success) { toast('Export: ' + r.bericht, 'err'); return; }
    var url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = r.bestandsnaam; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast(r.aantal + ' rijen geëxporteerd', 'ok');
  });
  window.migratieRun = async function (droog) {
    if (!droog && !confirm('Alle sheet-tabs importeren in Supabase? Bestaande rijen met hetzelfde rijnummer worden overschreven. Doe dit alleen vóór de omschakeling (DATA_BRON).')) return;
    g('gv-droog').disabled = g('gv-echt').disabled = true;
    g('gv-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">' + (droog ? 'Droogloop' : 'Import') + ' bezig — alle sheets worden gelezen, dit kan een minuut duren…</td></tr>';
    var r = await api('/api/migratie', { droog: droog ? 1 : 0 });
    g('gv-droog').disabled = g('gv-echt').disabled = false;
    if (!r.success) { toast(r.bericht, 'err'); g('gv-body').innerHTML = '<tr><td colspan="6" class="leeg grijs">' + esc(r.bericht) + '</td></tr>'; return; }
    g('gv-body').innerHTML = r.tabellen.map(gvRij).join('');
    toast((droog ? 'Droogloop klaar: ' : 'Import klaar: ') + r.totaalSheet + ' sheetrijen' + (r.fouten.length ? ', ' + r.fouten.length + ' fout(en)' : ''), r.fouten.length ? 'err' : 'ok');
    var d = await api('/api/migratie'); if (d.success) { gvData = d; g('gv-runs').innerHTML = (d.runs || []).slice(0, 14).map(function (x) { return '<tr><td style="white-space:nowrap">' + esc(String(x.created_at || '').replace('T', ' ').slice(0, 16)) + '</td><td>' + esc(x.door || '') + '</td><td><span class="badge ' + (x.droog ? 'boat' : 'bg') + '">' + (x.droog ? 'droog' : 'echt') + '</span></td><td>' + esc(x.tabel) + '</td><td>' + x.sheet_rijen + '</td><td>' + x.db_rijen_voor + ' → ' + x.db_rijen_na + '</td><td style="font-size:.78rem;white-space:normal">' + esc(x.opmerking || '') + '</td></tr>'; }).join(''); }
  };


  // ======================================================================
  // Fase 1 (v0.13.0): takenlijst, checklists, winkel-filter, compacte rijacties
  // ======================================================================
  function normN(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  // ---------- Takenlijst (Overzicht) ----------
  var tkData = null, tkFilter = 'alle';
  window.laadTaken = async function (live) {
    var el = g('tk-lijst'); if (!el) return;
    el.innerHTML = '<div class="leeg grijs">' + (live ? 'Checks draaien (Shiftbase)… dit duurt even' : 'Taken laden…') + '</div>';
    var d = await api('/api/taken' + (live ? '?live=1' : ''));
    if (!d.success) { el.innerHTML = '<div class="leeg grijs">' + esc(d.bericht) + '</div>'; return; }
    tkData = d; renderTaken();
  };
  function tkKnop(a, t) {
    if (!a) return '';
    var attrs = ' data-tk-actie="' + esc(a.soort) + '" data-tk-naam="' + esc(t.naam || '') + '" data-tk-email="' + esc(t.email || '') + '"';
    if (a.persoon) attrs += ' data-tk-persoon="' + esc(JSON.stringify(a.persoon)) + '"';
    if (a.tab) attrs += ' data-tk-tab="' + esc(a.tab) + '"'; if (a.zoek) attrs += ' data-tk-zoek="' + esc(a.zoek) + '"'; if (a.id) attrs += ' data-tk-id="' + esc(a.id) + '"'; if (a.url) attrs += ' data-tk-url="' + esc(a.url) + '"'; if (a.gs) attrs += ' data-tk-gs="' + esc(a.gs) + '"'; if (a.aanleiding) attrs += ' data-tk-aanleiding="' + esc(a.aanleiding) + '"'; attrs += ' data-tk-sleutel="' + esc(t.sleutel || '') + '"' + (t.winkel ? ' data-tk-winkel="' + esc(t.winkel) + '"' : '');
    return '<button class="btn ' + (a === t.actie ? 'bp' : 'bd') + ' bsm"' + attrs + '>' + esc(a.label) + '</button>';
  }
  // Taak ter plekke weghalen (geen herlaad = geen springend beeld); tellers bijwerken
  function tkWeg(rij, sleutel, verborgen) {
    if (tkData) { var idx = tkData.taken.findIndex(function (x) { return x.sleutel === sleutel; }); if (idx > -1) { tkData.aantallen[tkData.taken[idx].urgentie]--; tkData.taken.splice(idx, 1); if (verborgen) tkData.verborgen = (tkData.verborgen || 0) + 1; } }
      if (rij) { rij.style.transition = 'opacity .25s, max-height .3s'; rij.style.overflow = 'hidden'; rij.style.maxHeight = rij.offsetHeight + 'px'; requestAnimationFrame(function () { rij.style.opacity = '0'; rij.style.maxHeight = '0'; rij.style.paddingTop = '0'; rij.style.paddingBottom = '0'; }); setTimeout(function () { renderTaken(); }, 320); }
  }
  function renderTaken() {
    var d = tkData, el = g('tk-lijst'); if (!d || !el) return;
    var w = winkelFilter();
    var lijst = d.taken.filter(function (t) { return (tkFilter === 'alle' || t.urgentie === tkFilter) && (!w || !t.winkel || normN(t.winkel) === normN(w) || hoortBijWinkel(t.naam, t.email, w)); });
    document.querySelectorAll('#tk-filter .tb').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-tk') === tkFilter); });
    g('tk-count').textContent = d.aantallen.rood + ' nu · ' + d.aantallen.oranje + ' deze week · ' + d.aantallen.grijs + ' info';
    el.innerHTML = lijst.length ? lijst.map(function (t) {
      return '<div class="tk ' + t.urgentie + '"><div class="tk-t"><strong>' + esc(t.titel) + '</strong><span>' + esc(t.sub || '') + '</span></div><div class="tk-a">' + tkKnop(t.actie, t) + tkKnop(t.extra, t) + (t.naam && !(t.actie && t.actie.soort === 'dossier') && !(t.extra && t.extra.soort === 'dossier') ? dosBtn(t.naam, t.email) : '') + (t.afhandelbaar ? (t.afhandelOpties ? '<span class="meer"><button class="btn bd bsm" data-meer="1">✓ Afgehandeld ▾</button><div class="meer-menu">' + t.afhandelOpties.map(function (o) { return '<button class="btn bd bsm" data-tk-af="' + esc(t.sleutel) + '" data-tk-dagen="' + (o.dagen || 7) + '" data-tk-opm="' + esc(o.opmerking || '') + '">' + esc(o.label) + '</button>'; }).join('') + '</div></span>' : '<button class="btn bd bsm" data-tk-af="' + esc(t.sleutel) + '" data-tk-dagen="7" title="Verbergen tot de volgende check (7 dagen)">✓ Afgehandeld</button>') : '') + '<span class="tk-bron">' + esc(t.bron) + (t.stand ? ' · ' + esc(t.stand) : '') + '</span></div></div>';
    }).join('') : '<div class="leeg grijs">✓ Niets te doen' + (tkFilter !== 'alle' || w ? ' in deze selectie' : '') + '</div>';
    g('tk-voet').textContent = (d.live ? 'Verse stand uit de checks. ' : 'Stand van de laatste automatische checks (↻ Verse stand draait ze nu). ') + (d.verborgen ? d.verborgen + ' afgehandeld verborgen. ' : '') + (d.fouten && d.fouten.length ? 'Fouten: ' + d.fouten.join('; ') : '');
  }
  document.addEventListener('click', async function (e) {
    var f = e.target.closest && e.target.closest('#tk-filter .tb'); if (f) { tkFilter = f.getAttribute('data-tk'); renderTaken(); return; }
    var af = e.target.closest && e.target.closest('button[data-tk-af]');
    if (af) {
      af.disabled = true;
      var rij = af.closest('.tk'), sleutel = af.getAttribute('data-tk-af');
      var r = await api('/api/taken', { sleutel: sleutel, dagen: parseInt(af.getAttribute('data-tk-dagen'), 10) || 7, opmerking: af.getAttribute('data-tk-opm') || '' });
      if (!r.success) { af.disabled = false; toast(r.bericht, 'err'); return; }
      toast(r.bericht, 'ok');
      tkWeg(rij, sleutel, true);
      return;
    }
    var gb = e.target.closest && e.target.closest('button[data-tk-actie="checkin-opvolgen"],button[data-tk-actie="gesprek"],button[data-tk-actie="gesprek-vervolg"],button[data-tk-actie="gesprek-af"]');
    if (gb) {
      var gsrt = gb.getAttribute('data-tk-actie'), gid = gb.getAttribute('data-tk-id'), grij = gb.closest('.tk'), gsl = gb.getAttribute('data-tk-sleutel');
      var gp = { naam: gb.getAttribute('data-tk-naam'), email: gb.getAttribute('data-tk-email'), winkel: gb.getAttribute('data-tk-winkel') || '' };
      if (gsrt === 'gesprek-af') {
        var nt = prompt('Vervolg afvinken zonder nieuw gesprek. Reden of notitie (optioneel):', ''); if (nt === null) return;
        var ra = await api('/api/gesprek', { actie: 'vervolg-af', id: gid, notitie: nt });
        if (!ra.success) { toast(ra.bericht, 'err'); return; }
        toast(ra.bericht, 'ok'); tkWeg(grij, gsl, false); if (gsData) laadGesprekken(); return;
      }
      var opts = { persoon: gp, soort: gb.getAttribute('data-tk-gs') || (gsrt === 'checkin-opvolgen' ? 'checkin' : 'overig'), aanleiding: gb.getAttribute('data-tk-aanleiding') || '' };
      if (gsrt === 'checkin-opvolgen') { opts.checkinId = gid; opts.naOpslaan = function () { tkWeg(grij, gsl, false); if (ciData) laadCheckin(); }; }
      else if (gsrt === 'gesprek-vervolg') { opts.vervolgVan = gid; opts.naOpslaan = function () { tkWeg(grij, gsl, false); }; }
      else opts.naOpslaan = async function () { var rt = await api('/api/taken', { sleutel: gsl, dagen: 30, opmerking: 'gesprek vastgelegd' }); if (rt.success) tkWeg(grij, gsl, true); };
      openGesprek(opts); return;
    }
    var b = e.target.closest && e.target.closest('button[data-tk-actie]'); if (!b) return;
    var soort = b.getAttribute('data-tk-actie'), naam = b.getAttribute('data-tk-naam'), email = b.getAttribute('data-tk-email');
    var persoon = b.getAttribute('data-tk-persoon') ? JSON.parse(b.getAttribute('data-tk-persoon')) : { naam: naam, email: email };
    if (soort === 'loonmail') { swT('loonheffing', 'Loonheffingsverklaring'); openLoonMail(persoon); }
    else if (soort === 'ontslagmail') { swT('ontslag', 'Ontslag & aanzegging'); openOntslagMail(persoon); }
    else if (soort === 'verlenging') openVerlenging(persoon, b.closest('.tk'));
    else if (soort === 'korting') { swT('loonheffingskorting', 'Loonheffingskorting'); openKrtModal(persoon); }
    else if (soort === 'sommatie') { swT('sommatie', 'Sommaties'); openSomModal(persoon); }
    else if (soort === 'beschikbaarheid') { swT('beschikbaarheid', 'Beschikbaarheid'); openBkModal(persoon); }
    else if (soort === 'oproep') { swT('oproepaanbod', 'Oproepaanbod'); openOprModal(persoon); }
    else if (soort === 'dossier') openDossier(naam, email);
    else if (soort === 'onboarding') startChecklist('onboarding', naam, email);
    else if (soort === 'checklist') openChecklist(b.getAttribute('data-tk-id'));
    else if (soort === 'tab') { var tab = b.getAttribute('data-tk-tab'); swT(tab, tab); var z = b.getAttribute('data-tk-zoek'); if (z) setTimeout(function () { var inp = document.querySelector('#tab-' + tab + ' input.sb'); if (inp) { inp.value = z; inp.dispatchEvent(new Event('input')); } }, 400); }
    else if (soort === 'link') window.open(b.getAttribute('data-tk-url'), '_blank');
  });

  // ---------- Checklists (dossier + takenlijst) ----------
  window.startChecklist = async function (type, naam, email) {
    var m = medewerkers.find(function (x) { return (email && (x.email || '').toLowerCase() === String(email).toLowerCase()) || normN(x.naam) === normN(naam); });
    var r = await api('/api/checklist', { actie: 'start', type: type, naam: naam, email: email || (m ? m.email : ''), winkel: m ? m.winkelNaam : '', medewerker_id: m ? m.id : '' });
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, r.bestaand ? 'err' : 'ok');
    openDossier(naam, email || (m ? m.email : ''), m ? m.id : undefined);
  };
  window.openChecklist = async function (id) {
    var r = await api('/api/checklist?id=' + encodeURIComponent(id));
    if (!r.success) { toast(r.bericht, 'err'); return; }
    openDossier(r.checklist.naam, r.checklist.email, r.checklist.medewerker_id || undefined);
  };
  function chkHtml(c) {
    var pct = c.totaal ? Math.round(c.klaar / c.totaal * 100) : 0;
    return '<div class="sec-sub">' + (c.type === 'onboarding' ? 'Onboarding' : 'Offboarding') + '-checklist · ' + c.klaar + '/' + c.totaal + (c.afgerond_op ? ' · <span class="badge bg">afgerond</span>' : '') + ' <span style="text-transform:none;font-weight:400;color:#aaa">gestart ' + esc(String(c.gestart_op || '').slice(0, 10)) + ' door ' + esc(c.gestart_door || '') + '</span></div>'
      + '<div class="chk-lijst"><div class="chk-balk"><i style="width:' + pct + '%"></i></div>'
      + c.items.map(function (i) { return '<div class="chk-item' + (i.klaar ? ' klaar' : '') + '"><input type="checkbox" id="chk-' + esc(c.id) + '-' + esc(i.key) + '" data-chk-id="' + esc(c.id) + '" data-chk-key="' + esc(i.key) + '"' + (i.klaar ? ' checked' : '') + '><label for="chk-' + esc(c.id) + '-' + esc(i.key) + '">' + esc(i.label) + '</label>' + (i.klaar ? '<span class="chk-wie">' + esc(i.door || '') + ' · ' + esc(i.op || '') + '</span>' : '') + '</div>'; }).join('')
      + '<div style="margin-top:8px;text-align:right">' + (c.afgerond_op ? '<button class="btn bd bsm" data-chk-actie="heropen" data-chk-id="' + esc(c.id) + '">Heropenen</button>' : '<button class="btn bd bsm" data-chk-actie="afronden" data-chk-id="' + esc(c.id) + '">Afronden</button>') + '</div></div>';
  }
  window.laadChecklistsInDossier = async function (naam, email, id) {
    var el = g('dos-checklists'); if (!el) return;
    var r = await api('/api/checklist?naam=' + encodeURIComponent(naam || '') + '&email=' + encodeURIComponent(email || '') + (id ? '&id=' + encodeURIComponent(id) : ''));
    var lijst = r.success ? r.checklists : [];
    var open = lijst.filter(function (c) { return !c.afgerond_op; }), dicht = lijst.filter(function (c) { return c.afgerond_op; });
    var knoppen = '<div style="padding:10px 24px;display:flex;gap:8px;flex-wrap:wrap">' + (open.some(function (c) { return c.type === 'onboarding'; }) ? '' : '<button class="btn bd bsm" onclick="startChecklist(\'onboarding\',' + JSON.stringify(naam) + ',' + JSON.stringify(email || '') + ')">+ Onboarding starten</button>') + (open.some(function (c) { return c.type === 'offboarding'; }) ? '' : '<button class="btn bd bsm" onclick="startChecklist(\'offboarding\',' + JSON.stringify(naam) + ',' + JSON.stringify(email || '') + ')">+ Offboarding starten</button>') + (!r.success ? '<span class="lay-sub">' + esc(r.bericht) + '</span>' : '') + '</div>';
    el.innerHTML = open.map(chkHtml).join('') + knoppen + (dicht.length ? '<details style="padding:0 24px 12px"><summary class="lay-sub" style="cursor:pointer">' + dicht.length + ' afgeronde checklist(s)</summary>' + dicht.map(chkHtml).join('') + '</details>' : '');
  };
  document.addEventListener('change', async function (e) {
    var cb = e.target; if (!cb.matches || !cb.matches('input[data-chk-id]')) return;
    cb.disabled = true;
    var r = await api('/api/checklist', { actie: 'vink', id: cb.getAttribute('data-chk-id'), key: cb.getAttribute('data-chk-key'), klaar: cb.checked });
    cb.disabled = false;
    if (!r.success) { cb.checked = !cb.checked; toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadChecklistsInDossier(laatsteDossier[0], laatsteDossier[1], laatsteDossier[2]); if (tkData) laadTaken(false);
  });
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('button[data-chk-actie]'); if (!b) return;
    b.disabled = true; var r = await api('/api/checklist', { actie: b.getAttribute('data-chk-actie'), id: b.getAttribute('data-chk-id') }); b.disabled = false;
    if (!r.success) { toast(r.bericht, 'err'); return; }
    toast(r.bericht, 'ok'); laadChecklistsInDossier(laatsteDossier[0], laatsteDossier[1], laatsteDossier[2]);
  });

  // ---------- Winkel-filter (header): alle tabellen + takenlijst ----------
  function winkelFilter() { var s = g('winkel-filter'); return s ? s.value : ''; }
  var persoonIndex = null; // email -> winkel, normnaam -> winkel, id -> winkel
  function bouwPersoonIndex() {
    persoonIndex = { email: {}, naam: {}, id: {} };
    medewerkers.forEach(function (m) { var w = m.winkelNaam || ''; if (m.email) persoonIndex.email[m.email.toLowerCase()] = w; persoonIndex.naam[normN(m.naam)] = w; persoonIndex.id[m.id] = w; });
  }
  function hoortBijWinkel(naam, email, w) {
    if (!persoonIndex) bouwPersoonIndex();
    var pw = (email && persoonIndex.email[String(email).toLowerCase()]) || persoonIndex.naam[normN(naam)];
    return pw ? normN(pw) === normN(w) : false; // onbekend bij Shiftbase -> niet tonen onder een winkelfilter
  }
  window.vulWinkelFilter = function () {
    var s = g('winkel-filter'); if (!s || !medewerkers.length) return;
    var winkels = {}; medewerkers.forEach(function (m) { if (m.winkelNaam) winkels[m.winkelNaam] = (winkels[m.winkelNaam] || 0) + 1; });
    var huidig = s.value;
    s.innerHTML = '<option value="">Alle winkels</option>' + Object.keys(winkels).sort(function (a, b) { return a.localeCompare(b, 'nl'); }).map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + ' (' + winkels[w] + ')</option>'; }).join('');
    s.value = huidig; s.style.display = ''; persoonIndex = null;
    try { var bewaard = localStorage.getItem('hr-winkel'); if (bewaard && !huidig && Array.prototype.some.call(s.options, function (o) { return o.value === bewaard; })) { s.value = bewaard; } } catch (err) { /* noop */ }
    pasWinkelFilterToe();
  };
  function pasWinkelFilterToe(tbody) {
    var w = winkelFilter(), s = g('winkel-filter'); if (s) s.classList.toggle('actief', !!w);
    var tbodies = tbody ? [tbody] : Array.prototype.slice.call(document.querySelectorAll('.tc .tw table tbody'));
    tbodies.forEach(function (tb) {
      if (!tb.closest('.tc .tw')) return; // alleen tabellen in tabs (niet in modals)
      if (tb.id === 'dos-lijst' || tb.id === 'tg-body' || tb.id === 'tg-mut-body' || tb.id === 'gv-body' || tb.id === 'gv-runs') return; // eigen filters / geen personen
      Array.prototype.forEach.call(tb.rows, function (tr) {
        if (!w) { tr.classList.remove('wf-verborgen'); return; }
        if (tr.cells.length < 2 || tr.querySelector('.leeg')) return;
        var tekst = tr.textContent || '', em = (tekst.match(/[\w.+-]+@[\w.-]+\.\w+/) || [''])[0];
        var sterk = tr.querySelector('td strong'), naam = sterk ? sterk.textContent : (tr.cells[0] ? tr.cells[0].textContent : '');
        tr.classList.toggle('wf-verborgen', !hoortBijWinkel(naam, em, w));
      });
    });
    if (tkData) renderTaken();
  }
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'winkel-filter') { try { localStorage.setItem('hr-winkel', e.target.value); } catch (err) { /* noop */ } pasWinkelFilterToe(); } });

  // ---------- Compacte rijacties: eerste knop blijft, de rest in een ⋯-menu ----------
  function compactActies(tbody) {
    if (!tbody || tbody.id === 'dos-lijst') return;
    Array.prototype.forEach.call(tbody.rows, function (tr) {
      Array.prototype.forEach.call(tr.cells, function (td) {
        if (td.querySelector('.meer')) return;
        var knoppen = Array.prototype.filter.call(td.children, function (c) { return c.tagName === 'BUTTON' || (c.tagName === 'A' && c.classList.contains('btn')); });
        if (knoppen.length < 3) return;
        var rest = knoppen.slice(1), wrap = document.createElement('span'), menu = document.createElement('div'), knop = document.createElement('button');
        wrap.className = 'meer'; menu.className = 'meer-menu'; knop.className = 'btn bd bsm'; knop.textContent = '⋯'; knop.title = rest.length + ' meer acties'; knop.setAttribute('data-meer', '1');
        rest.forEach(function (k) { menu.appendChild(k); });
        wrap.appendChild(knop); wrap.appendChild(menu); td.appendChild(wrap);
      });
    });
  }
  document.addEventListener('click', function (e) {
    var k = e.target.closest && e.target.closest('button[data-meer]');
    document.querySelectorAll('.meer.open').forEach(function (m) { if (!k || m !== k.parentNode) m.classList.remove('open'); });
    if (k) { k.parentNode.classList.toggle('open'); e.stopPropagation(); }
  });
  // Na elke (her)render van een tabel: compacte acties + winkelfilter
  (function () {
    var obs = new MutationObserver(function (muts) { muts.forEach(function (m) { if (m.target && m.target.tagName === 'TBODY') { compactActies(m.target); pasWinkelFilterToe(m.target); } }); });
    document.querySelectorAll('tbody').forEach(function (tb) { obs.observe(tb, { childList: true }); });
  })();

  // ---------- Medewerkers koppelen (Beheer → Gegevens) ----------
  window.koppelMedewerkers = async function () {
    var b = g('gv-koppel'); b.disabled = true; b.textContent = 'Koppelen…';
    var r = await api('/api/koppel', {});
    b.disabled = false; b.textContent = '⇄ Medewerkers koppelen';
    if (!r.success) { toast(r.bericht, 'err'); return; }
    var fouten = Object.keys(r.perTabel || {}).filter(function (k) { return typeof r.perTabel[k] === 'string'; });
    if (fouten.length) { toast('Koppelen mislukt: ' + r.perTabel[fouten[0]] + (/medewerker_id/.test(r.perTabel[fouten[0]]) ? ' — migratie 0007 nog niet gedraaid?' : ''), 'err'); return; }
    toast(r.gekoppeld + ' rijen gekoppeld aan ' + r.medewerkers + ' medewerkers' + (r.gekoppeld === 0 ? ' (alle rijen waren al gekoppeld of matchen niet op e-mail/naam)' : ''), 'ok');
  };

  // ---------- Sorteren (port van SorteerUI.gs, uitgebreid) ----------
  // 1) Klik op een kolomkop in elke tabel sorteert die kolom (datums dd-mm-jjjj, getallen, tekst).
  // 2) Knop "⇅ Sorteer op datum" (loonheffing/ontslag) wisselt nieuw→oud / oud→nieuw / uit op de beste datumkolom
  //    en blijft staan na verversen/zoeken (srtHerpas wordt na elke render aangeroepen).
  var SRT_RE = /(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/;
  var srtStaat = {}; // tbodyId -> { col, dir } (dir -1 = nieuw→oud, 1 = oud→nieuw)
  function srtWaarde(td) {
    var t = (td.textContent || '').trim(), m = t.match(SRT_RE);
    if (m) return { k: 'd', v: new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() };
    var n = parseFloat(t.replace(',', '.')); if (t && !isNaN(n) && /^[-+]?[\d.,]+%?$/.test(t)) return { k: 'n', v: n };
    return { k: 't', v: t.toLowerCase() };
  }
  function srtRows(tbody) { return Array.prototype.slice.call(tbody.querySelectorAll(':scope > tr')).filter(function (r) { return r.children.length > 1; }); }
  function srtIsDatumKol(tbody, i) { var rows = srtRows(tbody), hit = 0, seen = 0; for (var r = 0; r < rows.length && seen < 12; r++) { var c = rows[r].children[i]; if (!c) continue; seen++; if (SRT_RE.test(c.textContent || '')) hit++; } return seen > 0 && hit >= Math.ceil(seen * 0.4); }
  // Voorkeurskolom: verzend/verstuurd > datum > deadline/ingang (zoals srtDefaultCol in Apps Script)
  function srtDefaultKol(table) {
    var ths = table.querySelectorAll('thead th'), tbody = table.querySelector('tbody'), best = -1, bs = 0;
    ths.forEach(function (th, i) { var t = (th.textContent || '').toLowerCase(), sc = 0; if (/verzend|verzonden|verstuurd/.test(t)) sc = 3; else if (t.indexOf('datum') > -1) sc = 2; else if (/deadline|ingang/.test(t)) sc = 1; if (sc > bs && srtIsDatumKol(tbody, i)) { bs = sc; best = i; } });
    if (best < 0) for (var j = 0; j < ths.length; j++) if (srtIsDatumKol(tbody, j)) { best = j; break; }
    return best;
  }
  function srtSorteer(table, idx, dir) {
    var tbody = table.querySelector('tbody'); if (!tbody) return;
    var rows = srtRows(tbody); if (rows.length < 2) return;
    rows.map(function (r, i) { var c = r.children[idx]; return { r: r, i: i, w: c ? srtWaarde(c) : { k: 't', v: '' } }; })
      .sort(function (a, b) {
        var al = a.w.k === 't' && !a.w.v, bl = b.w.k === 't' && !b.w.v; if (al && bl) return a.i - b.i; if (al) return 1; if (bl) return -1; // leeg onderaan
        if (a.w.k !== b.w.k) return a.w.k < b.w.k ? -1 : 1; var d = a.w.v < b.w.v ? -1 : a.w.v > b.w.v ? 1 : a.i - b.i; return dir === -1 ? -d : d; })
      .forEach(function (x) { tbody.appendChild(x.r); });
    table.querySelectorAll('thead th').forEach(function (x, i) { x.textContent = x.textContent.replace(/ [▲▼]$/, ''); x.removeAttribute('data-srt'); if (i === idx) { x.textContent += dir === -1 ? ' ▼' : ' ▲'; x.setAttribute('data-srt', dir === -1 ? 'desc' : 'asc'); } });
  }
  // Sortering opnieuw toepassen na een render (laadLoonheffing / laadOntslag roepen dit aan)
  function srtHerpas(tbodyId) {
    var st = srtStaat[tbodyId], tbody = g(tbodyId); if (!tbody) return;
    var table = tbody.closest('table'), btn = document.querySelector('[data-srt-knop="' + tbodyId + '"]');
    if (st && st.col >= 0) srtSorteer(table, st.col, st.dir);
    if (btn) { btn.className = 'btn bsm ' + (st && st.col >= 0 ? 'bp' : 'bd'); btn.textContent = !st || st.col < 0 ? '⇅ Sorteer op datum' : st.dir === -1 ? '↓ Nieuw → oud' : '↑ Oud → nieuw'; }
  }
  window.srtKnop = function (tbodyId) {
    var tbody = g(tbodyId), table = tbody.closest('table'), st = srtStaat[tbodyId];
    if (!st || st.col < 0) { var col = srtDefaultKol(table); if (col < 0) { toast('Geen datumkolom gevonden', 'err'); return; } srtStaat[tbodyId] = { col: col, dir: -1 }; }
    else if (st.dir === -1) st.dir = 1;
    else { srtStaat[tbodyId] = { col: -1 }; table.querySelectorAll('thead th').forEach(function (x) { x.textContent = x.textContent.replace(/ [▲▼]$/, ''); x.removeAttribute('data-srt'); }); }
    if (srtStaat[tbodyId].col < 0) { toast('Sortering uit — ververs (↻) voor de oorspronkelijke volgorde', 'ok'); }
    srtHerpas(tbodyId);
  };
  document.addEventListener('click', function (e) {
    var th = e.target.closest && e.target.closest('.tw table thead th'); if (!th || e.target.closest('button,input,a')) return;
    var table = th.closest('table'), tbody = table.querySelector('tbody'); if (!tbody) return;
    var idx = Array.prototype.indexOf.call(th.parentNode.children, th), dir = th.getAttribute('data-srt') === 'desc' ? 1 : -1;
    if (tbody.id && srtStaat[tbody.id] !== undefined || document.querySelector('[data-srt-knop="' + tbody.id + '"]')) srtStaat[tbody.id] = { col: idx, dir: dir };
    srtSorteer(table, idx, dir);
    if (tbody.id) srtHerpas(tbody.id);
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

  // ---------- Fase 4a: Training & certificaten (SLA Academy, alleen lezen) ----------
  var trData = null;
  var AC_CERT = { geldig: ['geldig', 'bg'], verloopt_binnenkort: ['verloopt binnenkort', 'bo'], verlopen: ['verlopen', 'br'], bezig: ['bezig', 'boat'], nooit: ['nog niet gedaan', 'boat'], geen_inhoud: ['-', 'boat'] };
  var AC_AFT = { afgetekend: 'bg', open: 'boat', te_laat: 'br', niet_geslaagd: 'br', verlopen: 'bo' };
  function acCertBadge(c) { var s = AC_CERT[c.status] || [c.status, 'boat']; return '<span class="badge ' + s[1] + '" title="' + esc(c.titel) + '">' + esc(c.titel.replace(/ \/ .*$/, '')) + ': ' + s[0] + (c.geldigTot && c.status !== 'nooit' ? ' t/m ' + esc(c.geldigTot) : '') + '</span>'; }
  function acKaart(a, fout) {
    var h = '<div class="sec"><div class="sh"><div class="st">Training &amp; certificaten <span class="lay-sub" style="color:rgba(255,255,255,.6);margin-left:6px">SLA Academy</span></div></div><div style="padding:10px 24px 14px;font-size:.86rem">';
    if (!a) return h + '<div class="leeg grijs" style="padding:4px 0">' + esc(fout || 'Niet gevonden in Academy (andere naam of e-mail?).') + '</div></div></div>';
    h += '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px"><span><b>Laatst ingelogd:</b> ' + (a.laatstIngelogd ? esc(a.laatstIngelogd) : '<span class="badge ' + (a.nooitIngelogd ? 'br' : 'boat') + '">nog nooit</span>') + '</span>'
      + (a.trainingen ? '<span><b>Trainingen af:</b> ' + a.trainingen.af + ' van ' + a.trainingen.totaal + '</span>' : '')
      + (a.welkom && a.welkom.totaal ? '<span><b>Welkomstcollectie:</b> <span class="badge ' + (a.welkomAf ? 'bg' : a.welkomTelt ? 'br' : 'boat') + '">' + a.welkom.af + '/' + a.welkom.totaal + '</span></span>' : '') + '</div>';
    if (a.welkom && a.welkom.open && a.welkom.open.length) h += '<div class="lay-sub" style="margin-bottom:8px">Nog open: ' + esc(a.welkom.open.join(', ')) + '</div>';
    if ((a.certificaten || []).length) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + a.certificaten.map(acCertBadge).join('') + '</div>';
    if ((a.aftekenen || []).length) h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + a.aftekenen.map(function (x) { return '<span class="badge ' + (AC_AFT[x.status] || 'boat') + '">Aftekenen ' + esc(x.observatie) + ': ' + esc(x.statusLabel) + (x.op ? ' · ' + esc(x.op) : x.deadline ? ' · deadline ' + esc(x.deadline) : '') + '</span>'; }).join('') + '</div>';
    return h + '</div></div>';
  }
  window.laadTraining = async function (ververs) {
    g('tr-fout').style.display = 'none';
    try {
      var d = await api('/api/academy' + (ververs ? '?ververs=1' : ''));
      trData = d; trRender();
    } catch (e) { g('tr-fout').textContent = e.message; g('tr-fout').style.display = ''; g('tr-wbody').innerHTML = '<tr><td colspan="8" class="leeg grijs">Geen gegevens.</td></tr>'; g('tr-sbody').innerHTML = ''; g('tr-mbody').innerHTML = ''; }
  };
  function trPct(v, norm) { if (v == null) return '<span class="grijs">-</span>'; var k = v >= norm ? 'bg' : v >= norm - 15 ? 'bo' : 'br'; return '<span class="badge ' + k + '">' + v + '%</span>'; }
  window.trRender = function () {
    var d = trData; if (!d) return;
    g('tr-stand').textContent = 'stand Academy ' + (d.stand ? new Date(d.stand).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
    var rij = function (w, tot) { return '<tr' + (tot ? ' style="font-weight:700;background:#f8f3f0"' : '') + '><td>' + (tot ? esc(w.winkel) : '<a href="#" data-tr-winkel="' + esc(w.winkel) + '">' + esc(w.winkel) + '</a>') + '</td><td>' + w.medewerkers + '</td><td>' + trPct(w.ingelogdPct, 90) + (w.nooitIngelogd ? ' <span class="lay-sub">' + w.nooitIngelogd + ' nooit</span>' : '') + '</td><td>' + trPct(w.welkomPct, 90) + ' <span class="lay-sub">n=' + w.welkomTelt + '</span></td><td>' + trPct(w.certPct, 90) + ' <span class="lay-sub">n=' + w.certTelt + '</span></td><td>' + (w.verlopen ? '<span class="badge br">' + w.verlopen + '</span>' : '0') + '</td><td>' + (w.aftekenProbleem ? '<span class="badge bo">' + w.aftekenProbleem + '</span>' : '0') + (w.aftekenOpen ? ' <span class="lay-sub">' + w.aftekenOpen + ' open</span>' : '') + '</td></tr>'; };
    g('tr-wbody').innerHTML = d.winkels.map(function (w) { return rij(w); }).join('') + rij(d.totaal, true);
    var URG = { rood: 'br', oranje: 'bo', grijs: 'boat' };
    g('tr-scount').textContent = d.signalen.length;
    g('tr-sbody').innerHTML = d.signalen.length ? d.signalen.map(function (s) { return '<tr><td><span class="badge ' + URG[s.urgentie] + '">' + esc(s.urgentie) + '</span></td><td style="white-space:normal"><strong>' + esc(s.titel) + '</strong><div class="lay-sub">' + esc(s.sub) + '</div></td><td>' + esc(s.winkel || '-') + '</td><td>' + (s.naam ? dosBtn(s.naam, s.email) : '') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="leeg grijs">Geen signalen — iedereen is bij.</td></tr>';
    var f = g('tr-ffilter').value, ms = d.medewerkers.filter(function (m) { return !f || (f === 'cert' && m.certTelt && !m.certOk) || (f === 'welkom' && m.welkomTelt && !m.welkomAf) || (f === 'nooit' && !m.laatstIngelogd) || (f === 'aftekenen' && m.aftekenen.some(function (a) { return a.status !== 'afgetekend'; })); });
    g('tr-mcount').textContent = ms.length;
    g('tr-mbody').innerHTML = ms.length ? ms.map(function (m) { return '<tr><td><strong>' + esc(m.naam) + '</strong>' + (m.gekoppeld ? '' : ' <span class="badge boat" title="Niet gevonden in Shiftbase">?</span>') + '</td><td>' + esc(m.winkel || '-') + '</td><td>' + esc(m.rol || '') + '</td><td>' + esc(m.startNL) + '</td><td>' + (m.laatstIngelogd ? esc(m.laatstIngelogd) : '<span class="badge ' + (m.nooitIngelogd ? 'br' : 'boat') + '">nooit</span>') + '</td><td>' + (m.welkom && m.welkom.totaal ? '<span class="badge ' + (m.welkomAf ? 'bg' : m.welkomTelt ? 'br' : 'boat') + '">' + m.welkom.af + '/' + m.welkom.totaal + '</span>' : '-') + '</td><td style="white-space:normal">' + (m.certificaten || []).map(acCertBadge).join(' ') + '</td><td>' + dosBtn(m.naam, m.email) + '</td></tr>'; }).join('') : '<tr><td colspan="8" class="leeg grijs">Niemand in deze selectie.</td></tr>';
    g('tr-ongekoppeld').textContent = d.ongekoppeld && d.ongekoppeld.length ? d.ongekoppeld.length + ' Academy-account(s) niet gevonden in Shiftbase: ' + d.ongekoppeld.slice(0, 10).join(', ') + (d.ongekoppeld.length > 10 ? ' …' : '') : '';
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-tr-winkel]'); if (!a) return; e.preventDefault();
    var inp = document.querySelector('#tab-training input.sb'); inp.value = a.getAttribute('data-tr-winkel'); inp.dispatchEvent(new Event('input'));
  });
  window.trExport = function () {
    if (!trData) return; var rows = [['Naam', 'Winkel', 'Rol', 'In dienst', 'Laatst ingelogd', 'Welkom af', 'Welkom totaal', 'Certificaten', 'Aftekenen']];
    trData.medewerkers.forEach(function (m) { rows.push([m.naam, m.winkel, m.rol, m.startNL, m.laatstIngelogd || 'nooit', m.welkom ? m.welkom.af : '', m.welkom ? m.welkom.totaal : '', (m.certificaten || []).map(function (c) { return c.titel + ': ' + c.status + (c.geldigTot ? ' t/m ' + c.geldigTot : ''); }).join(' | '), (m.aftekenen || []).map(function (x) { return x.observatie + ': ' + x.statusLabel; }).join(' | ')]); });
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'training-academy.csv'; a.click();
  };
})();
