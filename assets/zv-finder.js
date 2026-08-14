/*
  zv-finder.js — Zo Veilig Keuzehulp (the conversion engine).
  Ported 1:1 from the design source of truth: finder/data.js + finder/selector.jsx
  + finder/answer-icons.js.

  The flow is a supportive 3-question conversation (zekerheid · afwijking · situatie).
  Each answer points to a PATH (Langer Thuis / Mijn Thuis / Veilig Onderweg); a
  weighted score (q1 counts double) picks the winning path, then the default package
  within that path plus its alternatives. Formal address ('u'). Ties are handled.

  Progressive enhancement: it takes over the static Q1 card in [data-zv-finder-app]
  and drives the full flow (question -> question -> result). Fires the finder_*
  measurement events via window.ZVMeasurement and lio-stage events for the Lio guide.

  Prices are never hardcoded here: they come from the finder_key -> product map the
  theme injects (Shopify Products are the single source of truth for price/SKU).
  A package with no purchasable product shows 'Prijs volgt'. The result CTA deep-links
  to the Oplossingen page and opens that package's "Meer informatie".
*/
(function (window, document) {
  'use strict';

  var META = {
    // ── MIJN THUIS (huis) ──
    secure: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Alert', platform: 'NAMI Alarm15', h1: 'Slim alarm dat u zelf in de gaten houdt.', sub: 'NAMI Alarm15 · Alarm Pod, SensePlug, PIR, deursensor en codepaneel · geen meldkamer of camera' },
    guard: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Protect', platform: 'Climax · incl. meldkamer', popular: true, h1: 'Alarm met 24/7 meldkamer die meekijkt.', sub: 'Climax · hub, codepaneel, rookmelder, PIR en deurcontact · incl. meldkamer, camera optioneel' },
    secure_plus: { seg: 'A', segLabel: 'Mijn Thuis', name: 'Vista', platform: 'Alarm.com · incl. camera', h1: 'Complete beveiliging met meldkamer én camera.', sub: 'Alarm.com · hub, binnencamera, buitencamera en videodeurbel · incl. meldkamer en camera' },
    // ── LANGER THUIS (dierbare) ──
    aware: { seg: 'B', segLabel: 'Langer Thuis', name: 'Inzicht', platform: 'NAMI aiAware', h1: 'Weet dat de dag normaal en veilig is begonnen.', sub: 'NAMI aiAware · 3 Wi-Fi sensing plugs + 1 deursensor · geen meldkamer' },
    aware_plus: { seg: 'B', segLabel: 'Langer Thuis', name: 'Zeker', platform: 'NAMI aiCare', popular: true, h1: 'Zie subtiele veranderingen voordat het misgaat.', sub: 'NAMI aiCare · 3 Wi-Fi activity sensoren (~100 m²), deursensor per toegang en 2 PIR · geen meldkamer' },
    care: { seg: 'B', segLabel: 'Langer Thuis', name: 'Beschermd', platform: 'Climax', h1: 'Complete bescherming met 24/7 meldkamer.', sub: 'Climax · centrale, magneetcontacten, PIR, paniekknoppen en rookmelders · incl. meldkamer' },
    // ── VEILIG ONDERWEG (onderweg) · prijzen volgen ──
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

  // Answer glyphs (viewBox 48), 1:1 with finder/answer-icons.js. currentColor -> .kh-ic indigo.
  var GLYPH = {
    huis: '<path d="M9 23 L24 11 L39 23"/><path d="M13 21 V37 H35 V21"/><path d="M24 24 L30 26 V31 C30 35 24 37 24 37 C24 37 18 35 18 31 V26 Z"/>',
    dierbare: '<circle cx="17" cy="17" r="4.4"/><path d="M9 36 V32 a8 8 0 0 1 16 0 V36"/><circle cx="33" cy="20" r="3.8"/><path d="M27 36 V33 a6.5 6.5 0 0 1 13 0 V36"/><path d="M31 14 q2.6 -3 5.2 0 q2.6 -3 5.2 0 q0 4 -5.2 7.2 q-5.2 -3.2 -5.2 -7.2 Z"/>',
    onderweg: '<circle cx="20" cy="11" r="3.6"/><path d="M20 15 V26 M20 19 L13 23 M20 19 L27 22 M20 26 L15 37 M20 26 L25 37"/><path d="M33 27 A8 8 0 0 1 33 41"/><path d="M37 23 A14 14 0 0 1 37 45"/>'
  };
  function icon(key) {
    return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (GLYPH[key] || '') + '</svg>';
  }

  // Zekerheid-quiz: 3 korte vragen, elk antwoord wijst naar één pad. Vraag 1 telt dubbel.
  var QUESTIONS = [
    { id: 'q1', vraag: 'Vraag 1', title: 'Waar wilt u vooral meer zekerheid over?', options: [
      { id: 'ritme', label: 'Dat alles thuis volgens het normale ritme verloopt', icon: 'dierbare', route: 'Langer Thuis' },
      { id: 'bescherm', label: 'Bescherming tegen inbraak, brand of gevaar in mijn woning', icon: 'huis', route: 'Mijn Thuis' },
      { id: 'onderwegk', label: 'Snel hulp kunnen inschakelen, thuis én onderweg', icon: 'onderweg', route: 'Veilig Onderweg' } ] },
    { id: 'q2', vraag: 'Vraag 2', title: 'Wat wilt u dat er gebeurt als er iets afwijkt?', options: [
      { id: 'signaal', label: 'Ik of mijn familie ontvangt een signaal in de app', icon: 'dierbare', route: 'Langer Thuis' },
      { id: 'waarschuwt', label: 'Mijn woning waarschuwt direct bij inbraak, brand of gevaar', icon: 'huis', route: 'Mijn Thuis' },
      { id: 'knop', label: 'Ik kan met één druk op de knop hulp inschakelen', icon: 'onderweg', route: 'Veilig Onderweg' } ] },
    { id: 'q3', vraag: 'Vraag 3', title: 'Welke situatie herkent u het meest?', options: [
      { id: 'naaste', label: 'Een naaste woont zelfstandig en ik wil weten dat alles goed gaat', icon: 'dierbare', route: 'Langer Thuis' },
      { id: 'woning', label: 'Ik wil mijn woning beschermen wanneer ik thuis of weg ben', icon: 'huis', route: 'Mijn Thuis' },
      { id: 'alleen', label: 'Ik wil mij veilig voelen wanneer ik alleen of onderweg ben', icon: 'onderweg', route: 'Veilig Onderweg' } ] }
  ];

  var ROUTE_WEIGHT = { q1: 2, q2: 1, q3: 1 };
  var ROUTE_DEFAULT_PRODUCT = { 'Langer Thuis': 'aware_plus', 'Mijn Thuis': 'guard', 'Veilig Onderweg': 'liogo_solo' };
  var ROUTE_POOL = { 'Langer Thuis': ['aware', 'aware_plus', 'care'], 'Mijn Thuis': ['secure', 'guard', 'secure_plus'], 'Veilig Onderweg': ['liogo_solo', 'liogo_guard'] };
  var ROUTE_REASON = {
    'Langer Thuis': 'U zoekt vooral rust en inzicht in het dagelijkse leefpatroon.',
    'Mijn Thuis': 'U zoekt vooral bescherming voor uw woning tegen inbraak, brand en gevaar.',
    'Veilig Onderweg': 'U wilt snel hulp kunnen inschakelen wanneer u alleen of onderweg bent.'
  };
  var ROUTE_HEAD = {
    'Langer Thuis': 'Langer Thuis past waarschijnlijk het beste bij u',
    'Mijn Thuis': 'Mijn Thuis past waarschijnlijk het beste bij u',
    'Veilig Onderweg': 'Veilig Onderweg past waarschijnlijk het beste bij u'
  };

  // Exact weighted routing from finder/data.js.
  function route(a) {
    var scores = { 'Langer Thuis': 0, 'Mijn Thuis': 0, 'Veilig Onderweg': 0 };
    QUESTIONS.forEach(function (q) {
      var opt = q.options.filter(function (o) { return o.id === a[q.id]; })[0];
      if (opt) scores[opt.route] += ROUTE_WEIGHT[q.id];
    });
    var vals = Object.keys(scores).map(function (k) { return scores[k]; });
    var max = Math.max.apply(null, vals);
    var winners = Object.keys(scores).filter(function (k) { return scores[k] === max; });
    var seg = winners[0];
    var primary = ROUTE_DEFAULT_PRODUCT[seg];
    var pool = ROUTE_POOL[seg];
    var alts = pool.filter(function (k) { return k !== primary; });
    var tied = winners.length > 1 ? winners : null;
    var headline = tied
      ? winners.join(' of ') + ' passen waarschijnlijk allebei bij u'
      : ROUTE_HEAD[seg];
    var reason = tied
      ? winners.map(function (w) { return ROUTE_REASON[w]; }).join(' ')
      : ROUTE_REASON[seg];
    return { primary: primary, alts: alts, reason: reason, headline: headline, tied: tied, segLabel: seg };
  }

  var ZV = window.ZVMeasurement || {};
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

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

    // Lio mood mirrors the funnel phase: home -> product -> recommend -> purchase.
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
      var pct = Math.round((step / QUESTIONS.length) * 100);
      var opts = q.options.map(function (o) {
        return '<li><button type="button" class="kh-opt" data-opt="' + o.id + '">' +
          '<span class="kh-ic">' + icon(o.icon) + '</span>' +
          '<span class="kh-label">' + esc(o.label) + '</span>' +
          '<span class="kh-radio" aria-hidden="true"></span></button></li>';
      }).join('');
      root.innerHTML =
        '<div class="kh-head"><span class="kh-brand"><span class="kh-dot"></span>Zo Veilig Keuzehulp</span>' +
        '<span class="kh-lead">In ' + QUESTIONS.length + ' korte vragen naar het juiste pad</span>' +
        '<div class="kh-progress"><span style="width:' + pct + '%"></span></div></div>' +
        '<div class="kh-body">' +
        (step > 0 ? '<button type="button" class="kh-back" data-back>&larr; Terug</button>' : '') +
        '<span class="kh-step">' + esc(q.vraag) + ' · Stap ' + (step + 1) + ' van ' + QUESTIONS.length + '</span>' +
        '<h3>' + esc(q.title) + '</h3>' +
        (q.help ? '<p class="kh-qsub">' + esc(q.help) + '</p>' : '') +
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

      // Deep-link to the Oplossingen page and open THIS package's "Meer informatie" modal.
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
          '<div class="res-pathway"><span class="rp-line">' + esc(r.headline) + '</span>' +
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
