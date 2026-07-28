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
  function pkgCardHtml(key, primary, products) {
    var p = META[key];
    var prod = products && products[key];
    var priceHtml = (prod && prod.priceCents) ? '<b>' + money(prod.priceCents) + '</b>/mnd' : 'Prijs volgt';
    var cls = 'kh-pkg' + (primary ? ' is-primary' : '');
    return '<a class="' + cls + '" href="#" data-pkg="' + key + '">' +
      (primary && p.popular ? '<span class="kh-pkg-flag">Meest gekozen</span>' : '') +
      '<span class="kh-pkg-seg">' + esc(p.segLabel) + '</span>' +
      '<span class="kh-pkg-name">' + esc(p.name) + '</span>' +
      '<span class="kh-pkg-hook">' + esc(p.h1) + '</span>' +
      '<span class="kh-pkg-price">' + priceHtml + '</span>' +
      '</a>';
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

    function renderResult() {
      var r = route(answers);
      var p = META[r.primary];
      if (ZV.push) ZV.push('finder_result_view', { recommended_pakket: r.primary, segment: p.seg });
      var altsHtml = r.alts.map(function (k) { return pkgCardHtml(k, false, products); }).join('');
      var prod = products[r.primary];
      var detailUrl = (prod && prod.url) || resultUrl;
      var cta = '<a class="btn btn--gold" href="' + esc(detailUrl) + '" data-pkg="' + r.primary + '">Bekijk dit pakket</a>';
      if (prod && prod.available && prod.variantId) {
        cta += '<button type="button" class="btn btn--indigo kh-add" data-variant="' + esc(prod.variantId) + '" data-pkg="' + r.primary + '">In winkelwagen</button>';
      }
      root.innerHTML =
        '<div class="kh-head"><span class="kh-brand"><span class="kh-dot"></span>Uw persoonlijke advies</span>' +
        '<span class="kh-lead">' + esc(p.segLabel) + '</span>' +
        '<div class="kh-progress"><span style="width:100%"></span></div></div>' +
        '<div class="kh-body">' +
        '<p class="kh-reason">' + esc(r.reason) + '</p>' +
        '<p class="kh-line">' + esc(LINE[p.segLabel] || '') + '</p>' +
        pkgCardHtml(r.primary, true, products) +
        (altsHtml ? '<div class="kh-alts-h">Ook interessant</div><div class="kh-alts">' + altsHtml + '</div>' : '') +
        '<div class="kh-result-cta">' + cta +
        '<button type="button" class="kh-restart" data-restart>Opnieuw beginnen</button></div>' +
        '</div>';
    }

    // Add-to-cart from the finder result: real Shopify cart, add_to_cart on confirm.
    function addToCart(btn) {
      var variantId = btn.getAttribute('data-variant');
      var pkg = btn.getAttribute('data-pkg');
      if (!variantId) return;
      window.dispatchEvent(new CustomEvent('lio-stage', { detail: 'purchase' }));
      btn.disabled = true;
      btn.textContent = 'Bezig...';
      window.fetch('/cart/add.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
      }).then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (line) {
          if (ZV.addToCart) ZV.addToCart({ item_id: (line && line.sku) || pkg, item_name: (META[pkg] || {}).name, item_brand: 'Zo Veilig', price: (line && line.price) ? line.price / 100 : undefined, quantity: 1 }, { cta_location: 'keuzehulp_result' });
          document.dispatchEvent(new CustomEvent('zv:cart:added'));
          window.location.href = '/cart';
        })
        .catch(function () { btn.disabled = false; btn.textContent = 'In winkelwagen'; });
    }

    root.addEventListener('click', function (e) {
      var opt = e.target.closest && e.target.closest('[data-opt]');
      if (opt) {
        if (!started) { started = true; if (ZV.push) ZV.push('finder_start', {}); }
        answers[QUESTIONS[step].id] = opt.getAttribute('data-opt');
        if (ZV.push) ZV.push('finder_question_answer', { question_num: step + 1, answer_value: opt.getAttribute('data-opt') });
        step++;
        render();
        return;
      }
      var add = e.target.closest && e.target.closest('.kh-add');
      if (add) { addToCart(add); return; }
      var view = e.target.closest && e.target.closest('.kh-result-cta a[data-pkg]');
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
