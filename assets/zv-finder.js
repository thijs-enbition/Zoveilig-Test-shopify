/*
  zv-finder.js — Zo Veilig Keuzehulp (the conversion engine).
  Ported 1:1 from the design's finder/data.js: the 4 questions, the package META,
  the path descriptions, and the exact route() logic that maps answers to a
  recommended package plus two alternatives and a personalised reason.

  Progressive enhancement: it takes over the static Q1 card in [data-zv-finder-app]
  and drives the full flow (question -> question -> result). Fires the finder_*
  measurement events via window.ZVMeasurement.

  Prices are never hardcoded here: they come from the finder_key -> product map the
  theme injects (Shopify Products are the single source of truth for price/SKU).
  A package with no purchasable product shows 'Prijs volgt'. The result CTA links to
  the package and, when available, adds it to the cart.
*/
(function (window, document) {
  'use strict';

  var META = {
    secure: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Alert', platform: 'NAMI Alarm15', h1: 'Slim alarm dat u zelf in de gaten houdt.', sub: 'NAMI Alarm15 · Alarm Pod, SensePlug, PIR, deursensor en codepaneel · geen meldkamer of camera' },
    guard: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Protect', platform: 'Climax · incl. meldkamer', popular: true, h1: 'Alarm met 24/7 meldkamer die meekijkt.', sub: 'Climax · hub, codepaneel, rookmelder, PIR en deurcontact · incl. meldkamer, camera optioneel' },
    secure_plus: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Vista', platform: 'Alarm.com · incl. camera', h1: 'Complete beveiliging met meldkamer én camera.', sub: 'Alarm.com · hub, binnencamera, buitencamera en videodeurbel · incl. meldkamer en camera' },
    aware: { seg: 'B', segLabel: 'Langer Thuis', name: 'Inzicht', platform: 'NAMI aiAware', h1: 'Weet dat de dag normaal en veilig is begonnen.', sub: 'NAMI aiAware · 3 Wi-Fi sensing plugs + 1 deursensor · geen meldkamer' },
    aware_plus: { seg: 'B', segLabel: 'Langer Thuis', name: 'Zeker', platform: 'NAMI aiCare', popular: true, h1: 'Zie subtiele veranderingen voordat het misgaat.', sub: 'NAMI aiCare · 3 Wi-Fi activity sensoren (~100 m²), deursensor per toegang en 2 PIR · geen meldkamer' },
    care: { seg: 'B', segLabel: 'Langer Thuis', name: 'Beschermd', platform: 'Climax', h1: 'Complete bescherming met 24/7 meldkamer.', sub: 'Climax · centrale, magneetcontacten, PIR, paniekknoppen en rookmelders · incl. meldkamer' },
    liogo_solo: { seg: 'C', segLabel: 'Veilig Onderweg', name: 'Paniek Meldkamer', platform: 'Indigo', h1: 'Eén druk verbindt u met de meldkamer.', sub: 'Prijs en specs volgen' },
    liogo_guard: { seg: 'C', segLabel: 'Veilig Onderweg', name: 'Zorgmeldkamer', platform: 'Indigo', h1: '24/7 zorgprofessionals regelen opvolging.', sub: 'Prijs en specs volgen' }
  };

  var LINE = {
    'Langer Thuis': 'Zelfstandig thuis blijven wonen, met een oogje in het zeil wanneer dat nodig is. Slimme sensoren, geen camera waar dat niet hoeft.',
    'Mijn Thuis': 'Uw woning beschermd tegen inbraak, brand en onraad, met een melding zodra er iets gebeurt.',
    'Veilig Onderweg': 'Persoonlijke veiligheid, ook buitenshuis en onderweg, met hulp op één druk op de knop.'
  };

  // Constant reassurance bullets on the recommended-package card (1:1 with the design).
  var TRUST = ['Securitas Preferred Partner', 'NL meldkamer 24/7', 'Lokaal team in Almere'];

  var QUESTIONS = [
    { id: 'q1', title: 'Voor wie zoekt u ondersteuning?', help: 'Zo stemmen we het advies af op de juiste persoon.', options: [
      { id: 'mezelf', label: 'Voor mezelf' }, { id: 'ouder', label: 'Voor mijn ouder(s)' }, { id: 'partner', label: 'Voor mijn partner' }, { id: 'familie', label: 'Voor een ander familielid' }, { id: 'zorg', label: 'Voor iemand voor wie ik zorg' } ] },
    { id: 'q2', title: 'Wat is op dit moment de situatie?', help: 'Er is geen goed of fout. Het helpt ons alleen om richting te bepalen.', options: [
      { id: 'full', label: 'Volledig zelfstandig' }, { id: 'most', label: 'Grotendeels zelfstandig' }, { id: 'start', label: 'Begint wat meer ondersteuning nodig te hebben' }, { id: 'care', label: 'Ontvangt al zorg' } ] },
    { id: 'q3', title: 'Waar maakt u zich het meeste zorgen over?', help: 'Kies wat op dit moment het zwaarst weegt.', options: [
      { id: 'vallen', label: 'Vallen' }, { id: 'alleen', label: 'Alleen wonen' }, { id: 'dwalen', label: 'Dwalen of dementie' }, { id: 'routines', label: 'Routines vergeten' }, { id: 'inbraak', label: 'Inbraak of woningbeveiliging' }, { id: 'checken', label: 'Even kunnen checken hoe het gaat' }, { id: 'gerust', label: 'Een gerust gevoel voor de familie' } ] },
    { id: 'q4', title: 'Hoeveel wilt u dat wij voor u opvangen?', help: 'Van zelf op de hoogte blijven tot volledige opvolging door professionals.', options: [
      { id: 'zelf', label: 'U blijft zelf op de hoogte met meldingen' }, { id: 'meldkamer', label: 'Een 24/7 meldkamer die meekijkt' }, { id: 'max', label: 'Volledige ondersteuning, ook fysieke opvolging' } ] }
  ];

  // Exact routing from the design.
  function route(a) {
    var primary, pool;
    var onderweg = a.q3 === 'vallen' && (a.q1 === 'mezelf' || a.q1 === 'partner') && (a.q2 === 'full' || a.q2 === 'most');
    if (a.q3 === 'inbraak') {
      pool = ['secure', 'guard', 'secure_plus'];
      primary = (a.q4 === 'meldkamer' || a.q4 === 'max') ? 'guard' : 'secure';
    } else if (onderweg) {
      pool = ['liogo_solo', 'liogo_guard'];
      primary = (a.q4 === 'max') ? 'liogo_guard' : 'liogo_solo';
    } else {
      pool = ['aware', 'aware_plus', 'care'];
      if (a.q4 === 'max' || a.q4 === 'meldkamer' || a.q2 === 'care' || a.q3 === 'dwalen') primary = 'care';
      else if (a.q2 === 'full' && a.q4 === 'zelf') primary = 'aware';
      else primary = 'aware_plus';
    }
    var alts = pool.filter(function (k) { return k !== primary; }).slice(0, 2);
    var whoTxt = { mezelf: 'uzelf', ouder: 'uw ouder(s)', partner: 'uw partner', familie: 'een familielid', zorg: 'iemand voor wie u zorgt' };
    var sitTxt = { full: 'die volledig zelfstandig is', most: 'die grotendeels zelfstandig is', start: 'die net wat meer ondersteuning nodig heeft', care: 'die al zorg ontvangt' };
    var conTxt = { vallen: 'vallen', alleen: 'alleen wonen', dwalen: 'dwalen of dementie', routines: 'het vergeten van routines', inbraak: 'inbraak en woningbeveiliging', checken: 'even kunnen checken hoe het gaat', gerust: 'een gerust gevoel voor de familie' };
    var reason = 'U zoekt ondersteuning voor ' + whoTxt[a.q1] + ' ' + sitTxt[a.q2] + ', met als grootste zorg ' + conTxt[a.q3] + '. Daarom is dit het pad dat logisch is voor uw situatie.';
    return { primary: primary, alts: alts, reason: reason };
  }

  var ZV = window.ZVMeasurement || {};
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function personIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  // Format cents as a Dutch euro string at runtime (no literal price in source).
  function money(cents) {
    var e = Math.floor(cents / 100), c = cents % 100;
    return '€' + e + ',' + (c < 10 ? '0' : '') + c;
  }

  // finder_key -> { url, variantId, available, priceCents } from the theme (real products).
  function productMap() {
    var node = document.querySelector('[data-zv-finder-products]');
    if (!node) return {};
    try { return JSON.parse(node.textContent || '{}'); } catch (e) { return {}; }
  }

  function initApp(root) {
    if (root.__zvFinder) return;
    root.__zvFinder = true;
    var answers = {};
    var step = 0;
    var started = false;
    var resultUrl = root.getAttribute('data-result-url') || '/pages/oplossingen';
    var products = productMap();

    // Tell the Lio guide which mood to show, mirroring the design's lio-stage model:
    // home (fresh start) -> product (answering) -> recommend (result) -> purchase (CTA).
    function emitLioStage() {
      var stage = 'product';
      if (step >= QUESTIONS.length) stage = 'recommend';
      else if (step === 0 && Object.keys(answers).length === 0) stage = 'home';
      window.dispatchEvent(new CustomEvent('lio-stage', { detail: stage }));
    }

    function render() {
      emitLioStage();
      if (step < QUESTIONS.length) renderQuestion();
      else renderResult();
    }

    function renderQuestion() {
      var q = QUESTIONS[step];
      var pct = Math.round((step / QUESTIONS.length) * 100) + 1;
      var opts = q.options.map(function (o) {
        return '<li><button type="button" class="kh-opt" data-opt="' + o.id + '">' +
          '<span class="kh-ic">' + personIcon() + '</span>' +
          '<span class="kh-label">' + esc(o.label) + '</span>' +
          '<span class="kh-radio" aria-hidden="true"></span></button></li>';
      }).join('');
      root.innerHTML =
        '<div class="kh-head"><span class="kh-brand"><span class="kh-dot"></span>Zo Veilig Keuzehulp</span>' +
        '<span class="kh-lead">In ' + QUESTIONS.length + ' korte vragen naar het juiste pad</span>' +
        '<div class="kh-progress"><span style="width:' + pct + '%"></span></div></div>' +
        '<div class="kh-body">' +
        (step > 0 ? '<button type="button" class="kh-back" data-back>&larr; Terug</button>' : '') +
        '<span class="kh-step">Vraag ' + (step + 1) + ' · Stap ' + (step + 1) + ' van ' + QUESTIONS.length + '</span>' +
        '<h3>' + esc(q.title) + '</h3><p class="kh-qsub">' + esc(q.help) + '</p>' +
        '<ul class="kh-opts">' + opts + '</ul></div>' +
        '<div class="kh-foot">Kies een antwoord om verder te gaan</div>';
    }

    // Decorative product badge (viewBox 132, red disc behind the icon) from zv-product-icons.js.
    function badgeHtml(key) { return (window.ZVP && window.ZVP.badge) ? window.ZVP.badge(key) : ''; }
    // Price is data-driven: from the Shopify product map (finder_key -> product), never hardcoded.
    function priceLine(key) {
      var prod = products[key];
      if (prod && prod.priceCents) return money(prod.priceCents) + '<span>/mnd</span>';
      return 'Prijs volgt';
    }
    // One package line: badge + supplier (platform) + name + price. mini = alternative variant.
    function plHtml(key, mini) {
      var m = META[key];
      return '<div class="pl' + (mini ? ' mini' : '') + '">' +
        '<span class="pl-badge">' + badgeHtml(key) + '</span>' +
        '<div class="pl-tx">' +
          '<div class="pl-plat">' + esc(m.platform || m.segLabel) + (m.popular ? '<span class="pl-pop">Meest gekozen</span>' : '') + '</div>' +
          '<div class="pl-name">' + esc(m.name) + '</div>' +
          '<div class="pl-price">' + priceLine(key) + '</div>' +
        '</div></div>';
    }

    function renderResult() {
      var r = route(answers);
      var m = META[r.primary];
      if (ZV.push) ZV.push('finder_complete', { recommended_pakket: r.primary, segment: m.seg });
      var prod = products[r.primary];
      // Deep-link to the Oplossingen page and open THIS package's "Meer informatie" modal
      // (interlink by finder_key; the Oplossingen JS switches to the right tab + opens the modal).
      function pkgUrl(fk) {
        var base = resultUrl || '/pages/oplossingen';
        return base + (base.indexOf('?') > -1 ? '&' : '?') + 'pakket=' + encodeURIComponent(fk);
      }
      var detailUrl = pkgUrl(r.primary);

      var altsHtml = r.alts.map(function (k) {
        var altUrl = pkgUrl(k);
        return '<a class="alt" href="' + esc(altUrl) + '" data-pkg="' + k + '">' +
          plHtml(k, true) +
          '<div class="alt-sub">' + esc(META[k].sub) + '</div>' +
          '<svg class="alt-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' +
          '</a>';
      }).join('');
      var trust = TRUST.map(function (t) { return '<span><i></i>' + esc(t) + '</span>'; }).join('');
      var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';

      root.innerHTML =
        '<div class="kh-head"><span class="kh-brand"><span class="kh-dot"></span>Zo Veilig Keuzehulp</span>' +
        '<span class="kh-lead">In ' + QUESTIONS.length + ' korte vragen naar het juiste pad</span>' +
        '<div class="kh-progress"><span style="width:100%"></span></div></div>' +
        '<div class="kh-body kh-result">' +
          '<div class="res-top"><div class="res-eyebrow">Voor uw situatie</div><span class="res-seg">Aanbevolen pad</span></div>' +
          '<div class="res-pathway"><span class="rp-line">' + esc(m.segLabel) + '</span>' +
            (LINE[m.segLabel] ? '<p class="rp-desc">' + esc(LINE[m.segLabel]) + '</p>' : '') +
            '<p class="rp-reason">' + esc(r.reason) + '</p></div>' +
          '<div class="res-substep">Binnen dit pad raden wij aan</div>' +
          '<div class="res-card">' +
            plHtml(r.primary, false) +
            '<p class="res-h1">' + esc(m.h1) + '</p>' +
            '<div class="res-trust">' + trust + '</div>' +
            '<div class="res-cta-row">' +
              '<a class="btn-gold" href="' + esc(detailUrl) + '" data-pkg="' + r.primary + '">Bekijk dit pakket' + arrow + '</a>' +
              (altsHtml ? '<button type="button" class="btn-ghost kh-alts-toggle" aria-expanded="false" aria-controls="kh-alts-panel">Bekijk alternatieven</button>' : '') +
          '</div></div>' +
          (altsHtml ? '<div class="res-alts" id="kh-alts-panel" hidden><div class="res-alts-h">Ook passend bij uw antwoorden</div>' + altsHtml + '</div>' : '') +
          '<button type="button" class="res-restart" data-restart>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/></svg>Opnieuw beginnen</button>' +
        '</div>';
    }

    root.addEventListener('click', function (e) {
      var opt = e.target.closest && e.target.closest('[data-opt]');
      if (opt) {
        if (!started) { started = true; if (ZV.push) ZV.push('finder_start', {}); }
        answers[QUESTIONS[step].id] = opt.getAttribute('data-opt');
        if (ZV.push) ZV.push('finder_answer', { question_num: step + 1, answer_value: opt.getAttribute('data-opt') });
        step++;
        render();
        return;
      }
      var toggle = e.target.closest && e.target.closest('.kh-alts-toggle');
      if (toggle) {
        var panel = root.querySelector('.res-alts');
        if (panel) {
          var opening = panel.hasAttribute('hidden');
          if (opening) { panel.removeAttribute('hidden'); } else { panel.setAttribute('hidden', ''); }
          toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
          toggle.textContent = opening ? 'Verberg alternatieven' : 'Bekijk alternatieven';
        }
        return;
      }
      var view = e.target.closest && e.target.closest('.res-cta-row a[data-pkg]');
      if (view) { window.dispatchEvent(new CustomEvent('lio-stage', { detail: 'purchase' })); }
      if (e.target.closest && e.target.closest('[data-back]')) { if (step > 0) step--; render(); return; }
      if (e.target.closest && e.target.closest('[data-restart]')) {
        answers = {}; step = 0; started = false;
        if (ZV.push) ZV.push('finder_restart', {});
        render();
        return;
      }
    });

    render();
  }

  function ready() {
    var apps = document.querySelectorAll('[data-zv-finder-app]');
    for (var i = 0; i < apps.length; i++) initApp(apps[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window, document);
